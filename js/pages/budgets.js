// ===== BUDGETS PAGE =====
import { getBudgets, addBudget, updateBudget, deleteBudget, getTransactions, getSettings } from '../store.js';
import { fmt, getCat, EXPENSE_CATS, validateBudget, uid } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastInfo, toastError } from '../toast.js';
import { openModal, closeModal } from '../modals.js';

function getMonthExpenses() {
  const now = new Date();
  const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return getTransactions().filter(t => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd);
}

function openAddBudget() {
  document.getElementById('budgetEditId').value = '';
  document.getElementById('budgetAmount').value = '';
  const sel = document.getElementById('budgetCategory');
  sel.innerHTML = EXPENSE_CATS.map(c => `<option value="${c.id}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');
  const used = getBudgets().map(b => b.category);
  Array.from(sel.options).forEach(o => { if(used.includes(o.value)) o.disabled = true; });
  openModal('budgetModal');
}

function openEditBudget(id) {
  const b = getBudgets().find(x => x.id === id);
  if(!b) return;
  document.getElementById('budgetEditId').value = b.id;
  const sel = document.getElementById('budgetCategory');
  sel.innerHTML = EXPENSE_CATS.map(c => `<option value="${c.id}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');
  sel.value = b.category;
  document.getElementById('budgetAmount').value = b.limit;
  openModal('budgetModal');
}

function saveBudget() {
  const cat = document.getElementById('budgetCategory').value;
  const limit = parseFloat(document.getElementById('budgetAmount').value);
  const id = document.getElementById('budgetEditId').value;

  const errors = validateBudget({ category: cat, limit });
  if(errors.length) { toastError(errors[0]); return; }

  if(id) {
    updateBudget(id, { category: cat, limit });
    toastSuccess('Budget updated');
  } else {
    if(getBudgets().find(b => b.category === cat)) { toastError('Budget already exists for this category'); return; }
    addBudget({ id: uid(), category: cat, limit });
    toastSuccess('Budget created');
  }
  closeModal('budgetModal');
  renderBudgets(document.getElementById('mainContent'));
}

function deleteBudgetHandler(id) {
  if(!confirm('Delete this budget?')) return;
  const removed = deleteBudget(id);
  if(removed) {
    toastInfo('Budget deleted', {
      action: () => { addBudget(removed); renderBudgets(document.getElementById('mainContent')); },
      actionLabel: 'Undo',
      duration: 5000
    });
  }
  renderBudgets(document.getElementById('mainContent'));
}

export function renderBudgets(container) {
  const settings = getSettings();
  const now = new Date();
  const monthExp = getMonthExpenses();
  const spent = {};
  monthExp.forEach(t => { spent[t.category] = (spent[t.category] || 0) + t.amount; });
  const budgets = getBudgets();
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spent[b.category] || 0), 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <h2>Budgets — ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <button class="btn btn-primary" id="addBudgetBtn" aria-label="Set budget">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Set Budget
        </button>
      </div>
      <div class="cards-grid">
        <div class="card"><div class="card-label">💰 Total Budget</div><div class="card-value accent">${fmt(totalBudget, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💸 Total Spent</div><div class="card-value red">${fmt(totalSpent, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Remaining</div><div class="card-value ${totalBudget - totalSpent >= 0 ? 'green' : 'red'}">${fmt(totalBudget - totalSpent, settings.currency)}</div></div>
      </div>
      <div class="panel" id="budgetsList">
        ${budgets.length ? budgets.map(b => {
          const cat = getCat(b.category);
          const s = spent[b.category] || 0;
          const pct = b.limit ? Math.min((s / b.limit) * 100, 100) : 0;
          const over = s > b.limit;
          return `
            <div class="budget-row">
              <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color}" aria-hidden="true">${cat.icon}</div>
              <div class="budget-info">
                <div class="name">${escapeHTML(cat.name)}</div>
                <div class="amounts">${fmt(s, settings.currency)} of ${fmt(b.limit, settings.currency)} spent</div>
                <div class="progress-bar" style="margin-top:6px">
                  <div class="progress-fill" style="width:${pct}%;background:${over ? 'var(--red)' : pct > 80 ? 'var(--yellow)' : 'var(--green)'}"></div>
                </div>
              </div>
              <span class="badge ${over ? 'badge-danger' : pct > 80 ? 'badge-warning' : 'badge-success'}">${over ? 'Over' : pct > 80 ? 'Warning' : 'On Track'}</span>
              <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${escapeHTML(b.id)}" title="Edit budget" aria-label="Edit budget for ${escapeHTML(cat.name)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${escapeHTML(b.id)}" title="Delete budget" aria-label="Delete budget for ${escapeHTML(cat.name)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          `;
        }).join('') : '<div class="empty-state"><p>No budgets set. Click "Set Budget" to start tracking.</p></div>'}
      </div>
    </div>
  `;

  document.getElementById('addBudgetBtn')?.addEventListener('click', openAddBudget);
  document.getElementById('budgetSaveBtn')?.addEventListener('click', saveBudget);

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(btn.dataset.action === 'edit') openEditBudget(btn.dataset.id);
      else if(btn.dataset.action === 'delete') deleteBudgetHandler(btn.dataset.id);
    });
  });
}
