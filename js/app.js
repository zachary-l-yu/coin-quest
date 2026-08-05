// app.js — main application logic for Coin Quest

import { loadState, saveState, CATEGORIES, getCategoryById } from './storage.js';
import { playIfEnabled } from './audio.js';

let state = loadState();
let currentTxType = 'expense';
let pendingAllocateGoalId = null;

const el = {
  txForm: document.getElementById('txForm'),
  txAmount: document.getElementById('txAmount'),
  txCategory: document.getElementById('txCategory'),
  txNote: document.getElementById('txNote'),
  btnExpense: document.getElementById('btnExpense'),
  btnIncome: document.getElementById('btnIncome'),
  balanceAmount: document.getElementById('balanceAmount'),
  balanceSub: document.getElementById('balanceSub'),
  budgetList: document.getElementById('budgetList'),
  spendChart: document.getElementById('spendChart'),
  txList: document.getElementById('txList'),
  goalsList: document.getElementById('goalsList'),
  levelRing: document.getElementById('levelRing'),
  levelNumber: document.getElementById('levelNumber'),
  streakLabel: document.getElementById('streakLabel'),
  muteBtn: document.getElementById('muteBtn'),
  toastContainer: document.getElementById('toastContainer'),
  newGoalBtn: document.getElementById('newGoalBtn'),
  goalDialog: document.getElementById('goalDialog'),
  goalForm: document.getElementById('goalForm'),
  cancelGoalBtn: document.getElementById('cancelGoalBtn'),
  allocateDialog: document.getElementById('allocateDialog'),
  allocateForm: document.getElementById('allocateForm'),
  allocateAmount: document.getElementById('allocateAmount'),
  allocateTitle: document.getElementById('allocateTitle'),
  cancelAllocateBtn: document.getElementById('cancelAllocateBtn'),
  incomeForm: document.getElementById('incomeForm'),
  weeklyIncomeInput: document.getElementById('weeklyIncomeInput'),
  projWeekly: document.getElementById('projWeekly'),
  projMonthly: document.getElementById('projMonthly'),
  projYearly: document.getElementById('projYearly')
};

// ---------- Helpers ----------

function computeBalance(s) {
  return s.transactions.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
    s.startingBalance
  );
}

function levelFromXp(xp) {
  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;
  return { level, pct: into };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  return monday;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toast(message, kind = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.textContent = message;
  el.toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

function addXp(amount) {
  const before = levelFromXp(state.xp).level;
  state.xp += amount;
  const after = levelFromXp(state.xp).level;
  if (after > before) {
    toast(`Level up! You're now level ${after}.`, 'level');
    playIfEnabled('levelUp', state.settings.sound);
  }
}

function updateStreak() {
  const today = todayISO();
  if (state.streak.lastDate === today) return; // already logged today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak.count = state.streak.lastDate === yesterday ? state.streak.count + 1 : 1;
  state.streak.lastDate = today;
}

function weeklySpendByCategory(catId) {
  const monday = startOfWeek();
  return state.transactions
    .filter(t => t.type === 'expense' && t.category === catId && new Date(t.date) >= monday)
    .reduce((sum, t) => sum + t.amount, 0);
}

// ---------- Rendering ----------

function populateCategorySelect() {
  el.txCategory.innerHTML = '';
  for (const c of CATEGORIES[currentTxType]) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icon} ${c.name}`;
    el.txCategory.appendChild(opt);
  }
}

function setTxType(type) {
  currentTxType = type;
  el.btnExpense.classList.toggle('active', type === 'expense');
  el.btnIncome.classList.toggle('active', type === 'income');
  populateCategorySelect();
}

function renderBalance() {
  const balance = computeBalance(state);
  el.balanceAmount.textContent = `$${balance.toFixed(2)}`;
  el.balanceAmount.classList.toggle('negative', balance < 0);
}

function renderBudgets() {
  el.budgetList.innerHTML = '';
  for (const c of CATEGORIES.expense) {
    if (c.id === 'save') continue;
    const spent = weeklySpendByCategory(c.id);
    const pct = Math.min(100, (spent / c.weeklyLimit) * 100);
    const stateClass = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : '';
    const row = document.createElement('div');
    row.className = 'budget-row';
    row.innerHTML = `
      <div class="budget-label"><span>${c.icon} ${c.name}</span><span>$${spent.toFixed(2)} / $${c.weeklyLimit}</span></div>
      <div class="progress-track"><div class="progress-fill ${stateClass}" style="width:${pct}%"></div></div>
    `;
    el.budgetList.appendChild(row);
  }
}

function renderSpendChart() {
  el.spendChart.innerHTML = '';
  const totals = CATEGORIES.expense
    .map(c => ({
      ...c,
      total: state.transactions.filter(t => t.type === 'expense' && t.category === c.id).reduce((s, t) => s + t.amount, 0)
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  if (totals.length === 0) {
    el.spendChart.innerHTML = `<p class="empty-msg">No spending logged yet. Your breakdown will appear here.</p>`;
    return;
  }
  const max = Math.max(...totals.map(t => t.total));
  for (const c of totals) {
    const width = (c.total / max) * 100;
    const bar = document.createElement('div');
    bar.className = 'chart-row';
    bar.innerHTML = `
      <span class="chart-label">${c.icon} ${c.name}</span>
      <div class="chart-track"><div class="chart-fill" style="width:${width}%; background:${c.color}"></div></div>
      <span class="chart-value">$${c.total.toFixed(2)}</span>
    `;
    el.spendChart.appendChild(bar);
  }
}

function renderTxList() {
  el.txList.innerHTML = '';
  const recent = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  if (recent.length === 0) {
    el.txList.innerHTML = `<li class="empty-msg">No activity yet. Log your first transaction above.</li>`;
    return;
  }
  for (const t of recent) {
    const cat = getCategoryById(t.category, t.type) || { icon: '•', name: t.category };
    const sign = t.type === 'income' ? '+' : '-';
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.innerHTML = `
      <span class="tx-icon">${cat.icon}</span>
      <span class="tx-info">
        <span class="tx-cat">${cat.name}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span>
        <span class="tx-date">${formatDate(t.date)}</span>
      </span>
      <span class="tx-amount ${t.type}">${sign}$${t.amount.toFixed(2)}</span>
      <button class="tx-delete" data-id="${t.id}" aria-label="Delete transaction">✕</button>
    `;
    el.txList.appendChild(li);
  }
}

function renderGoals() {
  el.goalsList.innerHTML = '';
  if (state.goals.length === 0) {
    el.goalsList.innerHTML = `<p class="empty-msg">No goals yet. Start one to save toward something.</p>`;
    return;
  }
  for (const g of state.goals) {
    const pct = Math.min(100, (g.saved / g.target) * 100);
    const card = document.createElement('div');
    card.className = `goal-card ${g.complete ? 'complete' : ''}`;
    card.innerHTML = `
      <div class="goal-head"><span>${g.icon} ${escapeHtml(g.name)}</span>${g.complete ? '<span class="goal-badge">DONE</span>' : ''}</div>
      <div class="goal-progress-track"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-foot">
        <span>$${g.saved.toFixed(2)} / $${g.target.toFixed(2)}</span>
        ${!g.complete ? `<button class="btn-tiny" data-goal="${g.id}">+ Add</button>` : ''}
      </div>
    `;
    el.goalsList.appendChild(card);
  }
}

function renderPlayer() {
  const { level, pct } = levelFromXp(state.xp);
  el.levelNumber.textContent = level;
  el.levelRing.style.setProperty('--xp-pct', pct);
  el.streakLabel.textContent = `${state.streak.count} day streak`;
  el.streakLabel.classList.toggle('active', state.streak.count > 0);
}

function renderIncomeProjection() {
  const weekly = state.weeklyIncome || 0;
  el.weeklyIncomeInput.value = weekly ? weekly : '';
  el.projWeekly.textContent = `$${weekly.toFixed(2)}`;
  el.projMonthly.textContent = `$${(weekly * 4.345).toFixed(2)}`;
  el.projYearly.textContent = `$${(weekly * 52).toFixed(2)}`;
}

function renderAll() {
  renderBalance();
  renderBudgets();
  renderSpendChart();
  renderTxList();
  renderGoals();
  renderPlayer();
  renderIncomeProjection();
  saveState(state);
}

// ---------- Events ----------

el.btnExpense.addEventListener('click', () => setTxType('expense'));
el.btnIncome.addEventListener('click', () => setTxType('income'));

el.txForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(el.txAmount.value);
  if (!amount || amount <= 0) {
    playIfEnabled('error', state.settings.sound);
    return;
  }

  state.transactions.push({
    id: crypto.randomUUID(),
    type: currentTxType,
    category: el.txCategory.value,
    amount,
    note: el.txNote.value.trim(),
    date: new Date().toISOString()
  });

  updateStreak();
  addXp(10);
  playIfEnabled('coin', state.settings.sound);
  toast(`${currentTxType === 'income' ? '+' : '-'}$${amount.toFixed(2)} logged`, currentTxType === 'income' ? 'income' : 'expense');
  el.txForm.reset();
  renderAll();
});

el.txList.addEventListener('click', (e) => {
  const btn = e.target.closest('.tx-delete');
  if (!btn) return;
  state.transactions = state.transactions.filter(t => t.id !== btn.dataset.id);
  renderAll();
});

el.incomeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const weekly = parseFloat(el.weeklyIncomeInput.value);
  state.weeklyIncome = isNaN(weekly) || weekly < 0 ? 0 : weekly;
  toast('Weekly income updated', 'income');
  renderAll();
});

el.newGoalBtn.addEventListener('click', () => {
  el.goalForm.reset();
  el.goalDialog.showModal();
});
el.cancelGoalBtn.addEventListener('click', () => el.goalDialog.close());

el.goalForm.addEventListener('submit', () => {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const icon = document.getElementById('goalIcon').value;
  if (!name || !target || target <= 0) return;
  state.goals.push({ id: crypto.randomUUID(), name, target, saved: 0, icon, complete: false });
  playIfEnabled('click', state.settings.sound);
  toast(`New goal started: ${name}`, 'quest');
  renderAll();
});

el.goalsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-goal]');
  if (!btn) return;
  pendingAllocateGoalId = btn.dataset.goal;
  const goal = state.goals.find(g => g.id === pendingAllocateGoalId);
  el.allocateTitle.textContent = `Add Money to ${goal.name}`;
  el.allocateForm.reset();
  el.allocateDialog.showModal();
});
el.cancelAllocateBtn.addEventListener('click', () => el.allocateDialog.close());

el.allocateForm.addEventListener('submit', () => {
  const amount = parseFloat(el.allocateAmount.value);
  const goal = state.goals.find(g => g.id === pendingAllocateGoalId);
  if (!goal || !amount || amount <= 0) return;

  const balance = computeBalance(state);
  if (amount > balance) {
    toast(`Not enough balance. You have $${balance.toFixed(2)}.`, 'error');
    playIfEnabled('error', state.settings.sound);
    return;
  }

  state.transactions.push({
    id: crypto.randomUUID(),
    type: 'expense',
    category: 'save',
    amount,
    note: `Saved toward ${goal.name}`,
    date: new Date().toISOString()
  });
  goal.saved += amount;
  addXp(25);

  if (goal.saved >= goal.target && !goal.complete) {
    goal.complete = true;
    goal.saved = goal.target;
    addXp(50);
    toast(`Goal complete: ${goal.name}!`, 'quest');
    playIfEnabled('quest', state.settings.sound);
  } else {
    toast(`Added $${amount.toFixed(2)} to ${goal.name}`, 'quest');
    playIfEnabled('coin', state.settings.sound);
  }

  renderAll();
});

el.muteBtn.addEventListener('click', () => {
  state.settings.sound = !state.settings.sound;
  el.muteBtn.textContent = state.settings.sound ? '🔊' : '🔇';
  saveState(state);
});

// ---------- Init ----------

function init() {
  setTxType('expense');
  el.muteBtn.textContent = state.settings.sound ? '🔊' : '🔇';
  renderAll();
}

init();
