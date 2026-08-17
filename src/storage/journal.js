import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const PAGE_SIZE = 30;
const deletingBlocks = new Set();
const activeWrites = new Map();

function trackWrite(blockId, operation) {
  if (!activeWrites.has(blockId)) activeWrites.set(blockId, new Set());
  const writes = activeWrites.get(blockId);
  writes.add(operation);
  const cleanup = () => {
    writes.delete(operation);
    if (writes.size === 0) activeWrites.delete(blockId);
  };
  operation.then(cleanup, cleanup);
  return operation;
}

function requireUserId() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('일기를 저장하려면 로그인이 필요해요.');
  return userId;
}

function draftStorageKey(userId) {
  return `journalDrafts:${userId}`;
}

function getDrafts(userId) {
  try {
    return JSON.parse(localStorage.getItem(draftStorageKey(userId))) || {};
  } catch {
    return {};
  }
}

function setDrafts(userId, drafts) {
  if (Object.keys(drafts).length === 0) {
    localStorage.removeItem(draftStorageKey(userId));
    return;
  }
  localStorage.setItem(draftStorageKey(userId), JSON.stringify(drafts));
}

function draftId(blockId, date) {
  return `${blockId}|${date}`;
}

function entriesCollection(userId, blockId) {
  return collection(db, 'users', userId, 'journalBlocks', blockId, 'entries');
}

function entryDocument(userId, blockId, date) {
  return doc(db, 'users', userId, 'journalBlocks', blockId, 'entries', date);
}

export function stageJournalDraft(blockId, date, text) {
  if (deletingBlocks.has(blockId)) return;
  const userId = requireUserId();
  const drafts = getDrafts(userId);
  drafts[draftId(blockId, date)] = { blockId, date, text, stagedAt: Date.now() };
  setDrafts(userId, drafts);
}

function clearJournalDraft(userId, blockId, date) {
  const drafts = getDrafts(userId);
  delete drafts[draftId(blockId, date)];
  setDrafts(userId, drafts);
}

export async function getJournalEntry(blockId, date) {
  const userId = requireUserId();
  const drafts = getDrafts(userId);
  const draft = drafts[draftId(blockId, date)];

  try {
    const snapshot = await getDoc(entryDocument(userId, blockId, date));
    return {
      text: draft ? draft.text : (snapshot.data()?.text || ''),
      hasDraft: Boolean(draft),
      exists: snapshot.exists()
    };
  } catch (error) {
    if (draft) return { text: draft.text, hasDraft: true, exists: false };
    throw error;
  }
}

export async function saveJournalEntry(blockId, date, text) {
  if (deletingBlocks.has(blockId)) throw new Error('삭제 중인 일기 블록이에요.');
  const userId = requireUserId();
  stageJournalDraft(blockId, date, text);
  return trackWrite(blockId, (async () => {
    const entryRef = entryDocument(userId, blockId, date);
    const existing = await getDoc(entryRef);
    const data = { text, updatedAt: serverTimestamp() };
    if (!existing.exists()) data.createdAt = serverTimestamp();
    await setDoc(entryRef, data, { merge: true });
    clearJournalDraft(userId, blockId, date);
  })());
}

export async function deleteJournalEntry(blockId, date) {
  if (deletingBlocks.has(blockId)) return;
  const userId = requireUserId();
  stageJournalDraft(blockId, date, '');
  return trackWrite(blockId, (async () => {
    await deleteDoc(entryDocument(userId, blockId, date));
    clearJournalDraft(userId, blockId, date);
  })());
}

export async function listJournalEntries(blockId, { afterDate = null, pageSize = PAGE_SIZE } = {}) {
  const userId = requireUserId();
  const constraints = [orderBy(documentId(), 'desc')];
  if (afterDate) constraints.push(startAfter(afterDate));
  constraints.push(limit(pageSize));

  const snapshot = await getDocs(query(entriesCollection(userId, blockId), ...constraints));
  return snapshot.docs.map((entry) => ({
    date: entry.id,
    text: entry.data().text || ''
  }));
}

export async function deleteJournalBlock(blockId) {
  const userId = requireUserId();
  const entries = entriesCollection(userId, blockId);
  deletingBlocks.add(blockId);

  try {
    await Promise.allSettled([...(activeWrites.get(blockId) || [])]);
    while (true) {
      const snapshot = await getDocs(query(entries, limit(400)));
      if (snapshot.empty) break;
      const batch = writeBatch(db);
      snapshot.docs.forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }

    const drafts = getDrafts(userId);
    Object.keys(drafts).forEach((key) => {
      if (drafts[key].blockId === blockId) delete drafts[key];
    });
    setDrafts(userId, drafts);
  } catch (error) {
    deletingBlocks.delete(blockId);
    throw error;
  }
}

export async function flushPendingJournalDrafts() {
  const userId = auth.currentUser?.uid;
  if (!userId) return;
  const drafts = Object.values(getDrafts(userId));
  await Promise.all(drafts.map((draft) => (
    draft.text.trim()
      ? saveJournalEntry(draft.blockId, draft.date, draft.text)
      : deleteJournalEntry(draft.blockId, draft.date)
  )));
}
