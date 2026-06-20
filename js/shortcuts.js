// ===== KEYBOARD SHORTCUTS =====
import { navigate } from './router.js';

const SHORTCUTS = [
  { key: '1', ctrl: false, action: () => navigate('dashboard'), label: 'Dashboard' },
  { key: '2', ctrl: false, action: () => navigate('transactions'), label: 'Transactions' },
  { key: '3', ctrl: false, action: () => navigate('weekly'), label: 'Weekly Report' },
  { key: '4', ctrl: false, action: () => navigate('monthly'), label: 'Monthly Report' },
  { key: '5', ctrl: false, action: () => navigate('yearly'), label: 'Yearly Report' },
  { key: '6', ctrl: false, action: () => navigate('budgets'), label: 'Budgets' },
  { key: '7', ctrl: false, action: () => navigate('recurring'), label: 'Recurring' },
  { key: '8', ctrl: false, action: () => navigate('savings'), label: 'Savings Goals' },
  { key: '9', ctrl: false, action: () => navigate('export'), label: 'Export' },
  { key: '0', ctrl: false, action: () => navigate('settings'), label: 'Settings' },
  { key: 'n', ctrl: true, action: () => document.getElementById('fabQuickAdd')?.click(), label: 'Quick Add' },
  { key: '/', ctrl: false, action: () => {
    const search = document.getElementById('searchInput');
    if (search) { search.focus(); search.select(); }
  }, label: 'Focus Search' },
  { key: '?', ctrl: false, shift: true, action: () => showShortcutsHelp(), label: 'Show Shortcuts' },
];

let _shortcutsHandler = null;

export function initKeyboardShortcuts() {
  destroyKeyboardShortcuts();
  _shortcutsHandler = (e) => {
    // Ignore if user is typing in an input
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Ignore if modal is open
    if (document.querySelector('.modal-overlay.show')) return;

    // Ignore if lock screen is visible
    if (document.getElementById('lockScreen')?.classList.contains('show')) return;

    for (const shortcut of SHORTCUTS) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

      if (e.key === shortcut.key && ctrlMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  };
  document.addEventListener('keydown', _shortcutsHandler);
}

export function destroyKeyboardShortcuts() {
  if(_shortcutsHandler) {
    document.removeEventListener('keydown', _shortcutsHandler);
    _shortcutsHandler = null;
  }
}

function showShortcutsHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h3>Keyboard Shortcuts</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin:16px 0">
        ${SHORTCUTS.filter(s => s.label !== 'Show Shortcuts').map(s => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.8rem">${s.label}</span>
            <kbd style="background:var(--bg3);padding:2px 8px;border-radius:3px;font-family:var(--font-mono);font-size:0.7rem;border:1px solid var(--border)">
              ${s.ctrl ? 'Ctrl+' : ''}${s.shift ? 'Shift+' : ''}${s.key === ' ' ? 'Space' : s.key.toUpperCase()}
            </kbd>
          </div>
        `).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="shortcutsClose">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#shortcutsClose')?.addEventListener('click', () => overlay.remove());
}
