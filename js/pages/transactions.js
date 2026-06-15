// ===== TRANSACTIONS PAGE =====
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, restoreTransaction, addRecurring, getSettings } from '../store.js';
import { today, fmt, formatDate, getCat, ALL_CATS, EXPENSE_CATS, INCOME_CATS, PAYMENT_LABELS, validateTransaction, uid } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastInfo, toastError } from '../toast.js';
import { openModal, closeModal } from '../modals.js';
import { renderCard, renderEmptyState, renderCatOptions } from '../helpers.js';

let currentFilter = { search: '', type: 'all', category: 'all', payment: 'all', dateFrom: '', dateTo: '', sort: 'date-desc' };
let currentPage = 1;
const PAGE_SIZE = 50;

function getFiltered() {
  let filtered = [...getTransactions()];
  const f = currentFilter;
  if(f.type !== 'all') filtered = filtered.filter(t => t.type === f.type);
  if(f.category !== 'all') filtered = filtered.filter(t => t.category === f.category);
  if(f.payment !== 'all') filtered = filtered.filter(t => t.payment === f.payment);
  if(f.dateFrom) filtered = filtered.filter(t => t.date >= f.dateFrom);
  if(f.dateTo) filtered = filtered.filter(t => t.date <= f.dateTo);
  if(f.search) {
    const s = f.search.toLowerCase();
    filtered = filtered.filter(t =>
      (t.description || '').toLowerCase().includes(s) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(s)) ||
      getCat(t.category).name.toLowerCase().includes(s)
    );
  }

  switch(f.sort) {
    case 'date-asc': filtered.sort((a, b) => a.date.localeCompare(b.date)); break;
    case 'amount-desc': filtered.sort((a, b) => b.amount - a.amount); break;
    case 'amount-asc': filtered.sort((a, b) => a.amount - b.amount); break;
    case 'category': filtered.sort((a, b) => a.category.localeCompare(b.category)); break;
    default: filtered.sort((a, b) => b.date.localeCompare(a.date));
  }
  return filtered;
}

function renderTable() {
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('txBody');
  const empty = document.getElementById('txEmpty');
  const settings = getSettings();
  const countEl = document.getElementById('txCount');
  if(countEl) countEl.textContent = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`;

  if(!filtered.length) {
    if(tbody) tbody.innerHTML = '';
    if(empty) empty.classList.remove('hidden');
    const pag = document.getElementById('txPagination');
    if(pag) pag.innerHTML = '';
    return;
  }

  if(empty) empty.classList.add('hidden');
  if(!tbody) return;

  tbody.innerHTML = paged.map(t => {
    const cat = getCat(t.category);
    const payLabel = PAYMENT_LABELS[t.payment] || t.payment;
    return `
      <tr tabindex="0" data-tx-id="${escapeHTML(t.id)}">
        <td class="text-sm">${escapeHTML(formatDate(t.date, settings.dateFormat))}</td>
        <td>
          <div class="flex flex-center gap-8">
            <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color};font-size:0.9rem" aria-hidden="true">${cat.icon}</div>
            <div>
              <div style="font-weight:500">${escapeHTML(t.description || cat.name)}</div>
              ${t.recurring ? '<span class="recurring-badge">🔄 Recurring</span>' : ''}
            </div>
          </div>
        </td>
        <td><span class="tag tag-${escapeHTML(t.category)}">${escapeHTML(cat.name)}</span></td>
        <td class="text-sm text-muted">${escapeHTML(payLabel)}</td>
        <td>${(t.tags || []).map(tag => `<span class="tag tag-other" style="margin-right:4px">${escapeHTML(tag)}</span>`).join('')}</td>
        <td class="text-right" style="font-weight:600;color:${t.type === 'expense' ? 'var(--red)' : 'var(--green)'}">
          ${t.type === 'expense' ? '-' : '+'} ${fmt(t.amount, settings.currency)}
        </td>
        <td>
          <div class="flex gap-8" style="justify-content:flex-end">
            <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${escapeHTML(t.id)}" title="Edit" aria-label="Edit transaction">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${escapeHTML(t.id)}" title="Delete" aria-label="Delete transaction">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind edit/delete via event delegation
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if(btn.dataset.action === 'edit') openEditTransaction(id);
      else if(btn.dataset.action === 'delete') deleteTransactionHandler(id);
    });
  });

  // Keyboard: Enter to edit
  tbody.querySelectorAll('tr[data-tx-id]').forEach(row => {
    row.addEventListener('keydown', e => {
      if(e.key === 'Enter') openEditTransaction(row.dataset.txId);
    });
  });

  // Pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pag = document.getElementById('txPagination');
  if(!pag) return;
  if(totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '<div class="flex flex-center gap-8" style="justify-content:center;margin-top:16px">';
  html += `<button class="btn btn-ghost btn-sm" id="pagPrev" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">← Prev</button>`;
  html += `<span class="text-sm text-muted">Page ${currentPage} of ${totalPages}</span>`;
  html += `<button class="btn btn-ghost btn-sm" id="pagNext" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">Next →</button>`;
  html += '</div>';
  pag.innerHTML = html;

  document.getElementById('pagPrev')?.addEventListener('click', () => { currentPage--; renderTable(); });
  document.getElementById('pagNext')?.addEventListener('click', () => { currentPage++; renderTable(); });
}

function populateCategorySelect(selectEl, type) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  selectEl.innerHTML = renderCatOptions(cats);
}

function setTransType(type) {
  document.querySelectorAll('#typeTabs .tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && type === 'expense') || (i === 1 && type === 'income')));
  const catSelect = document.getElementById('txCategory');
  if(catSelect) populateCategorySelect(catSelect, type);
  window.__currentTransType = type;
}

function openAddTransaction() {
  document.getElementById('modalTitle').textContent = 'Add Transaction';
  document.getElementById('txId').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').value = today();
  document.getElementById('txDesc').value = '';
  document.getElementById('txTags').value = '';
  document.getElementById('txRecurring').checked = false;
  document.getElementById('recurringOptions').classList.add('hidden');
  setTransType('expense');
  document.getElementById('txSaveBtn').textContent = 'Save Transaction';
  openModal('transactionModal');
}

function openEditTransaction(id) {
  const t = getTransactions().find(x => x.id === id);
  if(!t) return;
  document.getElementById('modalTitle').textContent = 'Edit Transaction';
  document.getElementById('txId').value = t.id;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('txDate').value = t.date;
  document.getElementById('txDesc').value = t.description || '';
  document.getElementById('txTags').value = (t.tags || []).join(', ');
  document.getElementById('txRecurring').checked = !!t.recurring;
  document.getElementById('recurringOptions').classList.toggle('hidden', !t.recurring);
  if(t.recurring) document.getElementById('txFreq').value = t.frequency || 'monthly';
  setTransType(t.type);
  document.getElementById('txCategory').value = t.category;
  document.getElementById('txPayment').value = t.payment || 'cash';
  document.getElementById('txSaveBtn').textContent = 'Update Transaction';
  openModal('transactionModal');
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const cat = document.getElementById('txCategory').value;
  const payment = document.getElementById('txPayment').value;
  const desc = document.getElementById('txDesc').value.trim();
  const tags = document.getElementById('txTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const isRecurring = document.getElementById('txRecurring').checked;
  const freq = document.getElementById('txFreq').value;
  const id = document.getElementById('txId').value;
  const type = window.__currentTransType || 'expense';

  const errors = validateTransaction({ amount, date, category: cat, type, payment });
  if(errors.length) { toastError(errors[0]); return; }

  const data = { type, amount, date, category: cat, payment, description: desc, tags, recurring: isRecurring, frequency: freq };

  if(id) {
    updateTransaction(id, data);
    toastSuccess('Transaction updated');
  } else {
    data.id = uid();
    addTransaction(data);
    if(isRecurring && type === 'expense') {
      const next = new Date(date + 'T00:00:00');
      switch(freq) {
        case 'weekly': next.setDate(next.getDate() + 7); break;
        case 'biweekly': next.setDate(next.getDate() + 14); break;
        case 'monthly': next.setMonth(next.getMonth() + 1); break;
        case 'quarterly': next.setMonth(next.getMonth() + 3); break;
        case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
      }
      addRecurring({ id: uid(), amount, description: desc, frequency: freq, category: cat, startDate: date, nextDate: `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`, active: true });
    }
    toastSuccess('Transaction added');
  }
  closeModal('transactionModal');
  renderTable();
}

function deleteTransactionHandler(id) {
  if(!confirm('Delete this transaction?')) return;
  const removed = deleteTransaction(id);
  if(removed) {
    toastInfo('Transaction deleted', {
      action: () => { restoreTransaction(removed); renderTable(); },
      actionLabel: 'Undo',
      duration: 5000
    });
  }
  renderTable();
}

function toggleFilters() {
  const panel = document.getElementById('advancedFilters');
  if(panel) panel.classList.toggle('hidden');
}

export function renderTransactions(container) {
  const allCats = ALL_CATS;
  const payments = PAYMENT_LABELS;

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <h2>Transactions</h2>
        <div class="header-actions">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="input" id="searchInput" placeholder="Search transactions..." aria-label="Search transactions" style="width:220px">
          </div>
          <select class="input" id="filterType" aria-label="Filter by type" style="width:130px">
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <select class="input" id="filterSort" aria-label="Sort by" style="width:150px">
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Highest Amount</option>
            <option value="amount-asc">Lowest Amount</option>
            <option value="category">Category</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="toggleFiltersBtn" aria-label="Toggle advanced filters">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
          </button>
          <button class="btn btn-primary" id="addTransactionBtn" aria-label="Add transaction">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
      </div>
      <div id="advancedFilters" class="hidden" style="margin-bottom:16px;padding:16px;background:var(--bg2);border:1px solid var(--border)">
        <div class="flex gap-8" style="flex-wrap:wrap;align-items:flex-end">
          <div class="input-group" style="margin:0;flex:1;min-width:min(140px,100%)">
            <label for="filterDateFrom">From Date</label>
            <input type="date" class="input" id="filterDateFrom" aria-label="Filter from date">
          </div>
          <div class="input-group" style="margin:0;flex:1;min-width:min(140px,100%)">
            <label for="filterDateTo">To Date</label>
            <input type="date" class="input" id="filterDateTo" aria-label="Filter to date">
          </div>
          <div class="input-group" style="margin:0;flex:1;min-width:min(150px,100%)">
            <label for="filterCat">Category</label>
            <select class="input" id="filterCat" aria-label="Filter by category">
              <option value="all">All Categories</option>
              ${allCats.map(c => `<option value="${c.id}">${c.icon} ${escapeHTML(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin:0;flex:1;min-width:min(150px,100%)">
            <label for="filterPayment">Payment</label>
            <select class="input" id="filterPayment" aria-label="Filter by payment method">
              <option value="all">All Payments</option>
              ${Object.entries(payments).map(([k, v]) => `<option value="${k}">${escapeHTML(v)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="flex flex-center flex-between mb-16">
          <span class="text-sm text-muted" id="txCount"></span>
        </div>
        <div class="tx-table-wrapper">
          <table class="tx-table table" id="txTable" aria-label="Transactions list">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Category</th>
                <th scope="col">Payment</th>
                <th scope="col">Tags</th>
                <th scope="col" class="text-right">Amount</th>
                <th scope="col" style="width:80px"></th>
              </tr>
            </thead>
            <tbody id="txBody"></tbody>
          </table>
        </div>
        <div id="txPagination"></div>
        <div id="txEmpty" class="empty-state hidden">
          <p>No transactions found</p>
        </div>
      </div>
    </div>
  `;

  // Debounced search
  let searchTimeout;
  document.getElementById('searchInput')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilter.search = e.target.value;
      currentPage = 1;
      renderTable();
    }, 300);
  });

  document.getElementById('filterType')?.addEventListener('change', e => { currentFilter.type = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('filterSort')?.addEventListener('change', e => { currentFilter.sort = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('filterCat')?.addEventListener('change', e => { currentFilter.category = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('filterPayment')?.addEventListener('change', e => { currentFilter.payment = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('filterDateFrom')?.addEventListener('change', e => { currentFilter.dateFrom = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('filterDateTo')?.addEventListener('change', e => { currentFilter.dateTo = e.target.value; currentPage = 1; renderTable(); });
  document.getElementById('toggleFiltersBtn')?.addEventListener('click', toggleFilters);
  document.getElementById('addTransactionBtn')?.addEventListener('click', openAddTransaction);
  document.getElementById('txSaveBtn')?.addEventListener('click', saveTransaction);

  // Type tabs
  document.querySelectorAll('#typeTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => setTransType(tab.dataset.type));
  });

  // Recurring toggle
  document.getElementById('txRecurring')?.addEventListener('change', e => {
    document.getElementById('recurringOptions').classList.toggle('hidden', !e.target.checked);
  });

  renderTable();
}
