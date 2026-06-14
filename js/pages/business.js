// ===== BUSINESS MODE PAGE =====
import { getBusinessProfile, setBusinessProfile, getBusinessTransactions, getBusinessCategories, addBusinessCategory, deleteBusinessCategory, getSettings } from '../store.js';
import { fmt, today, uid } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastError } from '../toast.js';

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

function setupBusinessProfile(container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>Set Up Business Profile</h3>
      <p class="text-sm text-muted mb-16">Tell us about your business to customize categories and reports.</p>
      <div class="input-group mb-16">
        <label for="bizName">Business Name</label>
        <input type="text" class="input" id="bizName" placeholder="e.g. My Shop" required>
      </div>
      <div class="input-group mb-16">
        <label>Business Type</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="bizTypeGrid">
          ${BUSINESS_TYPES.map(t => `
            <div class="panel" style="cursor:pointer;padding:12px;text-align:center" data-type="${t.id}">
              <div style="font-size:1.5rem;margin-bottom:4px">${t.icon}</div>
              <div class="text-sm">${t.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="input-group mb-16">
        <label for="bizTaxId">Tax ID / BIN (optional)</label>
        <input type="text" class="input" id="bizTaxId" placeholder="e.g. 123456789">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="bizProfileSave">Save Profile</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let selectedType = null;

  overlay.querySelectorAll('[data-type]').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('[data-type]').forEach(e => e.style.borderColor = '');
      el.style.borderColor = 'var(--accent)';
      selectedType = el.dataset.type;
    });
  });

  overlay.querySelector('#bizProfileSave').addEventListener('click', () => {
    const name = overlay.querySelector('#bizName').value.trim();
    if(!name) { toastError('Business name is required'); return; }
    if(!selectedType) { toastError('Select a business type'); return; }
    const taxId = overlay.querySelector('#bizTaxId').value.trim();

    setBusinessProfile({ name, type: selectedType, taxId });

    // Setup default categories
    const defaults = DEFAULT_CATEGORIES[selectedType];
    if(defaults) {
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

    overlay.remove();
    toastSuccess('Business profile created!');
    renderBusiness(container);
  });
}

export function renderBusiness(container) {
  const profile = getBusinessProfile();
  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();

  // If no profile, show setup
  if(!profile) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="header">
          <div>
            <h2>Business Mode</h2>
            <p class="text-sm text-muted">Set up your business to start tracking expenses and sales</p>
          </div>
        </div>
        <div class="panel" style="text-align:center;padding:60px 20px">
          <div style="font-size:4rem;margin-bottom:16px">🏪</div>
          <h3 style="margin-bottom:8px">Welcome to Business Mode</h3>
          <p class="text-sm text-muted mb-20">Set up your business profile to get started with expense tracking, sales recording, and tax calculations.</p>
          <button class="btn btn-primary" id="setupBizProfile">Set Up Business Profile</button>
        </div>
      </div>
    `;
    container.querySelector('#setupBizProfile')?.addEventListener('click', () => setupBusinessProfile(container));
    return;
  }

  // Business dashboard
  const totalExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalTax = txns.reduce((s, t) => s + (t.tax || 0), 0);
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
        <div class="card"><div class="card-label">🏦 Net Profit</div><div class="card-value ${totalIncome - totalExpenses >= 0 ? 'green' : 'red'}">${fmt(totalIncome - totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Tax Collected</div><div class="card-value accent">${fmt(totalTax, settings.currency)}</div></div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Quick Actions</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-primary" id="addBizExpense">+ Add Expense</button>
            <button class="btn btn-primary" id="addBizSale">+ Record Sale</button>
            <button class="btn btn-ghost" data-action="biz-expenses">View Expenses</button>
            <button class="btn btn-ghost" data-action="biz-sales">View Sales</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Categories</h3></div>
          <div style="max-height:200px;overflow-y:auto">
            ${categories.length ? categories.map(c => `
              <div class="flex flex-center flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
                <span class="text-sm">${c.icon} ${escapeHTML(c.name)}</span>
                <span class="text-sm text-muted">${c.type === 'expense' ? 'Expense' : 'Income'} · ${c.taxRate}% tax</span>
              </div>
            `).join('') : '<p class="text-muted text-sm">No categories yet</p>'}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Recent Transactions</h3>
          <span class="text-sm text-muted">${txns.length} total</span>
        </div>
        ${txns.slice(-10).reverse().map(t => {
          const cat = categories.find(c => c.id === t.category);
          return `
            <div class="flex flex-center flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-8">
                <span style="font-size:1.2rem">${cat ? cat.icon : '📋'}</span>
                <div>
                  <div class="text-sm" style="font-weight:500">${escapeHTML(t.description || (cat ? cat.name : 'Transaction'))}</div>
                  <div class="text-sm text-muted">${escapeHTML(t.date)}</div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:600;color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'}">${t.type === 'income' ? '+' : '-'} ${fmt(t.amount, settings.currency)}</div>
                ${t.tax ? `<div class="text-sm text-muted">Tax: ${fmt(t.tax, settings.currency)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('') || '<p class="empty-state text-muted">No transactions yet</p>'}
      </div>
    </div>
  `;

  // Bind events
  container.querySelector('#editBizProfile')?.addEventListener('click', () => setupBusinessProfile(container));
  container.querySelector('#addBizExpense')?.addEventListener('click', () => navigate('biz-expenses'));
  container.querySelector('#addBizSale')?.addEventListener('click', () => navigate('biz-sales'));
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.action));
  });
}

// Placeholder pages for business nav
function openBizExpenseModal(container) {
  const categories = getBusinessCategories().filter(c => c.type === 'expense');
  const settings = getSettings();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>Add Business Expense</h3>
      <div class="form-row">
        <div class="input-group">
          <label for="bizExpAmount">Amount (${settings.currency})</label>
          <input type="number" class="input" id="bizExpAmount" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="input-group">
          <label for="bizExpDate">Date</label>
          <input type="date" class="input" id="bizExpDate" value="${today()}" required>
        </div>
      </div>
      <div class="input-group">
        <label for="bizExpCategory">Category</label>
        <select class="input" id="bizExpCategory" required>
          <option value="">Select category</option>
          ${categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHTML(c.name)} (${c.taxRate}% tax)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="bizExpDesc">Description</label>
        <input type="text" class="input" id="bizExpDesc" placeholder="What was this expense for?">
      </div>
      <div class="input-group">
        <label for="bizExpPayment">Payment Method</label>
        <select class="input" id="bizExpPayment">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank">Bank Transfer</option>
          <option value="mobile">Mobile Payment</option>
        </select>
      </div>
      <div id="bizExpTaxInfo" class="text-sm text-muted mb-16" style="padding:8px;background:var(--bg3);display:none">
        Tax will be calculated automatically based on category.
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="bizExpCancel">Cancel</button>
        <button class="btn btn-primary" id="bizExpSave">Save Expense</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Show tax info when category is selected
  overlay.querySelector('#bizExpCategory').addEventListener('change', (e) => {
    const cat = categories.find(c => c.id === e.target.value);
    const taxInfo = overlay.querySelector('#bizExpTaxInfo');
    if(cat && cat.taxRate > 0) {
      taxInfo.style.display = 'block';
      taxInfo.textContent = `Tax: ${cat.taxRate}% (${settings.currency} will be added as tax)`;
    } else {
      taxInfo.style.display = 'none';
    }
  });

  overlay.querySelector('#bizExpCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });

  overlay.querySelector('#bizExpSave').addEventListener('click', () => {
    const amount = parseFloat(overlay.querySelector('#bizExpAmount').value);
    const date = overlay.querySelector('#bizExpDate').value;
    const categoryId = overlay.querySelector('#bizExpCategory').value;
    const description = overlay.querySelector('#bizExpDesc').value.trim();
    const payment = overlay.querySelector('#bizExpPayment').value;

    if(!amount || amount <= 0) { toastError('Enter a valid amount'); return; }
    if(!date) { toastError('Select a date'); return; }
    if(!categoryId) { toastError('Select a category'); return; }

    const cat = categories.find(c => c.id === categoryId);
    const tax = cat && cat.taxRate > 0 ? amount * (cat.taxRate / 100) : 0;

    addBusinessTransaction({
      id: uid(),
      type: 'expense',
      amount,
      tax,
      taxRate: cat ? cat.taxRate : 0,
      date,
      category: categoryId,
      description,
      payment,
      createdBy: 'owner'
    });

    toastSuccess('Expense added!');
    overlay.remove();
    renderBizExpenses(container);
  });
}

export function renderBizExpenses(container) {
  const profile = getBusinessProfile();
  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if(!profile) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="header"><h2>Business Expenses</h2></div>
        <div class="panel" style="text-align:center;padding:40px">
          <p class="text-muted">Please set up your business profile first.</p>
          <button class="btn btn-primary mt-16" onclick="document.querySelector('[data-page=business]')?.click()">Go to Business Home</button>
        </div>
      </div>
    `;
    return;
  }

  const expenses = txns.filter(t => t.type === 'expense');
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const totalTax = expenses.reduce((s, t) => s + (t.tax || 0), 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Business Expenses</h2>
          <p class="text-sm text-muted">${expenses.length} transactions · Total: ${fmt(totalExpenses, settings.currency)}</p>
        </div>
        <button class="btn btn-primary" id="addBizExpense">+ Add Expense</button>
      </div>

      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));margin-bottom:24px">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Tax Paid</div><div class="card-value accent">${fmt(totalTax, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📝 This Month</div><div class="card-value">${fmt(expenses.filter(t => t.date >= today().slice(0, 7) + '-01').reduce((s, t) => s + t.amount, 0), settings.currency)}</div></div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>All Expenses</h3>
          <span class="text-sm text-muted">${expenses.length} total</span>
        </div>
        ${expenses.length ? expenses.slice().reverse().map(t => {
          const cat = categories.find(c => c.id === t.category);
          return `
            <div class="flex flex-center flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-8">
                <span style="font-size:1.2rem">${cat ? cat.icon : '📋'}</span>
                <div>
                  <div class="text-sm" style="font-weight:500">${escapeHTML(t.description || (cat ? cat.name : 'Expense'))}</div>
                  <div class="text-sm text-muted">${escapeHTML(t.date)} · ${cat ? escapeHTML(cat.name) : 'Uncategorized'}</div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:600;color:var(--red)">- ${fmt(t.amount, settings.currency)}</div>
                ${t.tax ? `<div class="text-sm text-muted">Tax: ${fmt(t.tax, settings.currency)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('') : '<p class="empty-state text-muted">No expenses recorded yet</p>'}
      </div>
    </div>
  `;

  container.querySelector('#addBizExpense')?.addEventListener('click', () => openBizExpenseModal(container));
}

export function renderBizSales(container) {
  const profile = getBusinessProfile();
  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();

  if(!profile) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="header"><h2>Sales</h2></div>
        <div class="panel" style="text-align:center;padding:40px">
          <p class="text-muted">Please set up your business profile first.</p>
          <button class="btn btn-primary mt-16" onclick="document.querySelector('[data-page=business]')?.click()">Go to Business Home</button>
        </div>
      </div>
    `;
    return;
  }

  const sales = txns.filter(t => t.type === 'income');
  const totalSales = sales.reduce((s, t) => s + t.amount, 0);
  const totalTax = sales.reduce((s, t) => s + (t.tax || 0), 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Sales</h2>
          <p class="text-sm text-muted">${sales.length} transactions · Total: ${fmt(totalSales, settings.currency)}</p>
        </div>
        <button class="btn btn-primary" id="addBizSale">+ Record Sale</button>
      </div>

      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));margin-bottom:24px">
        <div class="card"><div class="card-label">💰 Total Sales</div><div class="card-value green">${fmt(totalSales, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Tax Collected</div><div class="card-value accent">${fmt(totalTax, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📝 This Month</div><div class="card-value">${fmt(sales.filter(t => t.date >= today().slice(0, 7) + '-01').reduce((s, t) => s + t.amount, 0), settings.currency)}</div></div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>All Sales</h3>
          <span class="text-sm text-muted">${sales.length} total</span>
        </div>
        ${sales.length ? sales.slice().reverse().map(t => {
          const cat = categories.find(c => c.id === t.category);
          return `
            <div class="flex flex-center flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-8">
                <span style="font-size:1.2rem">${cat ? cat.icon : '💰'}</span>
                <div>
                  <div class="text-sm" style="font-weight:500">${escapeHTML(t.description || (cat ? cat.name : 'Sale'))}</div>
                  <div class="text-sm text-muted">${escapeHTML(t.date)} · ${cat ? escapeHTML(cat.name) : 'Uncategorized'}</div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:600;color:var(--green)">+ ${fmt(t.amount, settings.currency)}</div>
                ${t.tax ? `<div class="text-sm text-muted">Tax: ${fmt(t.tax, settings.currency)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('') : '<p class="empty-state text-muted">No sales recorded yet</p>'}
      </div>
    </div>
  `;

  container.querySelector('#addBizSale')?.addEventListener('click', () => openBizSaleModal(container));
}

function openBizSaleModal(container) {
  const categories = getBusinessCategories().filter(c => c.type === 'income');
  const settings = getSettings();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>Record Sale</h3>
      <div class="form-row">
        <div class="input-group">
          <label for="bizSaleAmount">Amount (${settings.currency})</label>
          <input type="number" class="input" id="bizSaleAmount" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="input-group">
          <label for="bizSaleDate">Date</label>
          <input type="date" class="input" id="bizSaleDate" value="${today()}" required>
        </div>
      </div>
      <div class="input-group">
        <label for="bizSaleCategory">Category</label>
        <select class="input" id="bizSaleCategory" required>
          <option value="">Select category</option>
          ${categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHTML(c.name)} (${c.taxRate}% tax)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="bizSaleDesc">Description</label>
        <input type="text" class="input" id="bizSaleDesc" placeholder="Sale details (optional)">
      </div>
      <div class="input-group">
        <label for="bizSalePayment">Payment Method</label>
        <select class="input" id="bizSalePayment">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank">Bank Transfer</option>
          <option value="mobile">Mobile Payment</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="bizSaleCancel">Cancel</button>
        <button class="btn btn-primary" id="bizSaleSave">Save Sale</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#bizSaleCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });

  overlay.querySelector('#bizSaleSave').addEventListener('click', () => {
    const amount = parseFloat(overlay.querySelector('#bizSaleAmount').value);
    const date = overlay.querySelector('#bizSaleDate').value;
    const categoryId = overlay.querySelector('#bizSaleCategory').value;
    const description = overlay.querySelector('#bizSaleDesc').value.trim();
    const payment = overlay.querySelector('#bizSalePayment').value;

    if(!amount || amount <= 0) { toastError('Enter a valid amount'); return; }
    if(!date) { toastError('Select a date'); return; }
    if(!categoryId) { toastError('Select a category'); return; }

    const cat = categories.find(c => c.id === categoryId);
    const tax = cat && cat.taxRate > 0 ? amount * (cat.taxRate / 100) : 0;

    addBusinessTransaction({
      id: uid(),
      type: 'income',
      amount,
      tax,
      taxRate: cat ? cat.taxRate : 0,
      date,
      category: categoryId,
      description,
      payment,
      createdBy: 'owner'
    });

    toastSuccess('Sale recorded!');
    overlay.remove();
    renderBizSales(container);
  });
}

export function renderBizReports(container) {
  const profile = getBusinessProfile();
  const settings = getSettings();
  const txns = getBusinessTransactions();
  const categories = getBusinessCategories();

  if(!profile) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="header"><h2>Business Reports</h2></div>
        <div class="panel" style="text-align:center;padding:40px">
          <p class="text-muted">Please set up your business profile first.</p>
          <button class="btn btn-primary mt-16" onclick="document.querySelector('[data-page=business]')?.click()">Go to Business Home</button>
        </div>
      </div>
    `;
    return;
  }

  const now = new Date();
  const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const allExpenses = txns.filter(t => t.type === 'expense');
  const allIncome = txns.filter(t => t.type === 'income');
  const monthExpenses = allExpenses.filter(t => t.date >= monthStart && t.date <= monthEnd);
  const monthIncome = allIncome.filter(t => t.date >= monthStart && t.date <= monthEnd);

  const totalExpenses = allExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = allIncome.reduce((s, t) => s + t.amount, 0);
  const totalTaxPaid = allExpenses.reduce((s, t) => s + (t.tax || 0), 0);
  const totalTaxCollected = allIncome.reduce((s, t) => s + (t.tax || 0), 0);

  const monthExpTotal = monthExpenses.reduce((s, t) => s + t.amount, 0);
  const monthIncTotal = monthIncome.reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const catMap = {};
  allExpenses.forEach(t => {
    if(!catMap[t.category]) catMap[t.category] = 0;
    catMap[t.category] += t.amount;
  });
  const catBreakdown = Object.entries(catMap)
    .map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
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
      </div>

      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));margin-bottom:24px">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Total Income</div><div class="card-value green">${fmt(totalIncome, settings.currency)}</div></div>
        <div class="card"><div class="card-label">🏦 Net Profit</div><div class="card-value ${totalIncome - totalExpenses >= 0 ? 'green' : 'red'}">${fmt(totalIncome - totalExpenses, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Profit Margin</div><div class="card-value accent">${totalIncome ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%</div></div>
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
              <span class="text-sm" style="font-weight:500">Tax Paid (on expenses)</span>
              <span class="text-sm" style="font-weight:600;color:var(--red)">${fmt(totalTaxPaid, settings.currency)}</span>
            </div>
            <div class="flex flex-center flex-between mb-8">
              <span class="text-sm" style="font-weight:500">Tax Collected (on sales)</span>
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
            </div>
          `;
        }).join('') : '<p class="text-muted text-sm">No expenses recorded yet</p>'}
      </div>
    </div>
  `;
}