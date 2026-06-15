// ===== RECURRING PAGE =====
import { getRecurringList, addRecurring, updateRecurring, deleteRecurring, toggleRecurringActive, getSettings } from '../store.js';
import { fmt, getCat, EXPENSE_CATS, validateRecurring, uid, today } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastInfo, toastError } from '../toast.js';
import { openModal, closeModal } from '../modals.js';
import { renderCard, renderCatOptions, ICONS } from '../helpers.js';

const FREQ_MULT = { weekly: 4.33, biweekly: 2.16, monthly: 1, quarterly: 0.33, yearly: 0.083 };
const FREQ_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, yearly: 1 };
const FREQ_LABELS = { weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

function monthsBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
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

  const monthlyTotal = active.reduce((s, r) => s + r.amount * (FREQ_MULT[r.frequency] || 1), 0);
  const yearlyTotal = active.reduce((s, r) => s + remainingCost(r), 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <h2>Recurring Expenses</h2>
        <button class="btn btn-primary" id="addRecurringBtn" aria-label="Add recurring expense">
          ${ICONS.plus}
          Add Recurring
        </button>
      </div>
      <div class="cards-grid">
        ${renderCard('🔄 Active', active.length, 'accent')}
        ${renderCard('💸 Monthly Cost', fmt(monthlyTotal, settings.currency), 'red')}
        ${renderCard('📅 Total Cost', fmt(yearlyTotal, settings.currency), 'yellow')}
      </div>
      <div class="panel">
        ${recurringList.length ? recurringList.map(r => {
          const cat = getCat(r.category);
          const rm = remainingMonths(r);
          const endDateLabel = r.endDate ? ` · Ends ${r.endDate}` : ' · Ongoing';
          return `
            <div class="recurring-row flex flex-center flex-between" style="padding:14px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-12">
                <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color}" aria-hidden="true">${cat.icon}</div>
                <div>
                  <div style="font-weight:600">${escapeHTML(r.description)}</div>
                  <div class="text-sm text-muted">${escapeHTML(cat.name)} · ${escapeHTML(FREQ_LABELS[r.frequency] || r.frequency)}${endDateLabel}</div>
                </div>
              </div>
              <div class="flex flex-center gap-12">
                <span style="font-weight:600;color:var(--red)">${fmt(r.amount, settings.currency)}</span>
                <span class="badge ${r.active ? 'badge-success' : 'badge-danger'}">${r.active ? 'Active' : 'Paused'}</span>
                <div class="flex gap-8">
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="toggle" data-id="${escapeHTML(r.id)}" title="${r.active ? 'Pause' : 'Resume'}" aria-label="${r.active ? 'Pause' : 'Resume'} recurring expense">
                    ${r.active ? ICONS.pause : ICONS.play}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${escapeHTML(r.id)}" title="Edit" aria-label="Edit recurring expense">
                    ${ICONS.edit}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${escapeHTML(r.id)}" title="Delete" aria-label="Delete recurring expense">
                    ${ICONS.delete}
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
