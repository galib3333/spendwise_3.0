// ===== LOCK SCREEN UI =====
import {
  hasPIN, setupPIN, verifyPIN, removePIN,
  isLockEnabled, setLocked,
  isLockedOut, getRemainingLockoutMs,
  startLockTimer, stopLockTimer, resetLockTimer, getLockTimeout, setLockTimeout,
  getPrivacyPolicy
} from './security.js';

const MAX_PIN = 8;
const MIN_PIN = 4;

let _onUnlock = null;
let _pin = '';
let _setupPin = '';
let _step = 'enter'; // enter | setup | confirm | change
let _keyAbort = null;
let _processing = false;

const lockSVG = `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="0" ry="0"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
const unlockSVG = `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="0" ry="0"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>`;

function getPanel() { return document.getElementById('lockPanel'); }
function getScreen() { return document.getElementById('lockScreen'); }

function showError(msg) {
  const el = document.getElementById('lockError');
  if (el) el.textContent = msg;
  document.querySelectorAll('.pin-dot').forEach(d => {
    d.classList.add('error');
    setTimeout(() => d.classList.remove('error'), 400);
  });
}

// ===== DOT RENDERING =====

function renderDots(count, max) {
  if (!max) max = MAX_PIN;
  let html = '<div class="pin-dots">';
  for (let i = 0; i < max; i++) {
    html += `<div class="pin-dot ${i < count ? 'filled' : ''}"></div>`;
  }
  html += '</div>';
  return html;
}

function updateDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < _pin.length);
    dot.classList.remove('error');
  });
}

// ===== PIN PAD =====

function renderPinPad() {
  const keys = ['1','2','3','4','5','6','7','8','9'];
  let html = '<div class="pin-pad">';
  keys.forEach(k => { html += `<button type="button" class="pin-key" data-key="${k}">${k}</button>`; });
  html += `<button type="button" class="pin-key" data-key=""></button>`;
  html += `<button type="button" class="pin-key" data-key="0">0</button>`;
  html += `<button type="button" class="pin-key del" data-key="del">&#x232B;</button>`;
  html += '</div>';
  return html;
}

function isPinReady() {
  if (_step === 'confirm') return _pin.length === _setupPin.length;
  if (_step === 'setup') return _pin.length >= MIN_PIN;
  return false;
}

function handleKeyInput(key) {
  if (_processing) return;
  if (key === 'del') {
    _pin = _pin.slice(0, -1);
  } else if (key !== '' && _pin.length < MAX_PIN) {
    _pin += key;
  }
  updateDots();
  updateContinueBtn();
  if (isPinReady() && _step !== 'setup') handlePinComplete();
}

function bindPinKeys() {
  if (_keyAbort) _keyAbort.abort();
  _keyAbort = new AbortController();
  const signal = _keyAbort.signal;

  document.querySelectorAll('.pin-key').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      handleKeyInput(btn.dataset.key);
    }, { signal });
  });

  document.addEventListener('keydown', e => {
    const screen = getScreen();
    if (!screen?.classList.contains('show')) return;
    if (e.key >= '0' && e.key <= '9') {
      handleKeyInput(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleKeyInput('del');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!_processing && _pin.length >= MIN_PIN && (_step === 'enter' || _step === 'change')) {
        handlePinComplete();
      }
    }
  }, { signal });
}

// ===== SCREEN RENDERERS =====

function renderEnterScreen() {
  const panel = getPanel();
  panel.className = 'lock-panel';
  panel.innerHTML = `
    ${lockSVG}
    <h2>Welcome Back</h2>
    <p>Enter your PIN to unlock</p>
    ${renderDots(_pin.length)}
    <div class="lock-error" id="lockError"></div>
    <div class="lock-actions" style="display:${_pin.length >= MIN_PIN ? 'flex' : 'none'}">
      <button type="button" class="btn btn-primary" id="lockSubmitBtn">Unlock</button>
    </div>
    ${renderPinPad()}
    <div class="lock-footer">
      <button type="button" id="lockPrivacyLink">Privacy Policy</button>
    </div>
  `;
  bindPinKeys();
  document.getElementById('lockPrivacyLink')?.addEventListener('click', showPrivacyModal);
  document.getElementById('lockSubmitBtn')?.addEventListener('click', () => {
    if (!_processing && _pin.length >= MIN_PIN) handlePinComplete();
  });
}

function renderSetupScreen() {
  const panel = getPanel();
  panel.className = 'lock-panel lock-setup';
  panel.innerHTML = `
    ${unlockSVG}
    <h2>Set Up PIN</h2>
    <p>Choose a ${MIN_PIN}-${MAX_PIN} digit PIN</p>
    ${renderDots(_pin.length)}
    <div class="lock-error" id="lockError"></div>
    <div class="lock-actions" style="display:${_pin.length >= MIN_PIN ? 'flex' : 'none'}">
      <button type="button" class="btn btn-primary" id="lockContinueBtn">Continue</button>
    </div>
    ${renderPinPad()}
    <div class="lock-footer">
      <button type="button" id="lockSkipBtn">Skip for now</button>
    </div>
  `;
  bindPinKeys();
  document.getElementById('lockSkipBtn')?.addEventListener('click', skipSetup);
  document.getElementById('lockContinueBtn')?.addEventListener('click', () => {
    if (!_processing) handlePinComplete();
  });
}

function renderConfirmScreen() {
  const panel = getPanel();
  panel.className = 'lock-panel';
  panel.innerHTML = `
    ${unlockSVG}
    <h2>Confirm PIN</h2>
    <p>Re-enter your PIN to confirm</p>
    ${renderDots(_pin.length, _setupPin.length)}
    <div class="lock-error" id="lockError"></div>
    ${renderPinPad()}
  `;
  bindPinKeys();
}

function renderChangeScreen() {
  const panel = getPanel();
  panel.className = 'lock-panel';
  panel.innerHTML = `
    ${lockSVG}
    <h2>Change PIN</h2>
    <p>Enter your current PIN</p>
    ${renderDots(_pin.length)}
    <div class="lock-error" id="lockError"></div>
    <div class="lock-actions" style="display:${_pin.length >= MIN_PIN ? 'flex' : 'none'}">
      <button type="button" class="btn btn-primary" id="lockSubmitBtn">Continue</button>
    </div>
    ${renderPinPad()}
  `;
  bindPinKeys();
  document.getElementById('lockSubmitBtn')?.addEventListener('click', () => {
    if (!_processing && _pin.length >= MIN_PIN) handlePinComplete();
  });
}

function updateContinueBtn() {
  if (_step === 'setup') {
    const actions = document.querySelector('.lock-actions');
    if (actions) actions.style.display = _pin.length >= MIN_PIN ? 'flex' : 'none';
  } else if (_step === 'enter' || _step === 'change') {
    const actions = document.querySelector('.lock-actions');
    if (actions) actions.style.display = _pin.length >= MIN_PIN ? 'flex' : 'none';
  }
}

// ===== STATE MANAGEMENT =====

function resetState() {
  _pin = '';
  _setupPin = '';
  _processing = false;
}

function show(onUnlock) {
  const screen = getScreen();
  if (!screen) return;
  screen.classList.add('show');
  setLocked(true);
  stopLockTimer();
}

function hide() {
  const screen = getScreen();
  if (screen) screen.classList.remove('show');
  if (_keyAbort) { _keyAbort.abort(); _keyAbort = null; }
  _processing = false;
}

function finish(success) {
  resetState();
  hide();
  if (success && _onUnlock) _onUnlock();
}

function skipSetup() {
  resetState();
  setLocked(false);
  hide();
  if (_onUnlock) _onUnlock();
}

// ===== PIN FLOW =====

async function handlePinComplete() {
  if (_processing) return;
  _processing = true;

  if (_step === 'setup') {
    _setupPin = _pin;
    _pin = '';
    _step = 'confirm';
    _processing = false;
    renderConfirmScreen();
    return;
  }

  if (_step === 'confirm') {
    if (_pin === _setupPin) {
      const ok = await setupPIN(_pin);
      if (ok) {
        finish(true);
        return;
      }
      _processing = false;
      showError('Failed to set PIN');
      return;
    }
    showError('PINs do not match');
    _pin = '';
    _processing = false;
    setTimeout(() => {
      _step = 'setup';
      renderSetupScreen();
    }, 800);
    return;
  }

  if (_step === 'enter') {
    if (isLockedOut()) {
      const sec = Math.ceil(getRemainingLockoutMs() / 1000);
      showError(`Too many attempts. Wait ${sec}s`);
      _pin = '';
      _processing = false;
      updateDots();
      return;
    }
    const ok = await verifyPIN(_pin);
    if (ok) {
      finish(true);
      return;
    }
    showError('Incorrect PIN');
    _pin = '';
    _processing = false;
    updateDots();
    return;
  }

  if (_step === 'change') {
    const ok = await verifyPIN(_pin);
    if (ok) {
      _pin = '';
      _step = 'setup';
      _processing = false;
      renderSetupScreen();
      return;
    }
    showError('Incorrect current PIN');
    _pin = '';
    _processing = false;
    updateDots();
    return;
  }

  _processing = false;
}

// ===== PRIVACY POLICY =====

function showPrivacyModal() {
  const policy = getPrivacyPolicy();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `<div class="modal" style="max-width:600px;max-height:80vh;overflow-y:auto">
    <h3>Privacy Policy</h3>
    <div style="color:var(--text2);font-size:0.8rem;line-height:1.6;white-space:pre-wrap">${policy}</div>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="privacyCloseBtn">Close</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#privacyCloseBtn')?.addEventListener('click', () => overlay.remove());
}

// ===== PUBLIC API =====

export function showLockScreen(onUnlock) {
  _onUnlock = onUnlock;
  resetState();
  const screen = getScreen();
  if (!screen) return;

  if (!hasPIN()) {
    _step = 'setup';
    renderSetupScreen();
  } else {
    _step = 'enter';
    renderEnterScreen();
  }

  show(onUnlock);
}

export function lockApp() {
  _onUnlock = null;
  resetState();
  _step = 'enter';
  renderEnterScreen();
  show(null);
}

export function initLockScreen(onUnlock) {
  _onUnlock = onUnlock;
  if (!isLockEnabled()) {
    setLocked(false);
    if (onUnlock) onUnlock();
    return;
  }
  showLockScreen(onUnlock);
}

export function changePIN(onComplete) {
  if (!hasPIN()) return;
  _onUnlock = onComplete || null;
  resetState();
  _step = 'change';
  renderChangeScreen();
  show(onComplete || null);
}

export function disableLock() {
  removePIN();
  resetState();
  setLocked(false);
  hide();
  stopLockTimer();
}

export { resetLockTimer, startLockTimer, stopLockTimer, getLockTimeout, setLockTimeout };
