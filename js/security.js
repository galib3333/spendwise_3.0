// ===== SECURITY MODULE =====
// Web Crypto API encryption + PIN hashing + biometric support

const SALT_KEY = 'sw_salt';
const HASH_KEY = 'sw_pin_hash';
const LOCK_KEY = 'sw_lock';
const ATTEMPTS_KEY = 'sw_lock_attempts';

// ===== PIN MANAGEMENT =====
export function hasPIN() {
  return localStorage.getItem(HASH_KEY) !== null;
}

function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPIN(pin, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setupPIN(pin) {
  if(!pin || pin.length < 4 || pin.length > 8) return false;
  if(!/^\d+$/.test(pin)) return false;
  const salt = generateSalt();
  const hash = await hashPIN(pin, salt);
  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(HASH_KEY, hash);
  setLockEnabled(true);
  return true;
}

export async function verifyPIN(pin) {
  const salt = localStorage.getItem(SALT_KEY);
  const storedHash = localStorage.getItem(HASH_KEY);
  if(!salt || !storedHash) return false;
  const hash = await hashPIN(pin, salt);
  if(hash === storedHash) {
    resetAttempts();
    return true;
  }
  incrementAttempts();
  return false;
}

export function removePIN() {
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
  setLockEnabled(false);
}

// ===== LOCK STATE =====
export function isLockEnabled() {
  return localStorage.getItem(LOCK_KEY) !== 'false' && hasPIN();
}

export function setLockEnabled(val) {
  localStorage.setItem(LOCK_KEY, val ? 'true' : 'false');
}

let _isLocked = true;
export function isLocked() { return _isLocked && isLockEnabled(); }
export function setLocked(val) { _isLocked = val; }

// ===== ATTEMPT TRACKING =====
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

function getAttempts() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || { count: 0, lockedUntil: 0 }; }
  catch { return { count: 0, lockedUntil: 0 }; }
}

function saveAttempts(data) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
}

function incrementAttempts() {
  const a = getAttempts();
  a.count++;
  if(a.count >= MAX_ATTEMPTS) a.lockedUntil = Date.now() + LOCKOUT_MS;
  saveAttempts(a);
}

function resetAttempts() {
  saveAttempts({ count: 0, lockedUntil: 0 });
}

export function isLockedOut() {
  const a = getAttempts();
  if(a.lockedUntil > Date.now()) return true;
  if(a.lockedUntil > 0 && a.lockedUntil <= Date.now()) {
    resetAttempts();
  }
  return false;
}

export function getRemainingLockoutMs() {
  const a = getAttempts();
  return Math.max(0, a.lockedUntil - Date.now());
}

// ===== ENCRYPTION (AES-GCM via Web Crypto API) =====
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data, password) {
  const salt = generateSalt();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveKey(password, salt);
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  return {
    salt,
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
    version: 1
  };
}

export async function decryptData(encrypted, password) {
  try {
    const salt = encrypted.salt;
    const iv = new Uint8Array(encrypted.iv.match(/.{2}/g).map(b => parseInt(b, 16)));
    const data = new Uint8Array(encrypted.data.match(/.{2}/g).map(b => parseInt(b, 16)));
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

// ===== AUTO-LOCK TIMER =====
let _lockTimer = null;
let _lockTimeoutMs = 5 * 60 * 1000;

export function setLockTimeout(ms) {
  _lockTimeoutMs = ms;
  localStorage.setItem('sw_lock_timeout', String(ms));
}

export function getLockTimeout() {
  const saved = localStorage.getItem('sw_lock_timeout');
  return saved ? parseInt(saved) : _lockTimeoutMs;
}

export function startLockTimer(onLock) {
  stopLockTimer();
  if(!isLockEnabled()) return;
  const timeout = getLockTimeout();
  _lockTimer = setTimeout(() => {
    if(typeof onLock === 'function') onLock();
  }, timeout);
}

export function stopLockTimer() {
  if(_lockTimer) { clearTimeout(_lockTimer); _lockTimer = null; }
}

export function resetLockTimer(onLock) {
  stopLockTimer();
  startLockTimer(onLock);
}

// ===== PRIVACY POLICY =====
export function getPrivacyPolicy() {
  return `
# SpendWise — Privacy Policy

Last updated: ${new Date().toISOString().slice(0,10)}

## Data Collection
SpendWise does **NOT** collect, store, or transmit any personal data to external servers. All data is stored locally on your device.

## Data Storage
- All financial data (transactions, budgets, savings goals) is stored in your browser's local storage or device storage
- No data is sent to any server, cloud service, or third party
- No analytics, tracking, or telemetry is collected

## Security
- Optional PIN lock to protect your data
- Optional encryption of exported backup files
- Data remains entirely on your device

## Permissions
- No internet permission is required for core functionality
- File access is only used when you explicitly export or import data

## Third Parties
SpendWise does not share, sell, or transmit any data to third parties.

## Changes
This privacy policy may be updated. Any changes will be reflected in the app.

## Contact
For questions about this privacy policy, please open an issue at the project repository.
`;
}
