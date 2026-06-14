// ===== SETTINGS PAGE =====
import { getSettings, updateSettings, clearAllData } from '../store.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess } from '../toast.js';
import { hasPIN, isLockEnabled, getLockTimeout, setLockTimeout, getPrivacyPolicy } from '../security.js';
import { changePIN, disableLock, showLockScreen } from '../lockscreen.js';

function applyTheme() {
  const settings = getSettings();
  document.documentElement.setAttribute('data-theme', settings.theme);
  const toggle = document.getElementById('themeToggle');
  if(toggle) toggle.classList.toggle('active', settings.theme === 'dark');
}

function toggleTheme() {
  const settings = getSettings();
  const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
  updateSettings('theme', newTheme);
  applyTheme();
}

export function renderSettings(container) {
  const settings = getSettings();
  const lockEnabled = isLockEnabled();
  const pinSet = hasPIN();
  const lockTimeout = getLockTimeout();

  container.innerHTML = `
    <div class="fade-in">
      <div class="header"><h2>Settings</h2></div>
      <div class="panel" style="max-width:500px">
        <h3 style="margin-bottom:20px">Preferences</h3>
        <div class="input-group">
          <label for="settingCurrency">Currency Symbol</label>
          <select class="input" id="settingCurrency">
            <option value="₹" ${settings.currency === '₹' ? 'selected' : ''}>₹ (Indian Rupee)</option>
            <option value="$" ${settings.currency === '$' ? 'selected' : ''}>$ (US Dollar)</option>
            <option value="€" ${settings.currency === '€' ? 'selected' : ''}>€ (Euro)</option>
            <option value="£" ${settings.currency === '£' ? 'selected' : ''}>£ (British Pound)</option>
            <option value="¥" ${settings.currency === '¥' ? 'selected' : ''}>¥ (Japanese Yen)</option>
            <option value="৳" ${settings.currency === '৳' ? 'selected' : ''}>৳ (Bangladeshi Taka)</option>
          </select>
        </div>
        <div class="input-group">
          <label for="settingDateFormat">Date Format</label>
          <select class="input" id="settingDateFormat">
            <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD (2026-06-12)</option>
            <option value="MM/DD/YYYY" ${settings.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY (06/12/2026)</option>
            <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY (12/06/2026)</option>
            <option value="DD.MM.YYYY" ${settings.dateFormat === 'DD.MM.YYYY' ? 'selected' : ''}>DD.MM.YYYY (12.06.2026)</option>
          </select>
        </div>
        <div class="input-group">
          <label>Theme</label>
          <div class="flex flex-center gap-8">
            <span class="text-sm">Light</span>
            <div class="toggle ${settings.theme === 'dark' ? 'active' : ''}" id="themeToggleSettings" role="switch" aria-checked="${settings.theme === 'dark'}" aria-label="Toggle dark theme" tabindex="0"></div>
            <span class="text-sm">Dark</span>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <h3 style="margin-bottom:16px">Security</h3>

        <div class="input-group">
          <label>Lock Screen</label>
          <div class="flex flex-center gap-8">
            <span class="text-sm">Disabled</span>
            <div class="toggle ${lockEnabled ? 'active' : ''}" id="lockToggle" role="switch" aria-checked="${lockEnabled}" aria-label="Toggle lock screen" tabindex="0"></div>
            <span class="text-sm">Enabled</span>
          </div>
          <p style="color:var(--text3);font-size:0.72rem;margin:4px 0 0">${pinSet ? 'PIN is set' : 'No PIN set — tap enable to set up'}</p>
        </div>

        <div class="input-group" id="autoLockGroup" style="${lockEnabled ? '' : 'display:none'}">
          <label for="autoLockTimeout">Auto-lock after inactivity</label>
          <select class="input" id="autoLockTimeout">
            <option value="30000" ${lockTimeout === 30000 ? 'selected' : ''}>30 seconds</option>
            <option value="60000" ${lockTimeout === 60000 ? 'selected' : ''}>1 minute</option>
            <option value="300000" ${lockTimeout === 300000 ? 'selected' : ''}>5 minutes</option>
            <option value="600000" ${lockTimeout === 600000 ? 'selected' : ''}>10 minutes</option>
            <option value="1800000" ${lockTimeout === 1800000 ? 'selected' : ''}>30 minutes</option>
          </select>
        </div>

        <div class="flex gap-8" id="pinActions" style="${pinSet ? '' : 'display:none'}">
          <button class="btn btn-secondary" id="changePinBtn">Change PIN</button>
          <button class="btn btn-secondary" id="removePinBtn" style="color:var(--red)">Remove PIN</button>
        </div>

        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <h3 style="margin-bottom:16px">Legal</h3>
        <button class="btn btn-secondary" id="privacyPolicyBtn">Privacy Policy</button>

        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <h3 style="margin-bottom:16px">Danger Zone</h3>
        <button class="btn btn-danger" id="resetDataBtn" aria-label="Delete all data">
          Reset All Data
        </button>
      </div>
    </div>
  `;

  // === Event Listeners ===

  document.getElementById('settingCurrency')?.addEventListener('change', e => {
    updateSettings('currency', e.target.value);
    toastSuccess('Currency updated');
  });

  document.getElementById('settingDateFormat')?.addEventListener('change', e => {
    updateSettings('dateFormat', e.target.value);
    toastSuccess('Date format updated');
  });

  document.getElementById('themeToggleSettings')?.addEventListener('click', () => {
    toggleTheme();
  });

  document.getElementById('themeToggleSettings')?.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  });

  // Lock screen toggle
  document.getElementById('lockToggle')?.addEventListener('click', () => {
    if(isLockEnabled()) {
      disableLock();
      document.getElementById('autoLockGroup').style.display = 'none';
      document.getElementById('pinActions').style.display = 'none';
      document.getElementById('lockToggle').classList.remove('active');
      toastSuccess('Lock screen disabled');
    } else {
      showLockScreen(() => {
        renderSettings(container);
        if(isLockEnabled()) toastSuccess('Lock screen enabled');
      });
    }
  });

  document.getElementById('lockToggle')?.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('lockToggle').click();
    }
  });

  // Auto-lock timeout
  document.getElementById('autoLockTimeout')?.addEventListener('change', e => {
    setLockTimeout(parseInt(e.target.value));
    toastSuccess('Auto-lock updated');
  });

  // Change PIN
  document.getElementById('changePinBtn')?.addEventListener('click', () => {
    changePIN();
  });

  // Remove PIN
  document.getElementById('removePinBtn')?.addEventListener('click', () => {
    if(confirm('Remove PIN lock? Your data will no longer be protected.')) {
      disableLock();
      renderSettings(container);
      toastSuccess('PIN removed');
    }
  });

  // Privacy Policy
  document.getElementById('privacyPolicyBtn')?.addEventListener('click', () => {
    const policy = getPrivacyPolicy();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `<div class="modal" style="max-width:600px;max-height:80vh;overflow-y:auto">
      <h3>Privacy Policy</h3>
      <div style="color:var(--text2);font-size:0.8rem;line-height:1.6;white-space:pre-wrap">${policy}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="privacyCloseBtn">Close</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
    overlay.querySelector('#privacyCloseBtn')?.addEventListener('click', () => overlay.remove());
  });

  // Reset data
  document.getElementById('resetDataBtn')?.addEventListener('click', () => {
    if(confirm('Delete ALL data? This cannot be undone.')) {
      clearAllData();
      toastSuccess('All data cleared');
      applyTheme();
    }
  });
}

export { applyTheme };
