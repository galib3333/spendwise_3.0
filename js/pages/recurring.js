// ===== RECURRING PAGE =====
import { getRecurringList, addRecurring, updateRecurring, deleteRecurring, toggleRecurringActive, getSettings, getLoans } from '../store.js';
import { fmt, getCat, EXPENSE_CATS, validateRecurring, uid, today, parseLocalDate } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastInfo, toastError } from '../toast.js';
import { openModal, closeModal } from '../modals.js';
import { renderCatOptions } from '../helpers.js';

const FREQ_MULT = { weekly: 4.33, biweekly: 2.16, monthly: 1, quarterly: 0.33, yearly: 0.083 };
const FREQ_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, yearly: 1 };
const FREQ_LABELS = { weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

function monthsBetween(a, b) {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

function remainingMonths(r) {
  if (!r.endDate) return null;
  const nm = monthsBetween(r.startDate, r.endDate);
  return nm > 0 ? nm : 1;
}

function remainingCost(r) {
  const rm = remainingMonths(r);
  if (rm === null) return r.amount * (FREQ_PER_YEAR[r.frequency] || 1);
  const perYear = FREQ_PER_YEAR[r.frequency] || 12;
  const totalOccurrences = Math.ceil((rm / 12) * perYear);
  return r.amount * totalOccurrences;
}

function openAddRecurring() {
  document.getElementById('recEditId').value = '';
  document.getElementById('recAmount').value = '';
  document.getElementById('recDesc').value = '';
  document.getElementById('recFreq').value = 'monthly';
  document.getElementById('recStart').value = today();
  document.getElementById('recNext').value = today();
  document.getElementById('recEnd').value = '';
  const sel = document.getElementById('recCategory');
  sel.innerHTML = renderCatOptions(EXPENSE_CATS);
  openModal('recurringModal');
}

function openEditRecurring(id) {
  const r = getRecurringList().find(x => x.id === id);
  if(!r) return;
  document.getElementById('recEditId').value = r.id;
  document.getElementById('recAmount').value = r.amount;
  document.getElementById('recDesc').value = r.description;
  document.getElementById('recFreq').value = r.frequency;
  document.getElementById('recStart').value = r.startDate;
  document.getElementById('recNext').value = r.nextDate;
  document.getElementById('recEnd').value = r.endDate || '';
  const sel = document.getElementById('recCategory');
  sel.innerHTML = renderCatOptions(EXPENSE_CATS, r.category);
  openModal('recurringModal');
}

function saveRecurring() {
  const amount = parseFloat(document.getElementById('recAmount').value);
  const desc = document.getElementById('recDesc').value.trim();
  const freq = document.getElementById('recFreq').value;
  const cat = document.getElementById('recCategory').value;
  const start = document.getElementById('recStart').value;
  const next = document.getElementById('recNext').value;
  const endDate = document.getElementById('recEnd').value || null;
  const id = document.getElementById('recEditId').value;

  const errors = validateRecurring({ amount, description: desc, frequency: freq, category: cat, startDate: start, nextDate: next, endDate });
  if(errors.length) { toastError(errors[0]); return; }

  const data = { amount, description: desc, frequency: freq, category: cat, startDate: start, nextDate: next, endDate };

  if(id) {
    updateRecurring(id, data);
    toastSuccess('Recurring expense updated');
  } else {
    addRecurring({ id: uid(), ...data, active: true });
    toastSuccess('Recurring expense added');
  }
  closeModal('recurringModal');
  renderRecurring(_recurringContainer);
}

function deleteRecurringHandler(id) {
  if(!confirm('Delete this recurring item?')) return;
  const removed = deleteRecurring(id);
  if(removed) {
    toastInfo('Recurring deleted', {
      action: () => { addRecurring(removed); renderRecurring(_recurringContainer); },
      actionLabel: 'Undo',
      duration: 5000
    });
  }
  renderRecurring(_recurringContainer);
}

function toggleHandler(id) {
  toggleRecurringActive(id);
  renderRecurring(_recurringContainer);
}

let _recurringContainer = null;

let _saveBtnBound = false;
function bindSaveBtnOnce() {
  if(_saveBtnBound) return;
  _saveBtnBound = true;
  document.getElementById('recSaveBtn')?.addEventListener('click', saveRecurring);
}

export function renderRecurring(container) {
  _recurringContainer = container;
  const settings = getSettings();
  const recurringList = getRecurringList();
  const active = recurringList.filter(r => r.active);
  const loans = getLoans();
  const loanMap = Object.fromEntries(loans.map(l => [l.id, l]));

  const monthlyTotal = active.reduce((s, r) => s + r.amount * (FREQ_MULT[r.frequency] || 1), 0);
  const yearlyTotal = active.reduce((s, r) => s + remainingCost(r), 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <h2>Recurring Expenses</h2>
        <button class="btn btn-primary" id="addRecurringBtn" aria-label="Add recurring expense">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Recurring
        </button>
      </div>
      <div class="cards-grid">
        <div class="card"><div class="card-label">🔄 Active</div><div class="card-value accent">${active.length}</div></div>
        <div class="card"><div class="card-label">💸 Monthly Cost</div><div class="card-value red">${fmt(monthlyTotal, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📅 Total Cost</div><div class="card-value yellow">${fmt(yearlyTotal, settings.currency)}</div></div>
      </div>
      <div class="panel">
        ${recurringList.length ? recurringList.map(r => {
          const cat = getCat(r.category);
          const rm = remainingMonths(r);
          const endDateLabel = r.endDate ? ` · Ends ${r.endDate}` : ' · Ongoing';
          const linkedLoan = r.loanId ? loanMap[r.loanId] : null;
          const loanBadge = linkedLoan
            ? `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:0.6rem;font-weight:600;background:var(--accent)22;color:var(--accent);margin-left:4px">${linkedLoan.type === 'lent' ? '📤' : '📥'} ${escapeHTML(linkedLoan.person)}</span>`
            : '';
          return `
            <div class="recurring-row flex flex-center flex-between" style="padding:14px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-12">
                <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color}" aria-hidden="true">${cat.icon}</div>
                <div>
                  <div style="font-weight:600">${escapeHTML(r.description)}${loanBadge}</div>
                  <div class="text-sm text-muted">${escapeHTML(cat.name)} · ${escapeHTML(FREQ_LABELS[r.frequency] || r.frequency)}${endDateLabel}</div>
                </div>
              </div>
              <div class="flex flex-center gap-12">
                <span style="font-weight:600;color:var(--red)">${fmt(r.amount, settings.currency)}</span>
                <span class="badge ${r.active ? 'badge-success' : 'badge-danger'}">${r.active ? 'Active' : 'Paused'}</span>
                <div class="flex gap-8">
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="toggle" data-id="${escapeHTML(r.id)}" title="${r.active ? 'Pause' : 'Resume'}" aria-label="${r.active ? 'Pause' : 'Resume'} recurring expense">
                    ${r.active ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${escapeHTML(r.id)}" title="Edit" aria-label="Edit recurring expense">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${escapeHTML(r.id)}" title="Delete" aria-label="Delete recurring expense">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('') : '<div class="empty-state"><p>No recurring expenses. Add subscriptions, rent, etc.</p></div>'}
      </div>
    </div>
  `;

  document.getElementById('addRecurringBtn')?.addEventListener('click', openAddRecurring);
  bindSaveBtnOnce();

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if(btn.dataset.action === 'toggle') toggleHandler(id);
      else if(btn.dataset.action === 'edit') openEditRecurring(id);
      else if(btn.dataset.action === 'delete') deleteRecurringHandler(id);
    });
  });
}
