// ===== SHARED UI HELPERS =====
// Reduces code duplication across page modules

import { EXPENSE_CATS } from './utils.js';
import { escapeHTML } from './sanitize.js';

// ===== RENDER HELPERS =====

export function renderCard(label, value, colorClass = '') {
  return `<div class="card"><div class="card-label">${label}</div><div class="card-value ${colorClass}">${value}</div></div>`;
}

export function renderEmptyState(message) {
  return `<div class="empty-state"><p>${escapeHTML(message)}</p></div>`;
}

export function renderCatOptions(cats, selected = '') {
  return cats.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.icon} ${escapeHTML(c.name)}</option>`).join('');
}

export function renderExpenseCatOptions(selected = '') {
  return renderCatOptions(EXPENSE_CATS, selected);
}

// ===== EVENT BINDING HELPERS =====

export function bindPeriodNav(container, prefix, getOffset, setOffset, onNavigate) {
  const prev = container.querySelector(`#${prefix}Prev`);
  const next = container.querySelector(`#${prefix}Next`);
  const today = container.querySelector(`#${prefix}Today`);
  if (prev) prev.addEventListener('click', () => { setOffset(getOffset() - 1); onNavigate(); });
  if (next) next.addEventListener('click', () => { if (getOffset() < 0) { setOffset(getOffset() + 1); onNavigate(); } });
  if (today) today.addEventListener('click', () => { setOffset(0); onNavigate(); });
}

export function bindDataActions(container, handlers) {
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit' && handlers.edit) handlers.edit(id);
      else if (action === 'delete' && handlers.delete) handlers.delete(id);
      else if (action === 'sync' && handlers.sync) handlers.sync(id);
    });
  });
}

// ===== MODAL HELPERS =====

export function createModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', close));
  return { overlay, close };
}

export function confirmModal(message, { confirmText = 'Delete', danger = true } = {}) {
  return new Promise(resolve => {
    const { overlay, close } = createModal(`
      <h3>Confirm</h3>
      <p class="text-sm text-muted mb-16">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close-modal>Cancel</button>
        <button class="btn" id="_cmConfirm" style="${danger ? 'background:var(--red);color:#fff' : ''}">${confirmText}</button>
      </div>
    `);
    overlay.querySelector('#_cmConfirm').addEventListener('click', () => { close(); resolve(true); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { close(); resolve(false); } });
  });
}

// ===== SVG ICONS (reusable constants) =====

export const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
};
