// storage.js — localStorage persistence + category definitions
// Tweak CATEGORIES here to add/remove/edit spending & income categories.

const STORAGE_KEY = 'coinquest-save-v1';

const DEFAULT_STATE = {
  startingBalance: 0,
  weeklyIncome: 0,     // user-entered typical weekly income, used for projections only
  transactions: [],    // { id, type: 'income'|'expense', category, amount, note, date }
  goals: [],           // { id, name, target, saved, icon, complete }
  xp: 0,
  streak: { count: 0, lastDate: null },
  settings: { sound: true }
};

export const CATEGORIES = {
  expense: [
    { id: 'food',      name: 'Food',      icon: '🍔', color: '#fb7185', weeklyLimit: 20 },
    { id: 'fun',       name: 'Fun',       icon: '🎮', color: '#fbbf24', weeklyLimit: 15 },
    { id: 'clothes',   name: 'Clothes',   icon: '👕', color: '#a78bfa', weeklyLimit: 15 },
    { id: 'transport', name: 'Transport', icon: '🚌', color: '#38bdf8', weeklyLimit: 10 },
    { id: 'gifts',     name: 'Gifts',     icon: '🎁', color: '#f472b6', weeklyLimit: 10 },
    { id: 'save',      name: 'Savings',   icon: '🏦', color: '#2dd4bf', weeklyLimit: 999 },
    { id: 'other',     name: 'Other',     icon: '🧩', color: '#8b90a5', weeklyLimit: 10 }
  ],
  income: [
    { id: 'allowance',    name: 'Allowance',   icon: '💵' },
    { id: 'job',          name: 'Job/Chores',  icon: '💼' },
    { id: 'gift',         name: 'Gift',        icon: '🎁' },
    { id: 'other-income', name: 'Other',       icon: '✨' }
  ]
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch (e) {
    console.warn('Coin Quest: could not load save, starting fresh.', e);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getCategoryById(id, type) {
  const list = type ? CATEGORIES[type] : [...CATEGORIES.expense, ...CATEGORIES.income];
  return list.find(c => c.id === id);
}
