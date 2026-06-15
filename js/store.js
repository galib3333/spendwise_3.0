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
  businessCategories: [],
  // Banking state
  bankAccounts: [], // { id, provider, name, accountNumber, currentBalance, initialBalance, lastSynced, color }
  bankTransactions: [] // parsed email transactions linked to accounts
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
    const [txns, budgets, savings, recurring, bizProfile, bizTxns, bizCats, bankAccts, bankTxns] = await Promise.all([
      dbGetAll('transactions'),
      dbGetAll('budgets'),
      dbGetAll('savingsGoals'),
      dbGetAll('recurringList'),
      dbGetSetting('businessProfile'),
      dbGetAll('businessTransactions'),
      dbGetAll('businessCategories'),
      dbGetAll('bankAccounts'),
      dbGetAll('bankTransactions')
    ]);

    state.transactions = txns || [];
    state.budgets = budgets || [];
    state.savingsGoals = savings || [];
    state.recurringList = recurring || [];
    state.businessProfile = bizProfile || null;
    state.businessTransactions = bizTxns || [];
    state.businessCategories = bizCats || [];
    state.bankAccounts = bankAccts || [];
    state.bankTransactions = bankTxns || [];

    // Load settings
    const settingsKeys = ['currency', 'theme', 'dateFormat'];
    for (const key of settingsKeys) {
      const val = await dbGetSetting(key);
      if (val !== undefined) state.settings[key] = val;
    }
    // Load appMode
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
    state.bankAccounts = lsLoad('bankAccounts', []);
    state.bankTransactions = lsLoad('bankTransactions', []);
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
      dbPutAll('businessCategories', state.businessCategories),
      dbPutAll('bankAccounts', state.bankAccounts),
      dbPutAll('bankTransactions', state.bankTransactions)
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
    lsSave('bankAccounts', state.bankAccounts);
    lsSave('bankTransactions', state.bankTransactions);
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
    lsSave('bankAccounts', state.bankAccounts);
    lsSave('bankTransactions', state.bankTransactions);
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
export function getBankAccounts() { return [...state.bankAccounts]; }
export function getBankTransactions() { return [...state.bankTransactions]; }

// ===== GENERIC CRUD HELPERS =====
function crudOps(key, stateKey) {
  return {
    add(data) { state[stateKey].push(data); persistSync(); notify(stateKey); },
    update(id, data) {
      const idx = state[stateKey].findIndex(x => x.id === id);
      if (idx >= 0) { state[stateKey][idx] = { ...state[stateKey][idx], ...data }; persistSync(); notify(stateKey); return true; }
      return false;
    },
    remove(id) {
      const idx = state[stateKey].findIndex(x => x.id === id);
      if (idx >= 0) { const removed = state[stateKey].splice(idx, 1)[0]; persistSync(); notify(stateKey); return removed; }
      return null;
    }
  };
}

const transactions = crudOps('transactions', 'transactions');
const budgets = crudOps('budgets', 'budgets');
const savingsGoals = crudOps('savingsGoals', 'savingsGoals');
const recurringList = crudOps('recurringList', 'recurringList');
const businessTxns = crudOps('businessTransactions', 'businessTransactions');
const businessCats = crudOps('businessCategories', 'businessCategories');
const bankAccounts = crudOps('bankAccounts', 'bankAccounts');
const bankTransactions = crudOps('bankTransactions', 'bankTransactions');

// ===== TRANSACTIONS =====
export function addTransaction(data) { transactions.add(data); }
export function updateTransaction(id, data) { return transactions.update(id, data); }
export function deleteTransaction(id) { return transactions.remove(id); }
export function restoreTransaction(item) { if (item && item.id) transactions.add(item); }

// ===== BUDGETS =====
export function addBudget(data) { budgets.add(data); }
export function updateBudget(id, data) { return budgets.update(id, data); }
export function deleteBudget(id) { return budgets.remove(id); }

// ===== SAVINGS GOALS =====
export function addGoal(data) { savingsGoals.add(data); }
export function updateGoal(id, data) { return savingsGoals.update(id, data); }
export function deleteGoal(id) { return savingsGoals.remove(id); }

// ===== RECURRING =====
export function addRecurring(data) { recurringList.add(data); }
export function updateRecurring(id, data) { return recurringList.update(id, data); }
export function deleteRecurring(id) { return recurringList.remove(id); }

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
export function addBusinessTransaction(data) { businessTxns.add(data); }
export function updateBusinessTransaction(id, data) { return businessTxns.update(id, data); }
export function deleteBusinessTransaction(id) { return businessTxns.remove(id); }

// ===== BUSINESS CATEGORIES =====
export function addBusinessCategory(data) { businessCats.add(data); }
export function updateBusinessCategory(id, data) { return businessCats.update(id, data); }
export function deleteBusinessCategory(id) { return businessCats.remove(id); }

// ===== BANK ACCOUNTS =====
export function addBankAccount(data) { bankAccounts.add(data); }
export function updateBankAccount(id, data) { return bankAccounts.update(id, data); }
export function deleteBankAccount(id) {
  const removed = bankAccounts.remove(id);
  if (removed) {
    state.bankTransactions = state.bankTransactions.filter(t => t.bankAccountId !== id);
    persistSync(); notify('bankTransactions');
  }
  return removed;
}

// ===== BANK TRANSACTIONS =====
export function addBankTransaction(data) { bankTransactions.add(data); }
export function addBulkBankTransactions(items) {
  state.bankTransactions.push(...items);
  persistSync(); notify('bankTransactions');
}
export function deleteBankTransaction(id) { return bankTransactions.remove(id); }

export function getBankTransactionsForAccount(accountId) {
  return state.bankTransactions.filter(t => t.bankAccountId === accountId);
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
  if (data.bankAccounts) state.bankAccounts = data.bankAccounts;
  if (data.bankTransactions) state.bankTransactions = data.bankTransactions;
  persistSync();
  notify('transactions'); notify('budgets'); notify('savingsGoals'); notify('recurringList');
  notify('businessProfile'); notify('businessTransactions'); notify('businessCategories');
  notify('bankAccounts'); notify('bankTransactions');
}

export function clearAllData() {
  state.transactions = [];
  state.budgets = [];
  state.savingsGoals = [];
  state.recurringList = [];
  state.businessProfile = null;
  state.businessTransactions = [];
  state.businessCategories = [];
  state.bankAccounts = [];
  state.bankTransactions = [];
  persistSync();
  // Clear security data
  localStorage.removeItem('sw_salt');
  localStorage.removeItem('sw_pin_hash');
  localStorage.removeItem('sw_lock');
  localStorage.removeItem('sw_lock_attempts');
  localStorage.removeItem('sw_lock_timeout');
  // Clear Gmail data
  localStorage.removeItem('sw_gmail_connected');
  // Clear IndexedDB if available
  if (_storageMode === 'indexeddb') {
    dbClear('transactions');
    dbClear('budgets');
    dbClear('savingsGoals');
    dbClear('recurringList');
    dbClear('businessTransactions');
    dbClear('businessCategories');
    dbClear('bankAccounts');
    dbClear('bankTransactions');
  }
  notify('transactions'); notify('budgets'); notify('savingsGoals'); notify('recurringList');
  notify('businessProfile'); notify('businessTransactions'); notify('businessCategories');
  notify('bankAccounts'); notify('bankTransactions');
}
