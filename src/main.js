import {
  connectCloudStorage,
  disconnectCloudStorage,
  flushCloudSync,
  getCustomTabs,
  getTabPrefs,
  saveTabPrefs
} from './storage/storage.js';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
import { initExercise, renderExercise } from './features/exercise.js';
import { initCalendar, renderCalendar } from './features/calendar.js';
import { initMotto, renderMotto } from './features/motto.js';
import { initTabs, renderTabs } from './components/tabs.js';
import { buildTabs, DEFAULT_TABS } from './tabs.js';
import { initTabSettings } from './features/tabSettings.js';
import { initCustomTabs, renderCustomTabs } from './features/customTabs.js';

let activeTabs = [];
const initializedTabs = new Set();

function hasTab(id) {
  return activeTabs.some((tab) => tab.id === id);
}

function renderAll() {
  if (hasTab('todo')) renderTodo();
  if (hasTab('priority')) renderPriority();
  if (hasTab('daily')) renderDaily();
}

function renderAllViews() {
  setDateDisplay();
  renderMotto();
  renderAll();
  if (hasTab('goals')) renderGoals();
  if (hasTab('ideas')) renderIdeas();
  if (hasTab('study')) renderStudyLog();
  if (hasTab('exercise')) renderExercise();
  if (hasTab('records')) renderCalendar();
  renderCustomTabs();
}

function watchDateChange() {
  let currentDay = todayKey();
  setInterval(() => {
    const newDay = todayKey();
    if (newDay !== currentDay) {
      currentDay = newDay;
      setDateDisplay();
      renderAll();
      if (hasTab('study')) renderStudyLog();
      if (hasTab('exercise')) renderExercise();
    }
  }, 30000);
}

let appInitialized = false;

function initVisibleTabFeatures() {
  if (hasTab('todo') && !initializedTabs.has('todo')) {
    initTodo(renderAll);
    initializedTabs.add('todo');
  }
  if (hasTab('priority') && !initializedTabs.has('priority')) {
    initPriority(renderAll);
    initializedTabs.add('priority');
  }
  if (hasTab('daily') && !initializedTabs.has('daily')) {
    initDaily(renderAll);
    initializedTabs.add('daily');
  }
  if (hasTab('goals') && !initializedTabs.has('goals')) {
    initGoals();
    initializedTabs.add('goals');
  }
  if (hasTab('ideas') && !initializedTabs.has('ideas')) {
    initIdeas();
    initializedTabs.add('ideas');
  }
  if (hasTab('study') && !initializedTabs.has('study')) {
    initStudy();
    initializedTabs.add('study');
  }
  if (hasTab('exercise') && !initializedTabs.has('exercise')) {
    initExercise();
    initializedTabs.add('exercise');
  }
  if (hasTab('records') && !initializedTabs.has('records')) {
    initCalendar();
    initializedTabs.add('records');
  }
}

function refreshTabs() {
  const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  activeTabs = buildTabs();
  const activeTabId = activeTabs.some((tab) => tab.id === currentTab)
    ? currentTab
    : activeTabs[0]?.id;
  renderTabs(activeTabs, {
    tabsRootId: 'tabsNav',
    panelsRootId: 'tabPanels',
    defaultTabId: activeTabId
  });
  initTabs(activeTabs, { onReorder: saveVisibleTabOrder });
  initVisibleTabFeatures();
  renderAllViews();
}

function saveVisibleTabOrder(visibleOrder) {
  const prefs = getTabPrefs() || {};
  const customIds = getCustomTabs().map((tab) => tab.id);
  const defaultIds = DEFAULT_TABS.map((tab) => tab.id);
  const knownIds = [...defaultIds, ...customIds];
  const currentOrder = (Array.isArray(prefs.order) ? prefs.order : knownIds)
    .filter((id) => knownIds.includes(id));

  knownIds.forEach((id) => {
    if (!currentOrder.includes(id)) currentOrder.push(id);
  });

  const nextVisibleOrder = visibleOrder.filter((id) => knownIds.includes(id));
  const nextOrder = [
    ...nextVisibleOrder,
    ...currentOrder.filter((id) => !nextVisibleOrder.includes(id))
  ];

  saveTabPrefs({
    ...prefs,
    order: nextOrder
  });
  refreshTabs();
}

function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  refreshTabs();
  initTabSettings(DEFAULT_TABS, refreshTabs);
  initCustomTabs();
  initMotto();
  watchDateChange();
}

function showSignedOut(message = '') {
  document.body.className = 'auth-signed-out';
  const messageEl = document.getElementById('authMessage');
  messageEl.textContent = message;
  messageEl.classList.toggle('error', Boolean(message));
  setAuthButtonsDisabled(false);
}

function showSignedIn() {
  document.getElementById('authMessage').classList.remove('error');
  document.getElementById('authMessage').textContent = '';
  document.body.className = 'auth-signed-in';
}

function getAuthErrorMessage(err) {
  const messages = {
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호를 다시 확인해주세요.',
    'auth/missing-password': '비밀번호를 입력해주세요.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/wrong-password': '비밀번호를 다시 확인해주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    'auth/unauthorized-domain': '현재 접속 주소에서는 로그인할 수 없습니다.',
    'auth/popup-blocked': '브라우저가 로그인 창을 차단했습니다.'
  };
  return messages[err.code] || '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function getAuthFormValues() {
  return {
    email: document.getElementById('authEmailInput').value.trim(),
    password: document.getElementById('authPasswordInput').value,
    passwordConfirm: document.getElementById('authPasswordConfirmInput').value
  };
}

function setAuthButtonsDisabled(disabled) {
  document.getElementById('googleLoginBtn').disabled = disabled;
  document.getElementById('emailLoginBtn').disabled = disabled;
  document.getElementById('emailSignupModeBtn').disabled = disabled;
  document.getElementById('emailSignupConfirmBtn').disabled = disabled;
  document.getElementById('emailLoginModeBtn').disabled = disabled;
}

function setAuthMode(mode) {
  const authCard = document.querySelector('.auth-card');
  const message = document.getElementById('authMessage');
  const isSignup = mode === 'signup';

  authCard.classList.toggle('signup-mode', isSignup);
  document.getElementById('authPasswordInput').autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('authPasswordConfirmInput').value = '';
  message.textContent = '';
  message.classList.remove('error');
}

async function runEmailAuth(action, { requirePasswordConfirm = false } = {}) {
  const message = document.getElementById('authMessage');
  const { email, password, passwordConfirm } = getAuthFormValues();

  if (!email || !password) {
    message.textContent = '이메일과 비밀번호를 모두 입력해주세요.';
    message.classList.add('error');
    return;
  }

  if (requirePasswordConfirm && password !== passwordConfirm) {
    message.textContent = '비밀번호 확인이 일치하지 않습니다.';
    message.classList.add('error');
    return;
  }

  setAuthButtonsDisabled(true);
  message.textContent = '';
  message.classList.remove('error');

  try {
    await action(email, password);
  } catch (err) {
    console.error('[auth] Email auth failed.', err);
    message.textContent = getAuthErrorMessage(err);
    message.classList.add('error');
    setAuthButtonsDisabled(false);
  }
}

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  const message = document.getElementById('authMessage');
  setAuthButtonsDisabled(true);
  message.textContent = '';
  message.classList.remove('error');

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
    setAuthButtonsDisabled(false);
  }
});

document.getElementById('emailLoginBtn').addEventListener('click', async () => {
  await runEmailAuth((email, password) => signInWithEmailAndPassword(auth, email, password));
});

document.getElementById('emailSignupModeBtn').addEventListener('click', () => {
  setAuthMode('signup');
  document.getElementById('authPasswordConfirmInput').focus();
});

document.getElementById('emailLoginModeBtn').addEventListener('click', () => {
  setAuthMode('login');
  document.getElementById('authPasswordInput').focus();
});

document.getElementById('emailSignupConfirmBtn').addEventListener('click', async () => {
  await runEmailAuth(
    (email, password) => createUserWithEmailAndPassword(auth, email, password),
    { requirePasswordConfirm: true }
  );
});

document.getElementById('authPasswordInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (document.querySelector('.auth-card').classList.contains('signup-mode')) {
    document.getElementById('authPasswordConfirmInput').focus();
    return;
  }
  await runEmailAuth((email, password) => signInWithEmailAndPassword(auth, email, password));
});

document.getElementById('authPasswordConfirmInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  await runEmailAuth(
    (email, password) => createUserWithEmailAndPassword(auth, email, password),
    { requirePasswordConfirm: true }
  );
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
