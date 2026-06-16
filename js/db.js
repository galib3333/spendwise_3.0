// ===== IndexedDB STORAGE ADAPTER =====
// Falls back to localStorage if IndexedDB is unavailable

const DB_NAME = 'spendwise';
const DB_VERSION = 3;
const STORES = ['transactions', 'budgets', 'savingsGoals', 'recurringList', 'settings', 'businessProfile', 'businessTransactions', 'businessCategories', 'bankAccounts', 'bankTransactions'];

let db = null;
let useIndexedDB = true;

// ===== INITIALIZATION =====
export async function initDB() {
  try {
    if (!window.indexedDB) {
      useIndexedDB = false;
      return false;
    }

    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        useIndexedDB = false;
        reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        for (const storeName of STORES) {
          if (!database.objectStoreNames.contains(storeName)) {
            if (storeName === 'settings') {
              database.createObjectStore('settings');
            } else if (storeName === 'businessProfile') {
              database.createObjectStore('businessProfile');
            } else {
              database.createObjectStore(storeName, { keyPath: 'id' });
            }
          }
        }
      };
    });
    return true;
  } catch (e) {
    console.warn('IndexedDB init failed, using localStorage:', e);
    useIndexedDB = false;
    return false;
  }
}

// ===== GENERIC OPERATIONS =====
function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbPutAll(storeName, items) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error(`idbPutAll(${storeName}) transaction error:`, tx.error);
        reject(tx.error);
      };
      tx.onabort = () => {
        console.error(`idbPutAll(${storeName}) transaction aborted:`, tx.error);
        reject(tx.error || new Error('Transaction aborted'));
      };
    } catch (e) {
      console.error(`idbPutAll(${storeName}) failed:`, e);
      reject(e);
    }
  });
}

function idbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbClear(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Settings: key-value store
function idbGetSetting(key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(undefined);
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbSetSetting(key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== PUBLIC API =====
export async function dbGetAll(storeName) {
  if (!useIndexedDB || !db) return null;
  try {
    return await idbGetAll(storeName);
  } catch (err) {
    console.error(`dbGetAll(${storeName}) failed:`, err);
    return null;
  }
}

export async function dbPut(storeName, data) {
  if (!useIndexedDB || !db) return false;
  try {
    await idbPut(storeName, data);
    return true;
  } catch (err) {
    console.error(`dbPut(${storeName}) failed:`, err);
    return false;
  }
}

export async function dbPutAll(storeName, items) {
  if (!useIndexedDB || !db) return false;
  try {
    await idbPutAll(storeName, items);
    return true;
  } catch (err) {
    console.error(`dbPutAll(${storeName}) failed:`, err);
    return false;
  }
}

export async function dbDelete(storeName, id) {
  if (!useIndexedDB || !db) return false;
  try {
    await idbDelete(storeName, id);
    return true;
  } catch (err) {
    console.error(`dbDelete(${storeName}) failed:`, err);
    return false;
  }
}

export async function dbClear(storeName) {
  if (!useIndexedDB || !db) return false;
  try {
    await idbClear(storeName);
    return true;
  } catch (err) {
    console.error(`dbClear(${storeName}) failed:`, err);
    return false;
  }
}

export async function dbGetSetting(key) {
  if (!useIndexedDB || !db) return undefined;
  try {
    return await idbGetSetting(key);
  } catch (err) {
    console.error(`dbGetSetting(${key}) failed:`, err);
    return undefined;
  }
}

export async function dbSetSetting(key, value) {
  if (!useIndexedDB || !db) return false;
  try {
    await idbSetSetting(key, value);
    return true;
  } catch (err) {
    console.error(`dbSetSetting(${key}) failed:`, err);
    return false;
  }
}

export function isIndexedDBAvailable() {
  return useIndexedDB && db !== null;
}

// ===== MIGRATION FROM localStorage =====
export async function migrateFromLocalStorage() {
  if (!useIndexedDB || !db) return false;

  try {
    // Check if already migrated
    const migrated = await idbGetSetting('_migrated');
    if (migrated) return true;

    // Migrate each store
    for (const storeName of STORES) {
      if (storeName === 'settings') continue;

      const key = 'sw_' + (storeName === 'savingsGoals' ? 'savings' : storeName === 'recurringList' ? 'recurring' : storeName);
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await idbPutAll(storeName, parsed);
        }
      }
    }

    // Migrate settings
    const settingsData = localStorage.getItem('sw_settings');
    if (settingsData) {
      const settings = JSON.parse(settingsData);
      for (const [key, value] of Object.entries(settings)) {
        await idbSetSetting(key, value);
      }
    }

    // Mark as migrated
    await idbSetSetting('_migrated', true);

    return true;
  } catch (e) {
    console.warn('Migration failed:', e);
    return false;
  }
}
