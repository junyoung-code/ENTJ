export function renderTabs(tabs, { tabsRootId, panelsRootId, defaultTabId }) {
  const tabsRoot = document.getElementById(tabsRootId);
  const panelsRoot = document.getElementById(panelsRootId);
  const existingPanels = new Map(
    [...panelsRoot.querySelectorAll('.tab-panel')].map((panel) => [panel.id.replace('tab-', ''), panel])
  );
  tabsRoot.innerHTML = '';
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));

  tabs.forEach((tab) => {
    const isActive = tab.id === defaultTabId;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-btn' + (isActive ? ' active' : '');
    button.dataset.tab = tab.id;
    button.textContent = tab.label;
    tabsRoot.appendChild(button);

    const panel = existingPanels.get(tab.id) || document.createElement('div');
    if (!existingPanels.has(tab.id)) {
      panel.id = `tab-${tab.id}`;
      panel.innerHTML = tab.render();
    }
    panel.className = 'tab-panel' + (isActive ? ' active' : '');
    panelsRoot.appendChild(panel);
  });

  const manageButton = document.createElement('button');
  manageButton.type = 'button';
  manageButton.className = 'tab-manage-btn';
  manageButton.id = 'tabManageBtn';
  manageButton.title = '탭 편집';
  manageButton.textContent = '+';
  tabsRoot.appendChild(manageButton);
}

export function initTabs(tabs, { onReorder } = {}) {
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const tabsRoot = document.getElementById('tabsNav');
  let pressTimer = null;
  let pressStart = null;
  let draggingButton = null;
  let isReordering = false;
  let suppressClick = false;

  function getTabButtons() {
    return [...tabsRoot.querySelectorAll('.tab-btn')];
  }

  function clearPressTimer() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  function startReorder(button) {
    isReordering = true;
    suppressClick = true;
    draggingButton = button;
    tabsRoot.classList.add('tabs-reordering');
    button.classList.add('dragging');
  }

  function moveDraggedTab(pointerX, pointerY) {
    if (!draggingButton) return;
    const target = document.elementFromPoint(pointerX, pointerY)?.closest?.('.tab-btn');
    if (!target || target === draggingButton || !tabsRoot.contains(target)) return;

    const rect = target.getBoundingClientRect();
    const beforeTarget = pointerX < rect.left + rect.width / 2;
    tabsRoot.insertBefore(draggingButton, beforeTarget ? target : target.nextSibling);
  }

  function finishReorder() {
    clearPressTimer();
    if (!isReordering) {
      pressStart = null;
      return;
    }

    const order = getTabButtons().map((button) => button.dataset.tab);
    draggingButton?.classList.remove('dragging');
    tabsRoot.classList.remove('tabs-reordering');
    draggingButton = null;
    isReordering = false;
    pressStart = null;
    onReorder?.(order);
    setTimeout(() => {
      suppressClick = false;
    }, 0);
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pressStart = { x: e.clientX, y: e.clientY };
      clearPressTimer();
      pressTimer = setTimeout(() => startReorder(btn), 300);
      btn.setPointerCapture?.(e.pointerId);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!pressStart) return;
      const distance = Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y);
      if (!isReordering && distance > 8) {
        clearPressTimer();
        pressStart = null;
        return;
      }
      if (isReordering) {
        e.preventDefault();
        moveDraggedTab(e.clientX, e.clientY);
      }
    });

    btn.addEventListener('pointerup', finishReorder);
    btn.addEventListener('pointercancel', () => {
      draggingButton?.classList.remove('dragging');
      tabsRoot.classList.remove('tabs-reordering');
      draggingButton = null;
      isReordering = false;
      pressStart = null;
      clearPressTimer();
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    });

    btn.addEventListener('click', (e) => {
      if (suppressClick) {
        e.preventDefault();
        return;
      }
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      tabsById.get(btn.dataset.tab)?.onActivate?.();
    });
  });
}
