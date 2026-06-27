import { renderCalendar } from './features/calendar.js';
import { getCustomTabs, getTabPrefs } from './storage/storage.js';

export const DEFAULT_TABS = [
  {
    id: 'todo',
    label: 'To Do',
    render: () => `
      <div class="card">
        <div class="progress-wrap" id="todoTotalProgress" style="display:none">
          <div class="progress-label">
            <span>오늘 전체 진행률</span>
            <span id="todoTotalText">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="todoTotalFill" style="width:0%"></div>
          </div>
        </div>
        <div class="card-header" style="margin-bottom:8px">
          <span class="card-title">오늘의 할 일</span>
          <button class="add-btn" id="addTodoBtn" title="할 일 추가">+</button>
        </div>
        <ul class="task-list" id="todoList"></ul>
        <p class="empty-state" id="todoEmpty">+ 버튼으로 오늘의 할 일을 추가하세요</p>
        <div id="dailyInTodoWrap" style="display:none">
          <div class="section-divider">매일 반복</div>
          <ul class="task-list" id="dailyInTodoList"></ul>
        </div>
      </div>
    `
  },
  {
    id: 'priority',
    label: 'Priority',
    render: () => `
      <div class="card">
        <div class="progress-wrap" id="priorityProgress" style="display:none">
          <div class="progress-label">
            <span>오늘의 우선순위 진행률</span>
            <span id="priorityProgressText">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="priorityProgressFill" style="width:0%"></div>
          </div>
        </div>
        <div class="card-header" style="margin-bottom:8px">
          <span class="card-title">오늘의 우선순위</span>
          <button class="add-btn" id="addPriorityTodoBtn" title="할 일 추가">+</button>
        </div>
        <ul class="task-list priority-list" id="priorityList"></ul>
        <p class="empty-state" id="priorityEmpty">To Do에 오늘의 할 일을 추가하면 우선순위를 정할 수 있어요</p>
      </div>
    `
  },
  {
    id: 'daily',
    label: '매일 할 목록',
    render: () => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">매일 반복 목록</span>
          <button class="add-btn" id="addDailyBtn" title="항목 추가">+</button>
        </div>
        <p style="font-size:13px;color:#aaa;margin-bottom:12px;">한 번 추가하면 매일 To Do에도 표시돼요</p>
        <div class="progress-wrap" id="dailyProgress" style="display:none">
          <div class="progress-label">
            <span>오늘 진행률</span>
            <span id="dailyProgressText">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="dailyProgressFill" style="width:0%"></div>
          </div>
        </div>
        <ul class="task-list" id="dailyList"></ul>
        <p class="empty-state" id="dailyEmpty">+ 버튼으로 매일 할 항목을 추가하세요</p>
      </div>
    `
  },
  {
    id: 'exercise',
    label: '운동 기록',
    render: () => `
      <div class="card">
        <div class="progress-wrap" id="exerciseProgress" style="display:none">
          <div class="progress-label">
            <span>오늘의 운동 진행률</span>
            <span id="exerciseProgressText">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="exerciseProgressFill" style="width:0%"></div>
          </div>
        </div>
        <div class="card-header">
          <span class="card-title">오늘의 운동 기록</span>
          <button class="add-btn" id="addExerciseBtn" title="운동 기록 추가">+</button>
        </div>
        <p style="font-size:13px;color:#aaa;margin-bottom:12px;">운동 타입을 선택하고 기록을 남겨보세요</p>
        <ul class="task-list" id="exerciseList"></ul>
        <p class="empty-state" id="exerciseEmpty">+ 버튼으로 운동 기록을 추가하세요</p>
      </div>
    `
  },
  {
    id: 'goals',
    label: '목표',
    render: () => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">내 목표</span>
          <button class="add-btn" id="addGoalBtn" title="목표 추가">+</button>
        </div>
        <p style="font-size:13px;color:#aaa;margin-bottom:12px;">이루고 싶은 목표를 적어보세요</p>
        <ul class="task-list" id="goalList"></ul>
        <p class="empty-state" id="goalEmpty">+ 버튼으로 목표를 추가하세요</p>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">완수한 목표</span>
        </div>
        <ul class="task-list" id="achievedGoalList"></ul>
        <p class="empty-state" id="achievedGoalEmpty">아직 완수한 목표가 없어요</p>
      </div>
    `
  },
  {
    id: 'ideas',
    label: '아이디어',
    render: () => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">아이디어</span>
          <button class="add-btn" id="addIdeaBtn" title="아이디어 추가">+</button>
        </div>
        <p style="font-size:13px;color:#aaa;margin-bottom:12px;">떠오른 생각을 빠르게 남겨두세요</p>
        <ul class="task-list" id="ideaList"></ul>
        <p class="empty-state" id="ideaEmpty">+ 버튼으로 아이디어를 추가하세요</p>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">완수한 아이디어</span>
        </div>
        <ul class="task-list" id="achievedIdeaList"></ul>
        <p class="empty-state" id="achievedIdeaEmpty">아직 완수한 아이디어가 없어요</p>
      </div>
    `
  },
  {
    id: 'records',
    label: '기록',
    onActivate: renderCalendar,
    render: () => `
      <div class="card">
        <div class="cal-nav">
          <button class="cal-nav-btn" id="calPrevBtn">&#8249;</button>
          <span class="cal-month-label" id="calMonthLabel"></span>
          <button class="cal-nav-btn" id="calNextBtn">&#8250;</button>
        </div>
        <div class="cal-grid" id="calGrid"></div>
        <div class="cal-legend" id="calLegend">
          <div class="legend-item" id="legend-0">
            <div class="legend-dot" style="background:#fee2e2"></div>0%
          </div>
          <div class="legend-item" id="legend-low">
            <div class="legend-dot" style="background:#fef3c7"></div><span id="legend-low-label">1-49%</span>
          </div>
          <div class="legend-item" id="legend-mid">
            <div class="legend-dot" style="background:#d1fae5"></div><span id="legend-mid-label">50-99%</span>
          </div>
          <div class="legend-item" id="legend-100">
            <div class="legend-dot" style="background:#10b981"></div>100%
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:#fafafa;border:1px solid #e0e0e0"></div>기록 없음
          </div>
          <button class="cal-settings-gear" id="calSettingsBtn" title="색상 설정">⚙</button>
        </div>
        <div class="cal-settings-panel" id="calSettingsPanel">
          <div class="cal-settings-title">
            색상 설정
            <button class="cal-settings-reset" id="calSettingsReset">기본값</button>
          </div>

          <div class="cal-settings-section-label">단계별 색상</div>
          <div class="cal-color-grid">
            <button class="cal-color-tier" data-tier="rate0" type="button">
              <span class="cal-color-chip">A</span><span>0%</span>
            </button>
            <button class="cal-color-tier" data-tier="rateLow" type="button">
              <span class="cal-color-chip">A</span><span>낮음</span>
            </button>
            <button class="cal-color-tier" data-tier="rateMid" type="button">
              <span class="cal-color-chip">A</span><span>중간</span>
            </button>
            <button class="cal-color-tier" data-tier="rate100" type="button">
              <span class="cal-color-chip">A</span><span>100%</span>
            </button>
          </div>

          <div class="cal-settings-section-label">구간 나누기</div>
          <div class="cal-range-control">
            <div class="cal-range-labels">
              <span class="cal-range-tag" id="rangeLowTag">낮음 1-49%</span>
              <span class="cal-range-tag" id="rangeMidTag">중간 50-99%</span>
            </div>
            <input type="range" class="cal-range-slider" id="thresholdSlider" min="2" max="99" value="50">
          </div>

          <div class="cal-palette-popover" id="calPalettePopover"></div>
        </div>
      </div>
      <div class="day-detail" id="dayDetail" style="display:none"></div>
    `
  },
  {
    id: 'study',
    label: '공부 기록',
    render: () => `
      <div class="card">
        <div class="card-header" style="margin-bottom:4px">
          <span class="card-title">스톱워치</span>
        </div>
        <div class="study-subject-row">
          <input type="text" class="study-subject-input" id="swSubjectInput" placeholder="과목 / 주제 입력 (선택)" maxlength="40" />
        </div>
        <div class="stopwatch-display">
          <div class="sw-time" id="swTime">00:00:00</div>
          <div class="sw-subject-label" id="swSubjectLabel"></div>
        </div>
        <div class="sw-controls">
          <button class="sw-btn sw-btn-start" id="swStartBtn">시작</button>
          <button class="sw-btn sw-btn-stop" id="swStopBtn" style="display:none">저장</button>
          <button class="sw-btn sw-btn-reset" id="swResetBtn" style="display:none">리셋</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">오늘 공부 기록</span>
        </div>
        <div class="study-total-bar" id="studyTotalBar" style="display:none">
          <span class="study-total-label">오늘 총 공부 시간</span>
          <span class="study-total-time" id="studyTotalTime">0분</span>
        </div>
        <ul class="study-log-list" id="studyLogList"></ul>
        <p class="empty-state" id="studyLogEmpty">스톱워치로 공부를 기록해보세요</p>
      </div>
    `
  }
];

function renderCustomTab(tab) {
  return `<div class="custom-tab-root" data-custom-tab-id="${tab.id}"></div>`;
}

function normalizeTabOrder(defaultIds, customTabs, prefs) {
  const customIds = customTabs.map((tab) => tab.id);
  const knownIds = [...defaultIds, ...customIds];
  const savedOrder = Array.isArray(prefs?.order) ? prefs.order : defaultIds;
  const order = savedOrder.filter((id) => knownIds.includes(id));

  knownIds.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  return order;
}

export function buildTabs() {
  const prefs = getTabPrefs();
  const hidden = Array.isArray(prefs?.hidden) ? prefs.hidden : [];
  const labels = prefs?.labels && typeof prefs.labels === 'object' ? prefs.labels : {};
  const customTabs = getCustomTabs();
  const defaultIds = DEFAULT_TABS.map((tab) => tab.id);
  const defaultById = new Map(DEFAULT_TABS.map((tab) => [
    tab.id,
    {
      ...tab,
      label: labels[tab.id] || tab.label
    }
  ]));
  const customById = new Map(customTabs.map((tab) => [
    tab.id,
    {
      id: tab.id,
      label: tab.label,
      isCustom: true,
      render: () => renderCustomTab(tab)
    }
  ]));

  const tabs = normalizeTabOrder(defaultIds, customTabs, prefs)
    .filter((id) => !hidden.includes(id))
    .map((id) => defaultById.get(id) || customById.get(id))
    .filter(Boolean);

  return tabs.length > 0 ? tabs : [DEFAULT_TABS[0]];
}
