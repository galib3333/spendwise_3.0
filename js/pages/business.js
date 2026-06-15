// ===== BUSINESS MODE PAGE =====
import {
  getBusinessProfile, setBusinessProfile, clearBusinessProfile,
  getBusinessTransactions, addBusinessTransaction, updateBusinessTransaction, deleteBusinessTransaction,
  getBusinessCategories, addBusinessCategory, updateBusinessCategory, deleteBusinessCategory,
  getSettings
} from '../store.js';
import { fmt, fmtCompact, today, uid, BUSINESS_PAYMENT_LABELS, getMonthStart, getMonthEnd } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastError, toastWarning } from '../toast.js';
import { navigate } from '../router.js';

const BUSINESS_TYPES = [
  { id: 'retail', name: 'Retail / Departmental Store', icon: '🏬' },
  { id: 'grocery', name: 'Grocery Shop', icon: '🛒' },
  { id: 'restaurant', name: 'Food / Restaurant', icon: '🍽️' },
  { id: 'service', name: 'Service Business', icon: '🔧' },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊' }
];

const DEFAULT_CATEGORIES = {
  retail: {
    expense: [
      { name: 'Rent', icon: '🏠', taxRate: 0 },
      { name: 'Utilities', icon: '💡', taxRate: 15 },
      { name: 'Inventory Purchase', icon: '📦', taxRate: 15 },
      { name: 'Staff Salary', icon: '👤', taxRate: 0 },
      { name: 'Packaging', icon: '🎁', taxRate: 15 },
      { name: 'Transport', icon: '🚚', taxRate: 15 },
      { name: 'Marketing', icon: '📢', taxRate: 15 },
      { name: 'Maintenance', icon: '🔧', taxRate: 15 },
      { name: 'Other', icon: '📋', taxRate: 15 }
    ],
    income: [
      { name: 'Product Sales', icon: '💰', taxRate: 15 },
      { name: 'Returns', icon: '🔄', taxRate: 15 }
    ]
  },
  grocery: {
    expense: [
      { name: 'Stock Purchase', icon: '📦', taxRate: 15 },
      { name: 'Rent', icon: '🏠', taxRate: 0 },
      { name: 'Utilities', icon: '💡', taxRate: 15 },
      { name: 'Transport', icon: '🚚', taxRate: 15 },
      { name: 'Storage', icon: '🏗️', taxRate: 15 },
      { name: 'Wages', icon: '👤', taxRate: 0 },
      { name: 'Packaging', icon: '🎁', taxRate: 15 },
      { name: 'Other', icon: '📋', taxRate: 15 }
    ],
    income: [
      { name: 'Daily Sales', icon: '💰', taxRate: 15 },
      { name: 'Bulk Orders', icon: '📊', taxRate: 15 }
    ]
  },
  restaurant: {
    expense: [
      { name: 'Raw Materials', icon: '🥬', taxRate: 15 },
      { name: 'Staff Salary', icon: '👤', taxRate: 0 },
      { name: 'Rent', icon: '🏠', taxRate: 0 },
      { name: 'Utilities', icon: '💡', taxRate: 15 },
      { name: 'Equipment', icon: '🍳', taxRate: 15 },
      { name: 'Packaging', icon: '🎁', taxRate: 15 },
      { name: 'Marketing', icon: '📢', taxRate: 15 },
      { name: 'Other', icon: '📋', taxRate: 15 }
    ],
    income: [
      { name: 'Food Sales', icon: '💰', taxRate: 15 },
      { name: 'Delivery', icon: '🛵', taxRate: 7.5 }
    ]
  },
  service: {
    expense: [
      { name: 'Rent', icon: '🏠', taxRate: 0 },
      { name: 'Supplies', icon: '📦', taxRate: 15 },
      { name: 'Staff Salary', icon: '👤', taxRate: 0 },
      { name: 'Marketing', icon: '📢', taxRate: 15 },
      { name: 'Utilities', icon: '💡', taxRate: 15 },
      { name: 'Equipment', icon: '🔧', taxRate: 15 },
      { name: 'Other', icon: '📋', taxRate: 15 }
    ],
    income: [
      { name: 'Service Fees', icon: '💰', taxRate: 7.5 },
      { name: 'Consultation', icon: '💬', taxRate: 7.5 }
    ]
  },
  pharmacy: {
    expense: [
      { name: 'Medicine Stock', icon: '💊', taxRate: 0 },
      { name: 'Rent', icon: '🏠', taxRate: 0 },
      { name: 'Staff Salary', icon: '👤', taxRate: 0 },
      { name: 'Utilities', icon: '💡', taxRate: 15 },
      { name: 'Licensing', icon: '📜', taxRate: 0 },
      { name: 'Equipment', icon: '🔬', taxRate: 15 },
      { name: 'Other', icon: '📋', taxRate: 15 }
    ],
    income: [
      { name: 'Medicine Sales', icon: '💰', taxRate: 0 },
      { name: 'OTC Sales', icon: '🛒', taxRate: 15 }
    ]
  }
};

// ===== SHARED HELPERS =====

function requireProfile(container) {
  const profile = getBusinessProfile();
  if (!profile) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="header"><h2>Business Mode</h2></div>
        <div class="panel" style="text-align:center;padding:60px 20px">
          <div style="font-size:4rem;margin-bottom:16px">🏪</div>
          <h3 style="margin-bottom:8px">Business Profile Required</h3>
          <p class="text-sm text-muted mb-20">Set up your business profile to continue.</p>
          <button class="btn btn-primary" id="bizGoSetup">Set Up Profile</button>
        </div>
      </div>`;
    container.querySelector('#bizGoSetup')?.addEventListener('click', () => navigate('business'));
    return null;
  }
  return profile;
}

function getMonthRange(offset = 0) {
  const start = getMonthStart(offset);
  const end = getMonthEnd(offset);
  const d = new Date(start + 'T00:00:00');
  return { start, end, date: d };
}

function filterByDateRange(items, start, end) {
  return items.filter(t => t.date >= start && t.date <= end);
}

function sumAmount(items) {
  return items.reduce((s, t) => s + t.amount, 0);
}

function sumTax(items) {
  return items.reduce((s, t) => s + (t.tax || 0), 0);
}

function getCategoryMap(categories) {
  return Object.fromEntries(categories.map(c => [c.id, c]));
}

function renderCategoryList(categories) {
  if (!categories.length) return '<p class="text-muted text-sm" style="padding:12px 0">No categories yet</p>';
  return categories.map(c => `
    <div class="flex flex-center flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="flex flex-center gap-8">
        <span style="font-size:1.1rem">${c.icon}</span>
        <span class="text-sm" style="font-weight:500">${escapeHTML(c.name)}</span>
      </div>
      <div class="flex flex-center gap-8">
        <span class="text-sm text-muted">${c.type === 'expense' ? 'Expense' : 'Income'} · ${c.taxRate}% tax</span>
        <button class="btn btn-ghost btn-sm" data-edit-cat="${c.id}" title="Edit category" style="padding:2px 6px;font-size:0.7rem">✎</button>
        <button class="btn btn-ghost btn-sm" data-del-cat="${c.id}" title="Delete category" style="padding:2px 6px;font-size:0.7rem;color:var(--red)">✕</button>
      </div>
    </div>
  `).join('');
}

function renderTransactionRow(t, catMap, currency) {
  const cat = catMap[t.category];
  const icon = cat ? cat.icon : (t.type === 'income' ? '💰' : '📋');
  const name = cat ? cat.name : 'Uncategorized';
  const color = t.type === 'income' ? 'var(--green)' : 'var(--red)';
  const sign = t.type === 'income' ? '+' : '-';
  return `
    <div class="flex flex-center flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)" data-txn-row="${t.id}">
      <div class="flex flex-center gap-8" style="flex:1;min-width:0">
        <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
        <div style="min-width:0">
          <div class="text-sm" style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(t.description || name)}</div>
          <div class="text-sm text-muted">${escapeHTML(t.date)}${t.category ? ' · ' + escapeHTML(name) : ''}</div>
        </div>
      </div>
      <div class="flex flex-center gap-8" style="flex-shrink:0">
        <div style="text-align:right">
          <div style="font-weight:600;color:${color}">${sign} ${fmt(t.amount, currency)}</div>
          ${t.tax ? `<div class="text-sm text-muted">Tax: ${fmt(t.tax, currency)}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" data-edit-txn="${t.id}" title="Edit" style="padding:2px 6px;font-size:0.7rem">✎</button>
        <button class="btn btn-ghost btn-sm" data-del-txn="${t.id}" title="Delete" style="padding:2px 6px;font-size:0.7rem;color:var(--red)">✕</button>
      </div>
    </div>`;
}

function renderSummaryCards(items, type, currency) {
  const filtered = type ? items.filter(t => t.type === type) : items;
  const total = sumAmount(filtered);
  const tax = sumTax(filtered);
  const ms = getMonthStart();
  const me = getMonthEnd();
  const thisMonth = sumAmount(filterByDateRange(filtered, ms, me));

  const label = type === 'expense' ? 'Total Expenses' : type === 'income' ? 'Total Income' : 'Total';
  const color = type === 'expense' ? 'red' : type === 'income' ? 'green' : '';
  return `
    <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));margin-bottom:24px">
      <div class="card"><div class="card-label">${type === 'expense' ? '💸' : type === 'income' ? '💰' : '📊'} ${label}</div><div class="card-value ${color}">${fmt(total, currency)}</div></div>
      <div class="card"><div class="card-label">📊 Tax ${type === 'income' ? 'Collected' : 'Paid'}</div><div class="card-value accent">${fmt(tax, currency)}</div></div>
      <div class="card"><div class="card-label">📝 This Month</div><div class="card-value">${fmt(thisMonth, currency)}</div></div>
    </div>`;
}

// ===== PROFILE SETUP =====

function setupBusinessProfile(container, isEdit = false) {
  const existing = isEdit ? getBusinessProfile() : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>${isEdit ? 'Edit' : 'Set Up'} Business Profile</h3>
      <p class="text-sm text-muted mb-16">Tell us about your business to customize categories and reports.</p>
      <div class="input-group mb-16">
        <label for="bizName">Business Name</label>
        <input type="text" class="input" id="bizName" placeholder="e.g. My Shop" value="${existing ? escapeHTML(existing.name) : ''}" required>
      </div>
      <div class="input-group mb-16">
        <label>Business Type</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="bizTypeGrid">
          ${BUSINESS_TYPES.map(t => `
            <div class="panel" style="cursor:pointer;padding:12px;text-align:center;${existing && existing.type === t.id ? 'border-color:var(--accent)' : ''}" data-type="${t.id}">
              <div style="font-size:1.5rem;margin-bottom:4px">${t.icon}</div>
              <div class="text-sm">${t.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="input-group mb-16">
        <label for="bizTaxId">Tax ID / BIN (optional)</label>
        <input type="text" class="input" id="bizTaxId" placeholder="e.g. 123456789" value="${existing && existing.taxId ? escapeHTML(existing.taxId) : ''}">
      </div>
      ${isEdit ? '<div class="input-group mb-16"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="bizDeleteProfile"> <span class="text-sm" style="color:var(--red)">Delete business profile and all business data</span></label></div>' : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="bizProfileCancel">Cancel</button>
        <button class="btn btn-primary" id="bizProfileSave">${isEdit ? 'Save Changes' : 'Save Profile'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedType = existing ? existing.type : null;

  overlay.querySelectorAll('[data-type]').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('[data-type]').forEach(e => e.style.borderColor = '');
      el.style.borderColor = 'var(--accent)';
      selectedType = el.dataset.type;
    });
  });

  overlay.querySelector('#bizProfileCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#bizProfileSave').addEventListener('click', () => {
    const name = overlay.querySelector('#bizName').value.trim();
    if (!name) { toastError('Business name is required'); return; }
    if (!selectedType) { toastError('Select a business type'); return; }
    const taxId = overlay.querySelector('#bizTaxId').value.trim();

    setBusinessProfile({ name, type: selectedType, taxId });

    if (!isEdit) {
      const defaults = DEFAULT_CATEGORIES[selectedType];
      if (defaults) {
        [...defaults.expense, ...defaults.income].forEach(cat => {
          addBusinessCategory({
            id: uid(),
            name: cat.name,
            icon: cat.icon,
            type: defaults.expense.includes(cat) ? 'expense' : 'income',
            taxRate: cat.taxRate
          });
        });
      }
    }

    overlay.remove();
    toastSuccess(isEdit ? 'Profile updated!' : 'Business profile created!');
    renderBusiness(container);
  });

  if (isEdit) {
    overlay.querySelector('#bizDeleteProfile')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        const confirm = overlay.querySelector('#bizProfileSave');
        confirm.textContent = 'Delete Profile';
        confirm.className = 'btn';
        confirm.style.background = 'var(--red)';
        confirm.style.color = '#fff';
      } else {
        const confirm = overlay.querySelector('#bizProfileSave');
        confirm.textContent = 'Save Changes';
        confirm.className = 'btn btn-primary';
        confirm.style.background = '';
        confirm.style.color = '';
      }
    });

    overlay.querySelector('#bizProfileSave').addEventListener('click', () => {
      if (overlay.querySelector('#bizDeleteProfile')?.checked) {
        overlay.remove();
        clearBusinessProfile();
        toastWarning('Business profile deleted');
        navigate('business');
      }
    }, { capture: true });
  }
}

// ===== CATEGORY MANAGEMENT =====

function openCategoryModal(container, existingCat = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  const isEdit = !!existingCat;
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h3>${isEdit ? 'Edit' : 'Add'} Category</h3>
      <div class="input-group mb-16">
        <label for="catName">Category Name</label>
        <input type="text" class="input" id="catName" placeholder="e.g. Supplies" value="${isEdit ? escapeHTML(existingCat.name) : ''}" required>
      </div>
      <div class="input-group mb-16">
        <label for="catIcon">Icon (emoji)</label>
        <input type="text" class="input" id="catIcon" placeholder="e.g. 📦" value="${isEdit ? existingCat.icon : ''}" maxlength="4" required>
      </div>
      <div class="input-group mb-16">
        <label for="catType">Type</label>
        <select class="input" id="catType">
          <option value="expense" ${isEdit && existingCat.type === 'expense' ? 'selected' : ''}>Expense</option>
          <option value="income" ${isEdit && existingCat.type === 'income' ? 'selected' : ''}>Income</option>
        </select>
      </div>
      <div class="input-group mb-16">
        <label for="catTaxRate">Tax Rate (%)</label>
        <input type="number" class="input" id="catTaxRate" placeholder="0" min="0" max="100" step="0.5" value="${isEdit ? existingCat.taxRate : 0}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="catCancel">Cancel</button>
        <button class="btn btn-primary" id="catSave">${isEdit ? 'Save' : 'Add Category'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#catCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#catSave').addEventListener('click', () => {
    const name = overlay.querySelector('#catName').value.trim();
    const icon = overlay.querySelector('#catIcon').value.trim() || '📋';
    const type = overlay.querySelector('#catType').value;
    const taxRate = parseFloat(overlay.querySelector('#catTaxRate').value) || 0;

    if (!name) { toastError('Category name is required'); return; }
    if (taxRate < 0 || taxRate > 100) { toastError('Tax rate must be 0-100%'); return; }

    if (isEdit) {
      updateBusinessCategory(existingCat.id, { name, icon, type, taxRate });
      toastSuccess('Category updated!');
    } else {
      addBusinessCategory({ id: uid(), name, icon, type, taxRate });
      toastSuccess('Category added!');
    }

    overlay.remove();
    renderBusiness(container);
  });
}

function confirmDeleteCategory(container, catId) {
  const categories = getBusinessCategories();
  const cat = categories.find(c => c.id === catId);
  if (!cat) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h3>Delete Category</h3>
      <p class="text-sm text-muted mb-16">Delete <strong>${escapeHTML(cat.icon)} ${escapeHTML(cat.name)}</strong>? This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="delCatCancel">Cancel</button>
        <button class="btn" id="delCatConfirm" style="background:var(--red);color:#fff">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#delCatCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#delCatConfirm').addEventListener('click', () => {
    deleteBusinessCategory(catId);
    overlay.remove();
    toastSuccess('Category deleted');
    renderBusiness(container);
  });
}

// ===== TRANSACTION MODALS =====

function openBizTransactionModal(container, type, existingTxn = null) {
  const categories = getBusinessCategories().filter(c => c.type === type);
  const settings = getSettings();
  const isEdit = !!existingTxn;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>${isEdit ? 'Edit' : type === 'expense' ? 'Add Business Expense' : 'Record Sale'}</h3>
      <div class="form-row">
        <div class="input-group">
          <label for="bizAmount">Amount (${settings.currency})</label>
          <input type="number" class="input" id="bizAmount" placeholder="0.00" step="0.01" min="0" value="${isEdit ? existingTxn.amount : ''}" required>
        </div>
        <div class="input-group">
          <label for="bizDate">Date</label>
          <input type="date" class="input" id="bizDate" value="${isEdit ? existingTxn.date : today()}" required>
        </div>
      </div>
      <div class="input-group">
        <label for="bizCategory">Category</label>
        <select class="input" id="bizCategory" required>
          <option value="">Select category</option>
          ${categories.map(c => `<option value="${c.id}" ${isEdit && existingTxn.category === c.id ? 'selected' : ''}>${c.icon} ${escapeHTML(c.name)} (${c.taxRate}% tax)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="bizDesc">Description</label>
        <input type="text" class="input" id="bizDesc" placeholder="What was this for?" value="${isEdit && existingTxn.description ? escapeHTML(existingTxn.description) : ''}">
      </div>
      <div class="input-group">
        <label for="bizPayment">Payment Method</label>
        <select class="input" id="bizPayment">
          ${Object.entries(BUSINESS_PAYMENT_LABELS).map(([k, v]) => `<option value="${k}" ${isEdit && existingTxn.payment === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div id="bizTaxInfo" class="text-sm text-muted mb-16" style="padding:8px;background:var(--bg3);display:none">
        Tax will be calculated automatically based on category.
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="bizCancel">Cancel</button>
        <button class="btn btn-primary" id="bizSave">${isEdit ? 'Save Changes' : type === 'expense' ? 'Save Expense' : 'Save Sale'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#bizCategory').addEventListener('change', (e) => {
    const cat = categories.find(c => c.id === e.target.value);
    const taxInfo = overlay.querySelector('#bizTaxInfo');
    if (cat && cat.taxRate > 0) {
      const amt = parseFloat(overlay.querySelector('#bizAmount').value) || 0;
      const tax = amt * (cat.taxRate / 100);
      taxInfo.style.display = 'block';
      taxInfo.textContent = `Tax: ${cat.taxRate}% → ${fmt(tax, settings.currency)} tax on ${fmt(amt, settings.currency)}`;
    } else {
      taxInfo.style.display = 'none';
    }
  });

  overlay.querySelector('#bizAmount').addEventListener('input', () => {
    const catId = overlay.querySelector('#bizCategory').value;
    if (catId) overlay.querySelector('#bizCategory').dispatchEvent(new Event('change'));
  });

  overlay.querySelector('#bizCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#bizSave').addEventListener('click', () => {
    const amount = parseFloat(overlay.querySelector('#bizAmount').value);
    const date = overlay.querySelector('#bizDate').value;
    const categoryId = overlay.querySelector('#bizCategory').value;
    const description = overlay.querySelector('#bizDesc').value.trim();
    const payment = overlay.querySelector('#bizPayment').value;

    if (!amount || amount <= 0) { toastError('Enter a valid amount'); return; }
    if (!date) { toastError('Select a date'); return; }
    if (!categoryId) { toastError('Select a category'); return; }

    const cat = categories.find(c => c.id === categoryId);
    const tax = cat && cat.taxRate > 0 ? amount * (cat.taxRate / 100) : 0;
    const txnData = {
      type,
      amount,
      tax,
      taxRate: cat ? cat.taxRate : 0,
      date,
      category: categoryId,
      description,
      payment,
      createdBy: 'owner'
    };

    if (isEdit) {
      updateBusinessTransaction(existingTxn.id, txnData);
      toastSuccess(type === 'expense' ? 'Expense updated!' : 'Sale updated!');
    } else {
      addBusinessTransaction({ id: uid(), ...txnData });
      toastSuccess(type === 'expense' ? 'Expense added!' : 'Sale recorded!');
    }

    overlay.remove();
    if (type === 'expense') renderBizExpenses(container);
    else renderBizSales(container);
  });
}

function confirmDeleteTransaction(container, txnId) {
  const txns = getBusinessTransactions();
  const txn = txns.find(t => t.id === txnId);
  if (!txn) return;

  const settings = getSettings();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h3>Delete Transaction</h3>
      <p class="text-sm text-muted mb-16">Delete ${txn.type === 'expense' ? 'expense' : 'sale'} of <strong>${fmt(txn.amount, settings.currency)}</strong> on ${escapeHTML(txn.date)}?</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="delTxnCancel">Cancel</button>
        <button class="btn" id="delTxnConfirm" style="background:var(--red);color:#fff">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#delTxnCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#delTxnConfirm').addEventListener('click', () => {
    deleteBusinessTransaction(txnId);
    overlay.remove();
    toastSuccess('Transaction deleted');
    const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
    if (currentPage === 'biz-expenses') renderBizExpenses(container);
    else if (currentPage === 'biz-sales') renderBizSales(container);
    else renderBusiness(container);
  });
}

// ===== SEARCH & FILTER BAR =====

function renderFilterBar(type, total) {
  return `
    <div class="flex gap-8 mb-16" style="flex-wrap:wrap;align-items:center">
      <input type="text" class="input" id="bizSearch" placeholder="Search transactions..." style="flex:1;min-width:150px">
      <select class="input" id="bizFilterCat" style="width:auto;min-width:120px">
        <option value="">All Categories</option>
      </select>
      <select class="input" id="bizFilterPayment" style="width:auto;min-width:120px">
        <option value="">All Payments</option>
        ${Object.entries(BUSINESS_PAYMENT_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <input type="date" class="input" id="bizFilterFrom" style="width:auto" title="From date">
      <input type="date" class="input" id="bizFilterTo" style="width:auto" title="To date">
      <span class="text-sm text-muted" id="bizFilterCount">${total} transactions</span>
    </div>`;
}

function applyFilters(container, type) {
  const search = (container.querySelector('#bizSearch')?.value || '').toLowerCase();
  const catFilter = container.querySelector('#bizFilterCat')?.value || '';
  const payFilter = container.querySelector('#bizFilterPayment')?.value || '';
  const from = container.querySelector('#bizFilterFrom')?.value || '';
  const to = container.querySelector('#bizFilterTo')?.value || '';

  let txns = getBusinessTransactions().filter(t => t.type === type);
  if (search) txns = txns.filter(t => (t.description || '').toLowerCase().includes(search));
  if (catFilter) txns = txns.filter(t => t.category === catFilter);
  if (payFilter) txns = txns.filter(t => t.payment === payFilter);
  if (from) txns = txns.filter(t => t.date >= from);
  if (to) txns = txns.filter(t => t.date <= to);

  const catMap = getCategoryMap(getBusinessCategories());
  const currency = getSettings().currency;
  const listEl = container.querySelector('#bizTxnList');
  if (listEl) {
    listEl.innerHTML = txns.length
      ? txns.slice().reverse().map(t => renderTransactionRow(t, catMap, currency)).join('')
      : '<p class="empty-state text-muted" style="padding:20px 0">No transactions match your filters</p>';
  }

  const countEl = container.querySelector('#bizFilterCount');
  if (countEl) countEl.textContent = `${txns.length} transaction${txns.length !== 1 ? 's' : ''}`;

  container.querySelectorAll('[data-edit-txn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const allTxns = getBusinessTransactions();
      const txn = allTxns.find(t => t.id === btn.dataset.editTxn);
      if (txn) openBizTransactionModal(container, txn.type, txn);
    });
  });
  container.querySelectorAll('[data-del-txn]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteTransaction(container, btn.dataset.delTxn));
  });
}

function populateCategoryFilter(container, type) {
  const cats = getBusinessCategories().filter(c => c.type === type);
  const sel = container.querySelector('#bizFilterCat');
  if (sel) {
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.name}`;
      sel.appendChild(opt);
    });
  }
}

// ===== BUSINESS DASHBOARD =====

export function renderBusiness(container) {
  const profile = requireProfile(container);
  if (!profile) return;

  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();
  const catMap = getCategoryMap(categories);

  const totalExpenses = sumAmount(txns.filter(t => t.type === 'expense'));
  const totalIncome = sumAmount(txns.filter(t => t.type === 'income'));
  const totalTax = sumTax(txns);
  const profit = totalIncome - totalExpenses;
  const bizType = BUSINESS_TYPES.find(t => t.id === profile.type);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>${escapeHTML(profile.name)}</h2>
          <p class="text-sm text-muted">${bizType ? bizType.icon + ' ' + bizType.name : 'Business'} ${profile.taxId ? ' — Tax ID: ' + escapeHTML(profile.taxId) : ''}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="editBizProfile">Edit Profile</button>
      </div>

      <div class="cards-grid">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Total Income</div><div class="card-value green">${fmt(totalIncome, settings.currency)}</div></div>
        <div class="card"><div class="card-label">🏦 Net Profit</div><div class="card-value ${profit >= 0 ? 'green' : 'red'}">${fmt(profit, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Tax Collected</div><div class="card-value accent">${fmt(totalTax, settings.currency)}</div></div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Quick Actions</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-primary" id="addBizExpense">+ Add Expense</button>
            <button class="btn btn-primary" id="addBizSale">+ Record Sale</button>
            <button class="btn btn-ghost" id="navBizExpenses">View Expenses</button>
            <button class="btn btn-ghost" id="navBizSales">View Sales</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h3>Categories</h3>
            <button class="btn btn-ghost btn-sm" id="addBizCat">+ Add</button>
          </div>
          <div style="max-height:200px;overflow-y:auto">
            ${renderCategoryList(categories)}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Recent Transactions</h3>
          <span class="text-sm text-muted">${txns.length} total</span>
        </div>
        <div id="bizRecentList">
          ${txns.length
            ? txns.slice(-10).reverse().map(t => renderTransactionRow(t, catMap, settings.currency)).join('')
            : '<p class="empty-state text-muted" style="padding:20px 0">No transactions yet — add your first expense or sale above</p>'
          }
        </div>
      </div>
    </div>`;

  container.querySelector('#editBizProfile')?.addEventListener('click', () => setupBusinessProfile(container, true));
  container.querySelector('#addBizExpense')?.addEventListener('click', () => openBizTransactionModal(container, 'expense'));
  container.querySelector('#addBizSale')?.addEventListener('click', () => openBizTransactionModal(container, 'income'));
  container.querySelector('#addBizCat')?.addEventListener('click', () => openCategoryModal(container));
  container.querySelector('#navBizExpenses')?.addEventListener('click', () => navigate('biz-expenses'));
  container.querySelector('#navBizSales')?.addEventListener('click', () => navigate('biz-sales'));

  container.querySelectorAll('[data-edit-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = getBusinessCategories().find(c => c.id === btn.dataset.editCat);
      if (cat) openCategoryModal(container, cat);
    });
  });
  container.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteCategory(container, btn.dataset.delCat));
  });
  container.querySelectorAll('[data-edit-txn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const txn = getBusinessTransactions().find(t => t.id === btn.dataset.editTxn);
      if (txn) openBizTransactionModal(container, txn.type, txn);
    });
  });
  container.querySelectorAll('[data-del-txn]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteTransaction(container, btn.dataset.delTxn));
  });
}

// ===== BUSINESS EXPENSES PAGE =====

export function renderBizExpenses(container) {
  const profile = requireProfile(container);
  if (!profile) return;

  const settings = getSettings();
  const txns = getBusinessTransactions().filter(t => t.type === 'expense');
  const totalExpenses = sumAmount(txns);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Business Expenses</h2>
          <p class="text-sm text-muted">${txns.length} transactions · Total: ${fmt(totalExpenses, settings.currency)}</p>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" id="exportBizExpenses">Export CSV</button>
          <button class="btn btn-primary" id="addBizExpense">+ Add Expense</button>
        </div>
      </div>

      ${renderSummaryCards(txns, 'expense', settings.currency)}
      ${renderFilterBar('expense', txns.length)}

      <div class="panel">
        <div class="panel-header">
          <h3>All Expenses</h3>
        </div>
        <div id="bizTxnList">
          ${txns.length
            ? txns.slice().reverse().map(t => renderTransactionRow(t, getCategoryMap(getBusinessCategories()), settings.currency)).join('')
            : '<p class="empty-state text-muted" style="padding:20px 0">No expenses recorded yet</p>'
          }
        </div>
      </div>
    </div>`;

  populateCategoryFilter(container, 'expense');
  container.querySelector('#addBizExpense')?.addEventListener('click', () => openBizTransactionModal(container, 'expense'));
  container.querySelector('#exportBizExpenses')?.addEventListener('click', () => exportBizTransactionsCSV('expense'));

  ['bizSearch', 'bizFilterCat', 'bizFilterPayment', 'bizFilterFrom', 'bizFilterTo'].forEach(id => {
    container.querySelector('#' + id)?.addEventListener('input', () => applyFilters(container, 'expense'));
    container.querySelector('#' + id)?.addEventListener('change', () => applyFilters(container, 'expense'));
  });

  applyFilters(container, 'expense');
}

// ===== BUSINESS SALES PAGE =====

export function renderBizSales(container) {
  const profile = requireProfile(container);
  if (!profile) return;

  const settings = getSettings();
  const txns = getBusinessTransactions().filter(t => t.type === 'income');
  const totalSales = sumAmount(txns);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Sales</h2>
          <p class="text-sm text-muted">${txns.length} transactions · Total: ${fmt(totalSales, settings.currency)}</p>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" id="exportBizSales">Export CSV</button>
          <button class="btn btn-primary" id="addBizSale">+ Record Sale</button>
        </div>
      </div>

      ${renderSummaryCards(txns, 'income', settings.currency)}
      ${renderFilterBar('income', txns.length)}

      <div class="panel">
        <div class="panel-header">
          <h3>All Sales</h3>
        </div>
        <div id="bizTxnList">
          ${txns.length
            ? txns.slice().reverse().map(t => renderTransactionRow(t, getCategoryMap(getBusinessCategories()), settings.currency)).join('')
            : '<p class="empty-state text-muted" style="padding:20px 0">No sales recorded yet</p>'
          }
        </div>
      </div>
    </div>`;

  populateCategoryFilter(container, 'income');
  container.querySelector('#addBizSale')?.addEventListener('click', () => openBizTransactionModal(container, 'income'));
  container.querySelector('#exportBizSales')?.addEventListener('click', () => exportBizTransactionsCSV('income'));

  ['bizSearch', 'bizFilterCat', 'bizFilterPayment', 'bizFilterFrom', 'bizFilterTo'].forEach(id => {
    container.querySelector('#' + id)?.addEventListener('input', () => applyFilters(container, 'income'));
    container.querySelector('#' + id)?.addEventListener('change', () => applyFilters(container, 'income'));
  });

  applyFilters(container, 'income');
}

// ===== BUSINESS REPORTS =====

export function renderBizReports(container) {
  const profile = requireProfile(container);
  if (!profile) return;

  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();
  const catMap = getCategoryMap(categories);

  const now = new Date();
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();

  const allExpenses = txns.filter(t => t.type === 'expense');
  const allIncome = txns.filter(t => t.type === 'income');
  const monthExpenses = filterByDateRange(allExpenses, monthStart, monthEnd);
  const monthIncome = filterByDateRange(allIncome, monthStart, monthEnd);

  const totalExpenses = sumAmount(allExpenses);
  const totalIncome = sumAmount(allIncome);
  const totalTaxPaid = sumTax(allExpenses);
  const totalTaxCollected = sumTax(allIncome);
  const profit = totalIncome - totalExpenses;
  const profitMargin = totalIncome ? ((profit / totalIncome) * 100).toFixed(1) : '0.0';

  const monthExpTotal = sumAmount(monthExpenses);
  const monthIncTotal = sumAmount(monthIncome);

  const catMap2 = {};
  allExpenses.forEach(t => { catMap2[t.category] = (catMap2[t.category] || 0) + t.amount; });
  const catBreakdown = Object.entries(catMap2)
    .map(([catId, amount]) => {
      const cat = catMap[catId];
      return { name: cat ? cat.name : 'Unknown', icon: cat ? cat.icon : '📋', amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Business Reports</h2>
          <p class="text-sm text-muted">${escapeHTML(profile.name)} — ${monthName}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="exportBizReport">Export Report</button>
      </div>

      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));margin-bottom:24px">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Total Income</div><div class="card-value green">${fmt(totalIncome, settings.currency)}</div></div>
        <div class="card"><div class="card-label">🏦 Net Profit</div><div class="card-value ${profit >= 0 ? 'green' : 'red'}">${fmt(profit, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Profit Margin</div><div class="card-value accent">${profitMargin}%</div></div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>This Month</h3></div>
          <div style="padding:12px;background:var(--bg3);margin-bottom:8px">
            <div class="flex flex-center flex-between mb-8">
              <span class="text-sm" style="font-weight:500">Income</span>
              <span class="text-sm" style="font-weight:600;color:var(--green)">${fmt(monthIncTotal, settings.currency)}</span>
            </div>
            <div class="flex flex-center flex-between mb-8">
              <span class="text-sm" style="font-weight:500">Expenses</span>
              <span class="text-sm" style="font-weight:600;color:var(--red)">${fmt(monthExpTotal, settings.currency)}</span>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
              <div class="flex flex-center flex-between">
                <span class="text-sm" style="font-weight:600">Net</span>
                <span class="text-sm" style="font-weight:600;color:${monthIncTotal - monthExpTotal >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(monthIncTotal - monthExpTotal, settings.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Tax Summary</h3></div>
          <div style="padding:12px;background:var(--bg3);margin-bottom:8px">
            <div class="flex flex-center flex-between mb-8">
              <span class="text-sm" style="font-weight:500">Tax Paid (expenses)</span>
              <span class="text-sm" style="font-weight:600;color:var(--red)">${fmt(totalTaxPaid, settings.currency)}</span>
            </div>
            <div class="flex flex-center flex-between mb-8">
              <span class="text-sm" style="font-weight:500">Tax Collected (sales)</span>
              <span class="text-sm" style="font-weight:600;color:var(--green)">${fmt(totalTaxCollected, settings.currency)}</span>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
              <div class="flex flex-center flex-between">
                <span class="text-sm" style="font-weight:600">Net Tax</span>
                <span class="text-sm" style="font-weight:600;color:${totalTaxCollected - totalTaxPaid >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(totalTaxCollected - totalTaxPaid, settings.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Expense Breakdown by Category</h3>
        </div>
        <div id="bizCatBreakdown">
          ${catBreakdown.length ? catBreakdown.map(c => {
            const pct = totalExpenses ? (c.amount / totalExpenses * 100) : 0;
            return `
              <div style="margin-bottom:12px">
                <div class="flex flex-center flex-between mb-8">
                  <span class="text-sm">${c.icon} ${escapeHTML(c.name)}</span>
                  <span class="text-sm" style="font-weight:600">${fmt(c.amount, settings.currency)} <span class="text-muted">(${pct.toFixed(1)}%)</span></span>
                </div>
                <div class="progress-bar" style="height:4px">
                  <div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div>
                </div>
              </div>`;
          }).join('') : '<p class="text-muted text-sm">No expenses recorded yet</p>'}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Monthly Profit/Loss Trend</h3></div>
        <div class="chart-container" style="height:200px">
          <canvas id="bizPLChart" aria-label="Monthly profit loss chart"></canvas>
        </div>
      </div>
    </div>`;

  container.querySelector('#exportBizReport')?.addEventListener('click', () => exportBizReportCSV(profile, settings));

  setTimeout(() => drawBizPLChart('bizPLChart', allExpenses, allIncome, settings.currency), 50);
}

// ===== CHART: PROFIT/LOSS TREND =====

function drawBizPLChart(canvasId, allExpenses, allIncome, currency) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '200px';
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = 200;

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ms = getMonthStart(-i);
    const me = getMonthEnd(-i);
    const exp = filterByDateRange(allExpenses, ms, me).reduce((s, t) => s + t.amount, 0);
    const inc = filterByDateRange(allIncome, ms, me).reduce((s, t) => s + t.amount, 0);
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), income: inc, expense: exp, profit: inc - exp });
  }

  const maxAbs = Math.max(...months.map(m => Math.abs(m.profit)), 1);
  const padTop = 30;
  const padBottom = 40;
  const padLeft = 60;
  const padRight = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const barW = chartW / months.length * 0.6;
  const gap = chartW / months.length;
  const zeroY = padTop + chartH / 2;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';
  ctx.font = '10px var(--font-mono)';
  ctx.textAlign = 'right';
  ctx.fillText(fmt(0, currency), padLeft - 8, zeroY + 4);
    ctx.fillText(fmtCompact(maxAbs, currency), padLeft - 8, padTop + 10);
    ctx.fillText('-' + fmtCompact(maxAbs, currency), padLeft - 8, H - padBottom);

  ctx.strokeStyle = 'rgba(128,128,128,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, zeroY);
  ctx.lineTo(W - padRight, zeroY);
  ctx.stroke();

  months.forEach((m, i) => {
    const x = padLeft + i * gap + gap / 2 - barW / 2;
    const barH = (Math.abs(m.profit) / maxAbs) * (chartH / 2);
    const y = m.profit >= 0 ? zeroY - barH : zeroY;

    ctx.fillStyle = m.profit >= 0 ? '#4caf50' : '#f44336';
    ctx.beginPath();
    const r = 3;
    ctx.roundRect(x, y, barW, barH, r);
    ctx.fill();

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';
    ctx.font = '10px var(--font-mono)';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, padLeft + i * gap + gap / 2, H - padBottom + 16);
  });
}

// ===== CSV EXPORT =====

function exportBizTransactionsCSV(type) {
  const txns = getBusinessTransactions().filter(t => t.type === type);
  const catMap = getCategoryMap(getBusinessCategories());
  const settings = getSettings();

  const header = 'Date,Category,Description,Amount,Tax,Payment\n';
  const rows = txns.map(t => {
    const cat = catMap[t.category];
    return [
      t.date,
      cat ? cat.name : 'Uncategorized',
      (t.description || '').replace(/,/g, ';'),
      t.amount.toFixed(2),
      (t.tax || 0).toFixed(2),
      BUSINESS_PAYMENT_LABELS[t.payment] || t.payment
    ].join(',');
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spendwise-biz-${type}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toastSuccess(`${type === 'expense' ? 'Expenses' : 'Sales'} exported as CSV`);
}

function exportBizReportCSV(profile, settings) {
  const txns = getBusinessTransactions();
  const allExpenses = txns.filter(t => t.type === 'expense');
  const allIncome = txns.filter(t => t.type === 'income');
  const totalExpenses = sumAmount(allExpenses);
  const totalIncome = sumAmount(allIncome);
  const catMap = getCategoryMap(getBusinessCategories());

  let csv = `Business Report - ${profile.name}\n`;
  csv += `Generated: ${today()}\n\n`;
  csv += `Total Expenses,${totalExpenses.toFixed(2)}\n`;
  csv += `Total Income,${totalIncome.toFixed(2)}\n`;
  csv += `Net Profit,${(totalIncome - totalExpenses).toFixed(2)}\n`;
  csv += `Profit Margin,${totalIncome ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%\n`;
  csv += `Tax Paid,${sumTax(allExpenses).toFixed(2)}\n`;
  csv += `Tax Collected,${sumTax(allIncome).toFixed(2)}\n\n`;

  csv += 'Category Breakdown\nCategory,Type,Amount,Count\n';
  const catAgg = {};
  txns.forEach(t => {
    const key = t.category;
    if (!catAgg[key]) catAgg[key] = { amount: 0, count: 0, type: t.type };
    catAgg[key].amount += t.amount;
    catAgg[key].count++;
  });
  Object.entries(catAgg).forEach(([catId, data]) => {
    const cat = catMap[catId];
    csv += `"${cat ? cat.name : 'Unknown'}",${data.type},${data.amount.toFixed(2)},${data.count}\n`;
  });

  csv += '\nTransactions\nDate,Type,Category,Amount,Tax,Description,Payment\n';
  txns.forEach(t => {
    const cat = catMap[t.category];
    csv += `${t.date},${t.type},"${cat ? cat.name : 'Unknown'}",${t.amount.toFixed(2)},${(t.tax || 0).toFixed(2)},"${(t.description || '').replace(/"/g, '""')}",${BUSINESS_PAYMENT_LABELS[t.payment] || t.payment}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spendwise-biz-report-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toastSuccess('Business report exported as CSV');
}
