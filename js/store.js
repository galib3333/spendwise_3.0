// ===== CENTRALIZED STATE MANAGEMENT =====
// Uses IndexedDB with localStorage fallback

import {
  initDB, migrateFromLocalStorage,
  dbGetAll, dbPutAll, dbPut, dbDelete, dbClear,
  dbGetSetting, dbSetSetting, isIndexedDBAvailable
} from './db.js';

const STORAGE_PREFIX = 'sw_';
const listeners = new Map();

let state = {
  transactions: [],
  budgets: [],
  savingsGoals: [],
  recurringList: [],
  settings: { currency: '৳', theme: 'dark', dateFormat: 'YYYY-MM-DD' },
  // Business mode state
  appMode: 'personal', // 'personal' | 'business'
  businessProfile: null, // { id: 'profile', name, type, taxId, address, phone }
  businessTransactions: [],
  businessCategories: []
};

let _storageMode = 'localStorage'; // 'indexeddb' | 'localStorage'

// ===== PERSISTENCE (localStorage fallback) =====
function lsLoad(key, def) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) || def; }
  catch { return def; }
}

function lsSave(key, val) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

// ===== INITIALIZATION =====
export async function initStore() {
  const idbReady = await initDB();

  if (idbReady) {
    await migrateFromLocalStorage();
    _storageMode = 'indexeddb';

    // Load from IndexedDB
    const [txns, budgets, savings, recurring, bizProfile, bizTxns, bizCats] = await Promise.all([
      dbGetAll('transactions'),
      dbGetAll('budgets'),
      dbGetAll('savingsGoals'),
      dbGetAll('recurringList'),
      dbGetSetting('businessProfile'),
      dbGetAll('businessTransactions'),
      dbGetAll('businessCategories')
    ]);

    state.transactions = txns || [];
    state.budgets = budgets || [];
    state.savingsGoals = savings || [];
    state.recurringList = recurring || [];
    state.businessProfile = bizProfile || null;
    state.businessTransactions = bizTxns || [];
    state.businessCategories = bizCats || [];

    // Load settings
    const settingsKeys = ['currency', 'theme', 'dateFormat', 'appMode'];
    for (const key of settingsKeys) {
      const val = await dbGetSetting(key);
      if (val !== undefined) state.settings[key] = val;
    }
    // Load appMode from settings or default
    const savedMode = await dbGetSetting('appMode');
    if (savedMode) state.appMode = savedMode;
  } else {
    _storageMode = 'localStorage';
    // Fallback to localStorage
    state.transactions = lsLoad('transactions', []);
    state.budgets = lsLoad('budgets', []);
    state.savingsGoals = lsLoad('savings', []);
    state.recurringList = lsLoad('recurring', []);
    state.settings = lsLoad('settings', state.settings);
    state.appMode = lsLoad('appMode', 'personal');
    state.businessProfile = lsLoad('businessProfile', null);
    state.businessTransactions = lsLoad('businessTransactions', []);
    state.businessCategories = lsLoad('businessCategories', []);
  }
}

// ===== PERSISTENCE =====
async function persist() {
  if (_storageMode === 'indexeddb') {
    await Promise.all([
      dbPutAll('transactions', state.transactions),
      dbPutAll('budgets', state.budgets),
      dbPutAll('savingsGoals', state.savingsGoals),
      dbPutAll('recurringList', state.recurringList),
      dbSetSetting('currency', state.settings.currency),
      dbSetSetting('theme', state.settings.theme),
      dbSetSetting('dateFormat', state.settings.dateFormat),
      dbSetSetting('appMode', state.appMode),
      dbSetSetting('businessProfile', state.businessProfile),
      dbPutAll('businessTransactions', state.businessTransactions),
      dbPutAll('businessCategories', state.businessCategories)
    ]);
  } else {
    lsSave('transactions', state.transactions);
    lsSave('budgets', state.budgets);
    lsSave('savings', state.savingsGoals);
    lsSave('recurring', state.recurringList);
    lsSave('settings', state.settings);
    lsSave('appMode', state.appMode);
    lsSave('businessProfile', state.businessProfile);
    lsSave('businessTransactions', state.businessTransactions);
    lsSave('businessCategories', state.businessCategories);
  }
}

function persistSync() {
  // Synchronous fallback for non-async contexts
  if (_storageMode !== 'indexeddb') {
    lsSave('transactions', state.transactions);
    lsSave('budgets', state.budgets);
    lsSave('savings', state.savingsGoals);
    lsSave('recurring', state.recurringList);
    lsSave('settings', state.settings);
    lsSave('appMode', state.appMode);
    lsSave('businessProfile', state.businessProfile);
    lsSave('businessTransactions', state.businessTransactions);
    lsSave('businessCategories', state.businessCategories);
  } else {
    // Fire-and-forget async persist
    persist();
  }
}

// ===== SUBSCRIPTION SYSTEM =====
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

function notify(key) {
  if (listeners.has(key)) listeners.get(key).forEach(fn => fn(state[key]));
  if (listeners.has('*')) listeners.get('*').forEach(fn => fn(state));
}

// ===== GETTERS (return copies to prevent external mutation) =====
export function getTransactions() { return [...state.transactions]; }
export function getBudgets() { return [...state.budgets]; }
export function getSavingsGoals() { return [...state.savingsGoals]; }
export function getRecurringList() { return [...state.recurringList]; }
export function getSettings() { return { ...state.settings }; }
export function getStorageMode() { return _storageMode; }
export function getAppMode() { return state.appMode; }
export function getBusinessProfile() { return state.businessProfile ? { ...state.businessProfile } : null; }
export function getBusinessTransactions() { return [...state.businessTransactions]; }
export function getBusinessCategories() { return [...state.businessCategories]; }

// ===== TRANSACTIONS =====
export function addTransaction(data) {
  state.transactions.push(data);
  persistSync(); notify('transactions');
}

export function updateTransaction(id, data) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx >= 0) {
    state.transactions[idx] = { ...state.transactions[idx], ...data };
    persistSync(); notify('transactions');
    return true;
  }
  return false;
}

export function deleteTransaction(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx >= 0) {
    const removed = state.transactions.splice(idx, 1)[0];
    persistSync(); notify('transactions');
    return removed;
  }
  return null;
}

export function restoreTransaction(item) {
  if (item && item.id) {
    state.transactions.push(item);
    persistSync(); notify('transactions');
  }
}

// ===== BUDGETS =====
export function addBudget(data) {
  state.budgets.push(data);
  persistSync(); notify('budgets');
}

export function updateBudget(id, data) {
  const idx = state.budgets.findIndex(b => b.id === id);
  if (idx >= 0) {
    state.budgets[idx] = { ...state.budgets[idx], ...data };
    persistSync(); notify('budgets');
    return true;
  }
  return false;
}

export function deleteBudget(id) {
  const removed = state.budgets.find(b => b.id === id);
  state.budgets = state.budgets.filter(b => b.id !== id);
  persistSync(); notify('budgets');
  return removed;
}

// ===== SAVINGS GOALS =====
export function addGoal(data) {
  state.savingsGoals.push(data);
  persistSync(); notify('savingsGoals');
}

export function updateGoal(id, data) {
  const idx = state.savingsGoals.findIndex(g => g.id === id);
  if (idx >= 0) {
    state.savingsGoals[idx] = { ...state.savingsGoals[idx], ...data };
    persistSync(); notify('savingsGoals');
    return true;
  }
  return false;
}

export function deleteGoal(id) {
  const removed = state.savingsGoals.find(g => g.id === id);
  state.savingsGoals = state.savingsGoals.filter(g => g.id !== id);
  persistSync(); notify('savingsGoals');
  return removed;
}

// ===== RECURRING =====
export function addRecurring(data) {
  state.recurringList.push(data);
  persistSync(); notify('recurringList');
}

export function updateRecurring(id, data) {
  const idx = state.recurringList.findIndex(r => r.id === id);
  if (idx >= 0) {
    state.recurringList[idx] = { ...state.recurringList[idx], ...data };
    persistSync(); notify('recurringList');
    return true;
  }
  return false;
}

export function deleteRecurring(id) {
  const removed = state.recurringList.find(r => r.id === id);
  state.recurringList = state.recurringList.filter(r => r.id !== id);
  persistSync(); notify('recurringList');
  return removed;
}

export function toggleRecurringActive(id) {
  const r = state.recurringList.find(x => x.id === id);
  if (r) { r.active = !r.active; persistSync(); notify('recurringList'); }
}

// ===== SETTINGS =====
export function updateSettings(key, value) {
  state.settings[key] = value;
  persistSync(); notify('settings');
}

// ===== APP MODE =====
export function setAppMode(mode) {
  state.appMode = mode;
  persistSync(); notify('appMode');
}

// ===== BUSINESS PROFILE =====
export function setBusinessProfile(data) {
  state.businessProfile = { ...data, id: 'profile' };
  persistSync(); notify('businessProfile');
}

export function clearBusinessProfile() {
  state.businessProfile = null;
  persistSync(); notify('businessProfile');
}

// ===== BUSINESS TRANSACTIONS =====
export function addBusinessTransaction(data) {
  state.businessTransactions.push(data);
  persistSync(); notify('businessTransactions');
}

export function updateBusinessTransaction(id, data) {
  const idx = state.businessTransactions.findIndex(t => t.id === id);
  if (idx >= 0) {
    state.businessTransactions[idx] = { ...state.businessTransactions[idx], ...data };
    persistSync(); notify('businessTransactions');
    return true;
  }
  return false;
}

export function deleteBusinessTransaction(id) {
  const idx = state.businessTransactions.findIndex(t => t.id === id);
  if (idx >= 0) {
    const removed = state.businessTransactions.splice(idx, 1)[0];
    persistSync(); notify('businessTransactions');
    return removed;
  }
  return null;
}

// ===== BUSINESS CATEGORIES =====
export function addBusinessCategory(data) {
  state.businessCategories.push(data);
  persistSync(); notify('businessCategories');
}

export function updateBusinessCategory(id, data) {
  const idx = state.businessCategories.findIndex(c => c.id === id);
  if (idx >= 0) {
    state.businessCategories[idx] = { ...state.businessCategories[idx], ...data };
    persistSync(); notify('businessCategories');
    return true;
  }
  return false;
}

export function deleteBusinessCategory(id) {
  const removed = state.businessCategories.find(c => c.id === id);
  state.businessCategories = state.businessCategories.filter(c => c.id !== id);
  persistSync(); notify('businessCategories');
  return removed;
}

// ===== BULK OPERATIONS =====
export function addBulkTransactions(items) {
  state.transactions.push(...items);
  persistSync(); notify('transactions');
}

export function replaceAllData(data) {
  if (data.transactions) state.transactions = data.transactions;
  if (data.budgets) state.budgets = data.budgets;
  if (data.savingsGoals) state.savingsGoals = data.savingsGoals;
  if (data.recurringList) state.recurringList = data.recurringList;
  if (data.businessProfile) state.businessProfile = data.businessProfile;
  if (data.businessTransactions) state.businessTransactions = data.businessTransactions;
  if (data.businessCategories) state.businessCategories = data.businessCategories;
  persistSync();
  notify('transactions'); notify('budgets'); notify('savingsGoals'); notify('recurringList');
  notify('businessProfile'); notify('businessTransactions'); notify('businessCategories');
}

export function clearAllData() {
  state.transactions = [];
  state.budgets = [];
  state.savingsGoals = [];
  state.recurringList = [];
  state.businessProfile = null;
  state.businessTransactions = [];
  state.businessCategories = [];
  persistSync();
  // Clear security data
  localStorage.removeItem('sw_salt');
  localStorage.removeItem('sw_pin_hash');
  localStorage.removeItem('sw_lock');
  localStorage.removeItem('sw_lock_attempts');
  localStorage.removeItem('sw_lock_timeout');
  // Clear IndexedDB if available
  if (_storageMode === 'indexeddb') {
    dbClear('transactions');
    dbClear('budgets');
    dbClear('savingsGoals');
    dbClear('recurringList');
    dbClear('businessTransactions');
    dbClear('businessCategories');
  }
  notify('transactions'); notify('budgets'); notify('savingsGoals'); notify('recurringList');
  notify('businessProfile'); notify('businessTransactions'); notify('businessCategories');
}
