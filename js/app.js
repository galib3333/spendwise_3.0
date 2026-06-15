// ===== MAIN APPLICATION ENTRY POINT =====
import { initStore, getSettings, updateSettings, addTransaction, getTransactions, getRecurringList, addBulkTransactions, updateRecurring, addRecurring, getAppMode, setAppMode } from './store.js';
import { initRouter, navigate, registerPage } from './router.js';
import { initModals } from './modals.js';
import { setChartUtils } from './charts.js';
import { fmt, fmtShort, EXPENSE_CATS, validateTransaction, uid, today } from './utils.js';
import { applyTheme } from './pages/settings.js';
import { toastSuccess, toastError, toastWarning } from './toast.js';
import { initLockScreen, lockApp, resetLockTimer, stopLockTimer } from './lockscreen.js';
import { initKeyboardShortcuts } from './shortcuts.js';
import { shouldShowOnboarding, showOnboarding } from './onboarding.js';

const BLUR_DELAY_MS = 2000;
const MS_PER_DAY = 86400000;
const BACKUP_REMINDER_DELAY_MS = 5000;
const ONBOARDING_DELAY_MS = 1000;
const LAST_BACKUP_KEY = 'sw_last_backup';
const BACKUP_REMINDER_DAYS = 7;

// ===== GLOBAL ERROR HANDLER =====
function setupErrorHandling() {
  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    toastError('Something went wrong. Please reload the page.');
    event.preventDefault();
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    toastError('An operation failed. Please try again.');
    event.preventDefault();
  });
}

// Page imports
import { renderDashboard } from './pages/dashboard.js';
import { renderTransactions } from './pages/transactions.js';
import { renderWeekly, renderMonthly, renderYearly } from './pages/reports.js';
import { renderBudgets } from './pages/budgets.js';
import { renderRecurring } from './pages/recurring.js';
import { renderSavings } from './pages/savings.js';
import { renderExport } from './pages/export-page.js';
import { renderSettings } from './pages/settings.js';
import { renderBusiness, renderBizExpenses, renderBizSales, renderBizReports } from './pages/business.js';

// ===== RECURRING PROCESSING =====
function processRecurring() {
  const now = today();
  const newTransactions = [];
  const recurringList = getRecurringList();

  recurringList.forEach(r => {
    if(!r.active) return;
    if(r.nextDate <= now) {
      // Skip if past end date
      if(r.endDate && r.nextDate > r.endDate) return;

      newTransactions.push({
        id: uid(),
        type: 'expense',
        amount: r.amount,
        date: r.nextDate,
        category: r.category,
        payment: 'auto',
        description: r.description + ' (auto)',
        tags: ['recurring'],
        recurring: true,
        frequency: r.frequency
      });

      const d = new Date(r.nextDate + 'T00:00:00');
      switch(r.frequency) {
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      }
      const nextDateStr = d.toISOString().slice(0, 10);

      // If past end date, deactivate instead of advancing
      if(r.endDate && nextDateStr > r.endDate) {
        updateRecurring(r.id, { active: false, nextDate: nextDateStr });
      } else {
        updateRecurring(r.id, { nextDate: nextDateStr });
      }
    }
  });

  if(newTransactions.length) addBulkTransactions(newTransactions);
}

// ===== AUTO-LOCK & LIFECYCLE =====
let _unlocked = false;
let _lockPaused = false;
let _isUnloading = false;

function startAutoLock() {
  _unlocked = true;
  const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  const resetTimer = () => {
    if(_lockPaused || !isLockEnabled() || isLocked()) return;
    resetLockTimer(lockApp);
  };
  activityEvents.forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));
  resetLockTimer(lockApp);
}

function setupLifecycleLocks() {
  // Expose pause/resume for file dialogs (import/export)
  window.__pauseAutoLock = () => { _lockPaused = true; stopLockTimer(); };
  window.__resumeAutoLock = () => { _lockPaused = false; if(isLockEnabled() && !isLocked()) resetLockTimer(lockApp); };

  // Detect page unload — skip lock flash on reload
  window.addEventListener('beforeunload', () => { _isUnloading = true; });

  // Lock on tab hide (only after first unlock, not on page unload)
  document.addEventListener('visibilitychange', () => {
    if(!_unlocked || _lockPaused || _isUnloading) return;
    if(document.hidden && isLockEnabled() && !isLocked()) {
      lockApp();
    }
  });

  // Lock on window blur (mobile: user switches app) — with delay to avoid false triggers
  let _blurTimeout = null;
  window.addEventListener('blur', () => {
    if(!_unlocked || _lockPaused) return;
    if(!isLockEnabled() || isLocked()) return;
    _blurTimeout = setTimeout(() => {
      if(!_lockPaused && isLockEnabled() && !isLocked()) lockApp();
    }, BLUR_DELAY_MS);
  });
  window.addEventListener('focus', () => {
    if(_blurTimeout) { clearTimeout(_blurTimeout); _blurTimeout = null; }
  });
}

// ===== QUICK ADD FAB =====
function setupQuickAdd() {
  const fab = document.getElementById('fabQuickAdd');
  const quickOverlay = document.getElementById('quickAddOverlay');
  const quickCat = document.getElementById('quickCategory');
  if(quickCat) {
    quickCat.innerHTML = EXPENSE_CATS.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }

  function openQuickAdd() {
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickDesc').value = '';
    document.getElementById('quickPayment').value = 'cash';
    if(quickCat) quickCat.value = 'food';
    quickOverlay?.classList.add('show');
    document.getElementById('quickAmount')?.focus();
  }

  function closeQuickAdd() {
    quickOverlay?.classList.remove('show');
  }

  fab?.addEventListener('click', openQuickAdd);
  document.getElementById('quickAddClose')?.addEventListener('click', closeQuickAdd);
  document.getElementById('quickAddCancel')?.addEventListener('click', closeQuickAdd);
  quickOverlay?.addEventListener('click', e => { if(e.target === quickOverlay) closeQuickAdd(); });

  document.getElementById('quickAddSave')?.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const category = document.getElementById('quickCategory').value;
    const description = document.getElementById('quickDesc').value.trim();
    const payment = document.getElementById('quickPayment').value;
    const date = today();

    const errors = validateTransaction({ amount, date, category, type: 'expense', payment });
    if(errors.length) { toastError(errors[0]); return; }

    addTransaction({ id: uid(), type: 'expense', amount, date, category, payment, description, tags: [], recurring: false, frequency: null });
    toastSuccess('Expense added');
    closeQuickAdd();
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeQuickAdd();
  });
}

// ===== THEME TOGGLE =====
function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if(themeToggle) {
    themeToggle.addEventListener('click', () => {
      const s = getSettings();
      const newTheme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      themeToggle.classList.toggle('active', newTheme === 'dark');
      updateSettings('theme', newTheme);
    });
  }
}

// ===== MODE TOGGLE =====
const PERSONAL_NAV = `
  <div class="nav-item active" data-page="dashboard" role="menuitem" tabindex="0" aria-current="page">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    Dashboard
  </div>
  <div class="nav-item" data-page="transactions" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>
    Transactions
  </div>
  <div class="nav-section" role="separator">Analysis</div>
  <div class="nav-item" data-page="weekly" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
    Weekly Report
  </div>
  <div class="nav-item" data-page="monthly" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h7"/><path d="M16 2v4M8 2v4"/></svg>
    Monthly Report
  </div>
  <div class="nav-item" data-page="yearly" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    Yearly Report
  </div>
  <div class="nav-section" role="separator">Planning</div>
  <div class="nav-item" data-page="budgets" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    Budgets
  </div>
  <div class="nav-item" data-page="recurring" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-8.36L1 10"/></svg>
    Recurring
  </div>
  <div class="nav-item" data-page="savings" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
    Savings Goals
  </div>
  <div class="nav-section" role="separator">Tools</div>
  <div class="nav-item" data-page="export" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Export Data
  </div>
  <div class="nav-item" data-page="settings" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    Settings
  </div>
`;

const BUSINESS_NAV = `
  <div class="nav-item active" data-page="business" role="menuitem" tabindex="0" aria-current="page">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
    Business Home
  </div>
  <div class="nav-section" role="separator">Operations</div>
  <div class="nav-item" data-page="biz-expenses" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    Expenses
  </div>
  <div class="nav-item" data-page="biz-sales" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    Sales
  </div>
  <div class="nav-section" role="separator">Reports</div>
  <div class="nav-item" data-page="biz-reports" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h7"/><path d="M16 2v4M8 2v4"/></svg>
    Reports
  </div>
  <div class="nav-section" role="separator">Tools</div>
  <div class="nav-item" data-page="export" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Export Data
  </div>
  <div class="nav-item" data-page="settings" role="menuitem" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    Settings
  </div>
`;

function setupModeToggle() {
  const modeToggle = document.getElementById('modeToggle');
  const nav = document.getElementById('mainNav');
  if(!modeToggle || !nav) return;

  const currentMode = getAppMode();
  updateModeUI(currentMode);

  modeToggle.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if(mode === getAppMode()) return;
      setAppMode(mode);
      updateModeUI(mode);
      // Navigate to appropriate home page
      navigate(mode === 'business' ? 'business' : 'dashboard');
    });
  });

  function updateModeUI(mode) {
    modeToggle.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
      b.setAttribute('aria-selected', b.dataset.mode === mode);
    });
    nav.innerHTML = mode === 'business' ? BUSINESS_NAV : PERSONAL_NAV;
    // Rebind nav item clicks
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
      item.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(item.dataset.page);
        }
      });
    });
  }
}

// ===== BACKUP REMINDER =====
function checkBackupReminder() {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  const now = Date.now();

  if (!lastBackup || (now - parseInt(lastBackup)) > BACKUP_REMINDER_DAYS * MS_PER_DAY) {
    setTimeout(() => {
      toastWarning('Consider backing up your data. Go to Export to download a backup.', {
        duration: BACKUP_REMINDER_DELAY_MS,
        action: () => {
          navigate('export');
          localStorage.setItem(LAST_BACKUP_KEY, String(now));
        },
        actionLabel: 'Backup Now'
      });
    }, 5000);
  }
}

export function markBackupDone() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}

// ===== MIGRATION: Sync orphaned recurring transactions =====
function syncOrphanedRecurring() {
  const txns = getTransactions();
  const recurringList = getRecurringList();
  const seen = new Set();
  const newItems = [];

  txns.forEach(t => {
    if(!t.recurring || t.type !== 'expense') return;
    const key = `${t.description}|${t.amount}|${t.category}|${t.frequency}`;
    if(seen.has(key)) return;
    seen.add(key);

    const hasEntry = recurringList.some(r =>
      r.amount === t.amount &&
      r.description === t.description &&
      r.category === t.category &&
      r.frequency === t.frequency
    );
    if(hasEntry) return;

    const freq = t.frequency || 'monthly';
    const next = new Date(t.date + 'T00:00:00');
    switch(freq) {
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'biweekly': next.setDate(next.getDate() + 14); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
      case 'quarterly': next.setMonth(next.getMonth() + 3); break;
      case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
    }
    newItems.push({
      id: uid(),
      amount: t.amount,
      description: t.description,
      frequency: freq,
      category: t.category,
      startDate: t.date,
      nextDate: next.toISOString().slice(0, 10),
      endDate: null,
      active: true
    });
  });

  if(newItems.length) {
    newItems.forEach(item => addRecurring(item));
  }
}

// ===== INITIALIZE =====
async function init() {
  setupErrorHandling();
  await initStore();

  const settings = getSettings();
  setChartUtils(
    (n, c) => fmt(n, c || settings.currency),
    (n, c) => fmtShort(n, c || settings.currency)
  );

  registerPage('dashboard', renderDashboard);
  registerPage('transactions', renderTransactions);
  registerPage('weekly', renderWeekly);
  registerPage('monthly', renderMonthly);
  registerPage('yearly', renderYearly);
  registerPage('budgets', renderBudgets);
  registerPage('recurring', renderRecurring);
  registerPage('savings', renderSavings);
  registerPage('export', renderExport);
  registerPage('settings', renderSettings);
  registerPage('business', renderBusiness);
  registerPage('biz-expenses', renderBizExpenses);
  registerPage('biz-sales', renderBizSales);
  registerPage('biz-reports', renderBizReports);

  initModals();
  initRouter();
  applyTheme();
  syncOrphanedRecurring();
  processRecurring();
  setupThemeToggle();
  setupModeToggle();
  setupQuickAdd();
  setupLifecycleLocks();

  // Hide main content until unlocked
  const mainEl = document.getElementById('mainContent');
  if(mainEl) mainEl.style.visibility = 'hidden';

  // Init lock screen — blocks until unlocked
  initLockScreen(() => {
    if(mainEl) mainEl.style.visibility = 'visible';
    // Navigate to correct home page based on mode
    const startPage = getAppMode() === 'business' ? 'business' : 'dashboard';
    navigate(startPage);
    startAutoLock();
    checkBackupReminder();
    initKeyboardShortcuts();

    // Show onboarding for first-time users
    if (shouldShowOnboarding()) {
      setTimeout(() => showOnboarding(), ONBOARDING_DELAY_MS);
    }
  });
}

// Run when DOM is ready
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Register Service Worker
if('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
