import {
  connectCloudStorage,
  disconnectCloudStorage,
  flushCloudSync
} from './storage/storage.js';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';
import { auth, isLocalDevelopment } from './firebase.js';
import { setDateDisplay, todayKey } from './utils/date.js';
import { initTodo, renderTodo } from './features/todo.js';
import { initPriority, renderPriority } from './features/priority.js';
import { initDaily, renderDaily } from './features/daily.js';
import { initGoals, renderGoals } from './features/goals.js';
import { initIdeas, renderIdeas } from './features/ideas.js';
import { initStudy, renderStudyLog } from './features/study.js';
import { initCalendar, renderCalendar } from './features/calendar.js';
import { initMotto, renderMotto } from './features/motto.js';

function renderAll() {
  renderTodo();
  renderPriority();
  renderDaily();
}

function renderAllViews() {
  setDateDisplay();
  renderMotto();
  renderAll();
  renderGoals();
  renderIdeas();
  renderStudyLog();
  renderCalendar();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'records') renderCalendar();
    });
  });
}

function watchDateChange() {
  let currentDay = todayKey();
  setInterval(() => {
    const newDay = todayKey();
    if (newDay !== currentDay) {
      currentDay = newDay;
      setDateDisplay();
      renderAll();
      renderStudyLog();
    }
  }, 30000);
}

let appInitialized = false;

function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  initTabs();
  initTodo(renderAll);
  initPriority(renderAll);
  initDaily(renderAll);
  initGoals();
  initIdeas();
  initStudy();
  initCalendar();
  initMotto();
  watchDateChange();
}

function showSignedOut(message = '') {
  document.body.className = 'auth-signed-out';
  const messageEl = document.getElementById('authMessage');
  messageEl.textContent = message;
  messageEl.classList.toggle('error', Boolean(message));
  document.getElementById('googleLoginBtn').disabled = false;
}

function showSignedIn() {
  document.getElementById('authMessage').classList.remove('error');
  document.getElementById('authMessage').textContent = '';
  document.body.className = 'auth-signed-in';
}

function getAuthErrorMessage(err) {
  const messages = {
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    'auth/unauthorized-domain': '현재 접속 주소에서는 로그인할 수 없습니다.',
    'auth/popup-blocked': '브라우저가 로그인 창을 차단했습니다.'
  };
  return messages[err.code] || '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  const button = document.getElementById('googleLoginBtn');
  const message = document.getElementById('authMessage');
  button.disabled = true;
  message.textContent = '';

  try {
    const provider = new GoogleAuthProvider();
    if (isLocalDevelopment) {
      await signInWithPopup(auth, provider);
    } else {
      await signInWithRedirect(auth, provider);
    }
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('[auth] Google sign-in failed.', err);
      message.textContent = getAuthErrorMessage(err);
      message.classList.add('error');
    }
    button.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await flushCloudSync();
  await signOut(auth);
});

async function startAuth() {
  let redirectError = '';

  try {
    if (!isLocalDevelopment) await getRedirectResult(auth);
  } catch (err) {
    console.error('[auth] Google redirect sign-in failed.', err);
    redirectError = getAuthErrorMessage(err);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      disconnectCloudStorage();
      showSignedOut(redirectError);
      redirectError = '';
      return;
    }

    document.body.className = 'auth-loading';
    document.getElementById('authMessage').classList.remove('error');
    document.getElementById('authMessage').textContent = '내 데이터를 불러오는 중…';
    try {
      await connectCloudStorage(user.uid);
      initApp();
      renderAllViews();
      showSignedIn();
    } catch (err) {
      console.error('[auth] User data load failed.', err);
      await signOut(auth);
      showSignedOut('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  });
}

startAuth();
