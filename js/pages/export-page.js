// ===== EXPORT PAGE =====
import { getTransactions, getBudgets, getSavingsGoals, getRecurringList, addBulkTransactions, replaceAllData, getBusinessProfile, getBusinessTransactions, getBusinessCategories } from '../store.js';
import { today, fmt, getCat, escapeCSV, parseCSVSimple, detectBankFormat, mapCSVRow, sanitizeImportData, uid } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastError } from '../toast.js';
import { encryptData, decryptData, hasPIN, verifyPIN } from '../security.js';

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function promptPassword({ title, message, hint, confirm, confirmLabel, onValidate }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal" style="max-width:380px">
        <h3>${title}</h3>
        <p class="text-sm text-muted mb-16">${message}</p>
        ${hint ? `<p class="text-sm mb-16" style="color:var(--accent);font-style:italic">${hint}</p>` : ''}
        <div class="input-group" style="margin-bottom:12px">
          <label class="text-sm" style="font-weight:500;margin-bottom:4px;display:block">Password</label>
          <input type="password" class="input" id="promptPassInput" placeholder="Enter password" autocomplete="off">
        </div>
        ${confirm ? `
        <div class="input-group" style="margin-bottom:8px">
          <label class="text-sm" style="font-weight:500;margin-bottom:4px;display:block">${confirmLabel || 'Confirm Password'}</label>
          <input type="password" class="input" id="promptPassConfirm" placeholder="Re-enter password" autocomplete="off">
        </div>
        ` : ''}
        <div class="lock-error" id="promptPassError" style="margin-bottom:8px;min-height:20px"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="promptPassCancel">Cancel</button>
          <button class="btn btn-primary" id="promptPassOk">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#promptPassInput');
    const confirmInput = overlay.querySelector('#promptPassConfirm');
    const errorEl = overlay.querySelector('#promptPassError');
    input.focus();

    function showError(msg) {
      if(errorEl) errorEl.textContent = msg;
      input.style.borderColor = msg ? 'var(--red)' : '';
    }

    const cleanup = (val) => { overlay.remove(); resolve(val); };

    async function handleSubmit() {
      const pass = input.value;
      if(confirm && confirmInput && pass !== confirmInput.value) {
        confirmInput.style.borderColor = 'var(--red)';
        confirmInput.focus();
        return;
      }
      if(onValidate) {
        const err = await onValidate(pass);
        if(err) { showError(err); input.focus(); return; }
      }
      cleanup(pass);
    }

    overlay.querySelector('#promptPassCancel').addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', e => { if(e.target === overlay) cleanup(null); });
    overlay.querySelector('#promptPassOk').addEventListener('click', handleSubmit);
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter') {
        if(confirm && confirmInput) confirmInput.focus();
        else handleSubmit();
      }
      if(e.key === 'Escape') cleanup(null);
    });
    input.addEventListener('input', () => { showError(''); input.style.borderColor = ''; });
    if(confirmInput) {
      confirmInput.addEventListener('keydown', e => {
        if(e.key === 'Enter') handleSubmit();
        if(e.key === 'Escape') cleanup(null);
      });
      confirmInput.addEventListener('input', () => { confirmInput.style.borderColor = ''; });
    }
  });
}

// ===== EXPORT FUNCTIONS =====
function exportTransactionsCSV() {
  const header = 'Date,Type,Category,Amount,Payment,Description,Tags,Recurring\n';
  const rows = getTransactions().map(t =>
    [t.date, t.type, escapeCSV(getCat(t.category).name), t.amount, t.payment, escapeCSV(t.description || ''), escapeCSV((t.tags || []).join(';')), t.recurring || false].join(',')
  ).join('\n');
  download(header + rows, 'spendwise-transactions.csv', 'text/csv');
  toastSuccess('Transactions CSV exported');
}

function exportBudgetsCSV() {
  const header = 'Category,Monthly Limit,Spent This Month\n';
  const now = new Date();
  const ms = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const txns = getTransactions();

  const rows = getBudgets().map(b => {
    const spent = txns.filter(t => t.type === 'expense' && t.category === b.category && t.date >= ms && t.date <= me).reduce((s, t) => s + t.amount, 0);
    return [escapeCSV(getCat(b.category).name), b.limit, spent.toFixed(2)].join(',');
  }).join('\n');
  download(header + rows, 'spendwise-budgets.csv', 'text/csv');
  toastSuccess('Budgets CSV exported');
}

function exportSavingsCSV() {
  const header = 'Goal Name,Target,Current Saved,Progress %,Target Date,Created\n';
  const rows = getSavingsGoals().map(g => {
    const pct = g.target ? (g.current / g.target * 100).toFixed(1) : '0';
    return [escapeCSV(g.name), g.target, g.current, pct + '%', g.date || '', g.createdAt || ''].join(',');
  }).join('\n');
  download(header + rows, 'spendwise-savings.csv', 'text/csv');
  toastSuccess('Savings goals CSV exported');
}

function exportRecurringCSV() {
  const header = 'Description,Amount,Frequency,Category,Start Date,Next Date,Active\n';
  const rows = getRecurringList().map(r =>
    [escapeCSV(r.description), r.amount, r.frequency, escapeCSV(getCat(r.category).name), r.startDate, r.nextDate, r.active].join(',')
  ).join('\n');
  download(header + rows, 'spendwise-recurring.csv', 'text/csv');
  toastSuccess('Recurring expenses CSV exported');
}

function exportJSON() {
  const data = {
    transactions: getTransactions(),
    budgets: getBudgets(),
    savingsGoals: getSavingsGoals(),
    recurringList: getRecurringList(),
    businessProfile: getBusinessProfile(),
    businessTransactions: getBusinessTransactions(),
    businessCategories: getBusinessCategories(),
    exportDate: today()
  };
  download(JSON.stringify(data, null, 2), 'spendwise-backup.json', 'application/json');
  toastSuccess('JSON backup exported');
}

function exportMonthlyReport() {
  const settings = { currency: '₹' };
  try { settings.currency = JSON.parse(localStorage.getItem('sw_settings'))?.currency || '₹'; } catch {}
  const now = new Date();
  const ms = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const txns = getTransactions();
  const exp = txns.filter(t => t.type === 'expense' && t.date >= ms && t.date <= me);
  const inc = txns.filter(t => t.type === 'income' && t.date >= ms && t.date <= me);

  const catMap = {};
  exp.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const catData = Object.entries(catMap).map(([cat, val]) => ({ category: cat, amount: val })).sort((a, b) => b.amount - a.amount);
  const total = exp.reduce((s, t) => s + t.amount, 0);

  let csv = `Monthly Report - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\n`;
  csv += `Total Expenses,${total.toFixed(2)}\n`;
  csv += `Total Income,${inc.reduce((s, t) => s + t.amount, 0).toFixed(2)}\n\n`;
  csv += 'Category,Amount,Percentage\n';
  catData.forEach(c => { csv += `"${getCat(c.category).name}",${c.amount.toFixed(2)},${(c.amount / total * 100).toFixed(1)}%\n`; });
  csv += '\nTransactions\nDate,Type,Category,Amount,Description\n';
  exp.concat(inc).sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    csv += `${t.date},${t.type},"${getCat(t.category).name}",${t.amount},"${escapeCSV(t.description || '')}"\n`;
  });
  download(csv, 'spendwise-monthly-report.csv', 'text/csv');
  toastSuccess('Monthly report exported');
}

// ===== ENCRYPTED EXPORT/IMPORT =====
async function exportEncrypted() {
  window.__pauseAutoLock?.();

  if(!hasPIN()) {
    toastError('Set up a lock screen PIN first (Settings > Lock Screen)');
    window.__resumeAutoLock?.();
    return;
  }

  const pin = await promptPassword({
    title: 'Verify PIN',
    message: 'Enter your lock screen PIN to encrypt this backup:',
    hint: 'Your backup will be encrypted with this PIN.',
    onValidate: async (val) => {
      if(!val) return 'PIN is required';
      const valid = await verifyPIN(val);
      if(!valid) return 'Incorrect PIN';
      return null;
    }
  });
  if(pin === null) { window.__resumeAutoLock?.(); return; }

  const data = {
    transactions: getTransactions(),
    budgets: getBudgets(),
    savingsGoals: getSavingsGoals(),
    recurringList: getRecurringList(),
    businessProfile: getBusinessProfile(),
    businessTransactions: getBusinessTransactions(),
    businessCategories: getBusinessCategories(),
    exportDate: today(),
    app: 'SpendWise',
    version: 2
  };

  try {
    const encrypted = await encryptData(data, pin);
    const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendwise-encrypted-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Encrypted backup exported');
  } catch(e) {
    toastError('Encryption failed: ' + e.message);
  }
  window.__resumeAutoLock?.();
}

async function importEncrypted() {
  window.__pauseAutoLock?.();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.setAttribute('aria-label', 'Import encrypted backup file');
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) { window.__resumeAutoLock?.(); return; }
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const encrypted = JSON.parse(ev.target.result);
        if(!encrypted.salt || !encrypted.iv || !encrypted.data) {
          toastError('Not an encrypted backup file');
          window.__resumeAutoLock?.();
          return;
        }

        let data = null;
        let attempts = 0;
        const maxAttempts = 3;

        while(!data && attempts < maxAttempts) {
          attempts++;
          const hint = attempts === 1
            ? 'Enter the lock screen PIN that was used when this backup was created.'
            : `Wrong PIN. ${maxAttempts - attempts} attempt${maxAttempts - attempts === 1 ? '' : 's'} remaining.`;

          const pin = await promptPassword({
            title: 'Unlock Backup',
            message: 'Enter the PIN to decrypt this backup:',
            hint
          });

          if(pin === null) { window.__resumeAutoLock?.(); return; }
          if(!pin) { toastError('PIN is required'); window.__resumeAutoLock?.(); return; }

          data = await decryptData(encrypted, pin);
        }

        if(!data) {
          toastError('Failed after ' + maxAttempts + ' attempts. Wrong PIN or corrupted file.');
          window.__resumeAutoLock?.();
          return;
        }

        const clean = sanitizeImportData(data);
        if(!clean) { toastError('Invalid data in backup'); window.__resumeAutoLock?.(); return; }
        replaceAllData(clean);
        toastSuccess('Encrypted backup imported!');
        renderExport(document.getElementById('mainContent'));
      } catch(err) {
        toastError('Invalid file format');
      }
      window.__resumeAutoLock?.();
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== IMPORT JSON =====
function importJSON() {
  window.__pauseAutoLock?.();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.setAttribute('aria-label', 'Import JSON backup file');
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) { window.__resumeAutoLock?.(); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target.result);
        const data = sanitizeImportData(raw);
        if(!data) { toastError('Invalid file format'); return; }
        replaceAllData(data);
        toastSuccess('Data imported successfully!');
        renderExport(document.getElementById('mainContent'));
      } catch(err) { toastError('Invalid file format'); }
      window.__resumeAutoLock?.();
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== IMPORT CSV =====
let csvImportState = { headers: [], rows: [], mapping: {}, detected: null, preview: [] };

function openCSVImport() {
  window.__pauseAutoLock?.();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.setAttribute('aria-label', 'Import CSV file');
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) { window.__resumeAutoLock?.(); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      const rows = parseCSVSimple(text);
      if(rows.length < 2) { toastError('CSV file is empty or has no data rows'); window.__resumeAutoLock?.(); return; }

      csvImportState.headers = rows[0];
      csvImportState.rows = rows.slice(1).filter(r => r.some(c => c.trim() !== ''));
      csvImportState.detected = detectBankFormat(rows[0]);
      csvImportState.mapping = csvImportState.detected ? csvImportState.detected.mapping : {};
      csvImportState.isSplitAmount = csvImportState.detected?.isSplitAmount || false;

      renderColumnMapping();
      window.__resumeAutoLock?.();
    };
    reader.readAsText(file);
  };
  input.click();
}

function renderColumnMapping() {
  const overlay = document.getElementById('csvImportOverlay');
  if(!overlay) return;
  const { headers, mapping, detected, isSplitAmount } = csvImportState;

  const html = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Import CSV</h2>
          <p class="text-sm text-muted">${csvImportState.rows.length} rows detected${detected ? ' — Auto-detected: ' + detected.name : ''}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="csvImportCancel">Cancel</button>
      </div>
      <div class="panel mb-20">
        <div class="panel-header"><h3>Map Columns</h3><span class="text-sm text-muted">Match CSV columns to transaction fields</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:16px">
          ${headers.map((h, i) => `
            <div>
              <div class="text-sm text-muted mb-8" style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h}">Col ${i + 1}: ${h}</div>
              <select class="input csv-col-map" data-col="${i}">
                <option value="">-- Skip --</option>
                <option value="date" ${mapping.date === i ? 'selected' : ''}>Date</option>
                <option value="description" ${mapping.description === i ? 'selected' : ''}>Description</option>
                ${isSplitAmount ? `
                  <option value="debit" ${mapping.debit === i ? 'selected' : ''}>Debit</option>
                  <option value="credit" ${mapping.credit === i ? 'selected' : ''}>Credit</option>
                ` : `
                  <option value="amount" ${mapping.amount === i ? 'selected' : ''}>Amount</option>
                `}
                <option value="category" ${mapping.category === i ? 'selected' : ''}>Category</option>
              </select>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="panel mb-20">
        <div class="panel-header"><h3>Preview</h3><span class="text-sm text-muted" id="csvPreviewCount"></span></div>
        <div style="overflow-x:auto">
          <table class="table" id="csvPreviewTable">
            <thead><tr>
              <th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th><th>Status</th>
            </tr></thead>
            <tbody id="csvPreviewBody"></tbody>
          </table>
        </div>
      </div>
      <div class="flex flex-between" style="padding:16px 0">
        <button class="btn btn-ghost" id="csvImportBack">Back</button>
        <button class="btn btn-primary" id="csvImportConfirm">Import ${csvImportState.rows.length} Transactions</button>
      </div>
    </div>
  `;

  overlay.innerHTML = `<div class="modal" style="max-width:900px;max-height:90vh;overflow-y:auto">${html}</div>`;
  overlay.classList.add('show');

  document.querySelectorAll('.csv-col-map').forEach(sel => {
    sel.addEventListener('change', e => {
      const col = parseInt(e.target.dataset.col);
      const field = e.target.value;
      Object.keys(csvImportState.mapping).forEach(k => { if(csvImportState.mapping[k] === col) delete csvImportState.mapping[k]; });
      if(field) csvImportState.mapping[field] = col;
      updatePreview();
    });
  });

  document.getElementById('csvImportCancel')?.addEventListener('click', () => {
    overlay.classList.remove('show');
  });

  document.getElementById('csvImportBack')?.addEventListener('click', () => {
    overlay.classList.remove('show');
    openCSVImport();
  });

  document.getElementById('csvImportConfirm')?.addEventListener('click', () => {
    const { rows, mapping, isSplitAmount } = csvImportState;
    if(!mapping.date && mapping.date !== 0) { toastError('Please map the Date column'); return; }
    if(!isSplitAmount && mapping.amount === undefined && mapping.debit === undefined) { toastError('Please map the Amount or Debit/Credit columns'); return; }

    const mapped = rows.map(r => mapCSVRow(r, { ...mapping, isSplitAmount })).filter(t => t.amount > 0);
    if(!mapped.length) { toastError('No valid transactions found'); return; }

    mapped.forEach(t => { t.id = uid(); });
    addBulkTransactions(mapped);
    toastSuccess(`Imported ${mapped.length} transactions`);
    overlay.classList.remove('show');
    renderExport(document.getElementById('mainContent'));
  });

  updatePreview();
}

function updatePreview() {
  const { rows, mapping, isSplitAmount } = csvImportState;
  const tbody = document.getElementById('csvPreviewBody');
  const countEl = document.getElementById('csvPreviewCount');
  if(!tbody) return;

  const previewRows = rows.slice(0, 20);
  let validCount = 0;

  tbody.innerHTML = previewRows.map(r => {
    const t = mapCSVRow(r, { ...mapping, isSplitAmount });
    const valid = t.amount > 0 && t.date;
    if(valid) validCount++;
    const cat = getCat(t.category);
    return `
      <tr style="opacity:${valid ? 1 : 0.4}">
        <td class="text-sm">${escapeHTML(t.date)}</td>
        <td><span class="badge badge-${t.type === 'income' ? 'success' : 'danger'}" style="font-size:0.5rem">${t.type}</span></td>
        <td class="text-sm">${cat.icon} ${escapeHTML(cat.name)}</td>
        <td class="text-sm" style="font-weight:600;color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'}">${t.amount > 0 ? fmt(t.amount, '৳') : '—'}</td>
        <td class="text-sm" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(t.description) || '—'}</td>
        <td class="text-sm">${valid ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'}</td>
      </tr>
    `;
  }).join('');

  if(countEl) countEl.textContent = `${validCount} valid of ${previewRows.length} shown (${rows.length} total)`;
}

// ===== RENDER PAGE =====
export function renderExport(container) {
  const transactions = getTransactions();
  const budgets = getBudgets();
  const savingsGoals = getSavingsGoals();
  const recurringList = getRecurringList();

  container.innerHTML = `
    <div class="fade-in">
      <div class="header"><h2>Export & Import</h2></div>

      <h3 class="text-sm text-muted mb-16" style="text-transform:uppercase;letter-spacing:2px;font-family:var(--font-mono)">Export</h3>
      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));margin-bottom:32px">
        <div class="panel" style="cursor:pointer" data-action="exportTransactionsCSV" role="button" tabindex="0" aria-label="Export transactions as CSV">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">📄</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Transactions</h4>
            <p class="text-sm text-muted">${transactions.length} rows</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="exportBudgetsCSV" role="button" tabindex="0" aria-label="Export budgets as CSV">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">💰</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Budgets</h4>
            <p class="text-sm text-muted">${budgets.length} categories</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="exportSavingsCSV" role="button" tabindex="0" aria-label="Export savings goals as CSV">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">🎯</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Savings Goals</h4>
            <p class="text-sm text-muted">${savingsGoals.length} goals</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="exportRecurringCSV" role="button" tabindex="0" aria-label="Export recurring expenses as CSV">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">🔄</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Recurring</h4>
            <p class="text-sm text-muted">${recurringList.length} items</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="exportJSON" role="button" tabindex="0" aria-label="Export full backup as JSON">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">📦</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Full Backup</h4>
            <p class="text-sm text-muted">JSON format</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="exportMonthlyReport" role="button" tabindex="0" aria-label="Export monthly report">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">📊</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Monthly Report</h4>
            <p class="text-sm text-muted">Current month</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer;border:1px solid var(--accent)" data-action="exportEncrypted" role="button" tabindex="0" aria-label="Export encrypted backup">
          <div style="text-align:center;padding:16px">
            <div style="font-size:2rem;margin-bottom:8px" aria-hidden="true">🔐</div>
            <h4 style="margin-bottom:4px;font-size:0.7rem">Encrypted Backup</h4>
            <p class="text-sm text-muted">Encrypted with your lock screen PIN</p>
          </div>
        </div>
      </div>

      <h3 class="text-sm text-muted mb-16" style="text-transform:uppercase;letter-spacing:2px;font-family:var(--font-mono)">Import</h3>
      <div class="cards-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));margin-bottom:32px">
        <div class="panel" style="cursor:pointer" data-action="importCSV" role="button" tabindex="0" aria-label="Import from CSV">
          <div style="text-align:center;padding:20px">
            <div style="font-size:2.5rem;margin-bottom:12px" aria-hidden="true">📥</div>
            <h3 style="margin-bottom:8px">Import CSV</h3>
            <p class="text-sm text-muted">From bank statements, spreadsheets, or any CSV file. Auto-detects bank format.</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer" data-action="importJSON" role="button" tabindex="0" aria-label="Import from JSON backup">
          <div style="text-align:center;padding:20px">
            <div style="font-size:2.5rem;margin-bottom:12px" aria-hidden="true">📂</div>
            <h3 style="margin-bottom:8px">Import JSON</h3>
            <p class="text-sm text-muted">Restore from a SpendWise JSON backup file.</p>
          </div>
        </div>
        <div class="panel" style="cursor:pointer;border:1px solid var(--accent)" data-action="importEncrypted" role="button" tabindex="0" aria-label="Import encrypted backup">
          <div style="text-align:center;padding:20px">
            <div style="font-size:2.5rem;margin-bottom:12px" aria-hidden="true">🔓</div>
            <h3 style="margin-bottom:8px">Import Encrypted</h3>
            <p class="text-sm text-muted">Restore from a PIN-encrypted backup. Enter the PIN that was used to create it.</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Data Summary</h3></div>
        <div class="data-summary-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:16px">
          <div style="padding:12px;background:var(--bg3);text-align:center">
            <div class="card-label" style="justify-content:center">Transactions</div>
            <div style="font-size:1.5rem;font-weight:700">${transactions.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);text-align:center">
            <div class="card-label" style="justify-content:center">Budgets</div>
            <div style="font-size:1.5rem;font-weight:700">${budgets.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);text-align:center">
            <div class="card-label" style="justify-content:center">Goals</div>
            <div style="font-size:1.5rem;font-weight:700">${savingsGoals.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);text-align:center">
            <div class="card-label" style="justify-content:center">Recurring</div>
            <div style="font-size:1.5rem;font-weight:700">${recurringList.length}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="csvImportOverlay" role="dialog" aria-modal="true" aria-label="Import CSV"></div>
  `;

  // Bind all actions via data-action + querySelectorAll (avoids CSP inline handler issues)
  const actions = {
    exportTransactionsCSV, exportBudgetsCSV, exportSavingsCSV, exportRecurringCSV,
    exportJSON, exportMonthlyReport, exportEncrypted,
    importCSV: openCSVImport, importJSON, importEncrypted
  };

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const fn = actions[el.dataset.action];
      if(fn) fn();
    });
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const fn = actions[el.dataset.action];
        if(fn) fn();
      }
    });
  });

  document.getElementById('csvImportOverlay')?.addEventListener('click', e => {
    if(e.target.id === 'csvImportOverlay') e.target.classList.remove('show');
  });

  if(window.__csvEscHandler) document.removeEventListener('keydown', window.__csvEscHandler);
  window.__csvEscHandler = function(e) {
    if(e.key === 'Escape') {
      const ov = document.getElementById('csvImportOverlay');
      if(ov && ov.classList.contains('show')) { ov.classList.remove('show'); }
    }
  };
  document.addEventListener('keydown', window.__csvEscHandler);
}
