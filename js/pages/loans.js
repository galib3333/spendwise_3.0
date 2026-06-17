// ===== LOANS PAGE =====
import { getLoans, addLoan, updateLoan, deleteLoan, getSettings, addTransaction, addRecurring, updateRecurring, deleteRecurring, getRecurringList } from '../store.js';
import { uid, today, parseLocalDate, toDateStr, fmt } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastError } from '../toast.js';
import { confirmModal, renderCard } from '../helpers.js';
import { ICONS } from '../helpers.js';

let _container = null;

const LOAN_SOURCES = {
  person: { label: 'Person', icon: '👤', color: '#9e9e9e' },
  bank: { label: 'Bank', icon: '🏦', color: '#1976d2' },
  bkash: { label: 'bKash Loan', icon: '📱', color: '#e2136e' },
  nagad: { label: 'Nagad Loan', icon: '💰', color: '#f6921e' },
  rocket: { label: 'Rocket Loan', icon: '🚀', color: '#d32f2f' },
  other: { label: 'Other', icon: '🏛️', color: '#607d8b' },
};

const FREQUENCY_OPTIONS = [
  { value: '', label: 'One-time (no schedule)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const FREQUENCY_LABELS = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

function getSourceInfo(source) {
  return LOAN_SOURCES[source] || LOAN_SOURCES.person;
}

function getDaysLeft(dueDate) {
  if (!dueDate) return null;
  const now = parseLocalDate(today());
  const due = parseLocalDate(dueDate);
  const diff = Math.ceil((due - now) / 86400000);
  return diff;
}

function getStatus(loan) {
  if (loan.status === 'settled') return 'settled';
  if (loan.paid >= loan.amount) return 'settled';
  const days = getDaysLeft(loan.dueDate);
  if (days !== null && days < 0) return 'overdue';
  return 'active';
}

function getStatusColor(status) {
  switch (status) {
    case 'settled': return 'var(--green)';
    case 'overdue': return 'var(--red)';
    default: return 'var(--accent)';
  }
}

function getStatusBadge(status) {
  const color = getStatusColor(status);
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;text-transform:uppercase;background:${color}22;color:${color}">${status}</span>`;
}

function getFrequencyBadge(frequency) {
  if (!frequency) return '';
  const label = FREQUENCY_LABELS[frequency] || frequency;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.65rem;font-weight:600;background:var(--accent)22;color:var(--accent)">🔁 ${label}</span>`;
}

function advanceDate(dateStr, frequency) {
  const d = parseLocalDate(dateStr);
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return toDateStr(d);
}

export function renderLoans(container) {
  _container = container;
  const loans = getLoans();
  const settings = getSettings();
  const currency = settings.currency;

  const active = loans.filter(l => getStatus(l) === 'active');
  const overdue = loans.filter(l => getStatus(l) === 'overdue');
  const settled = loans.filter(l => getStatus(l) === 'settled');

  const totalLent = loans.filter(l => l.type === 'lent').reduce((s, l) => s + l.amount, 0);
  const totalPaid = loans.filter(l => l.type === 'lent').reduce((s, l) => s + l.paid, 0);
  const totalBorrowed = loans.filter(l => l.type === 'borrowed').reduce((s, l) => s + l.amount, 0);
  const totalPaidBorrowed = loans.filter(l => l.type === 'borrowed').reduce((s, l) => s + l.paid, 0);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header flex flex-between" style="align-items:center">
        <h2>Loans & Debts</h2>
        <button class="btn btn-primary btn-sm" id="addLoanBtn">${ICONS.plus} Add Loan</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
        ${renderCard('Total Lent', fmt(totalLent, currency), 'var(--accent)')}
        ${renderCard('Received Back', fmt(totalPaid, currency), 'var(--green)')}
        ${renderCard('Total Borrowed', fmt(totalBorrowed, currency), 'var(--orange)')}
        ${renderCard('Amount Paid Back', fmt(totalPaidBorrowed, currency), 'var(--purple)')}
      </div>

      <div class="tabs" style="margin-bottom:16px" id="loanFilterTabs" role="tablist">
        <button class="tab active" role="tab" data-filter="all">All (${loans.length})</button>
        <button class="tab" role="tab" data-filter="active">Active (${active.length})</button>
        <button class="tab" role="tab" data-filter="overdue">Overdue (${overdue.length})</button>
        <button class="tab" role="tab" data-filter="settled">Settled (${settled.length})</button>
      </div>

      <div id="loanList">
        ${loans.length === 0 ? `
          <div class="panel" style="text-align:center;padding:40px">
            <div style="font-size:2.5rem;margin-bottom:12px">💰</div>
            <h3 style="margin:0 0 8px">No loans yet</h3>
            <p class="text-sm text-muted" style="margin:0 0 16px">Track money lent/borrowed from people, banks, bKash, Nagad & more.</p>
            <button class="btn btn-primary" id="addLoanEmptyBtn">+ Add Loan</button>
          </div>
        ` : renderLoanList(loans, currency)}
      </div>
    </div>

    <!-- Add/Edit Loan Modal -->
    <div class="modal-overlay" id="loanModal" role="dialog" aria-modal="true" aria-label="Loan">
      <div class="modal">
        <h3 id="loanModalTitle">Add Loan</h3>
        <div class="input-group">
          <label>Type</label>
          <div class="tabs" id="loanTypeTabs" role="tablist">
            <button class="tab active" role="tab" data-type="lent">I Lent (Someone Owes Me)</button>
            <button class="tab" role="tab" data-type="borrowed">I Borrowed (I Owe Someone)</button>
          </div>
        </div>
        <div class="input-group">
          <label for="loanSource">Source</label>
          <select class="input" id="loanSource">
            <option value="person">👤 Person</option>
            <option value="bank">🏦 Bank</option>
            <option value="bkash">📱 bKash Loan</option>
            <option value="nagad">💰 Nagad Loan</option>
            <option value="rocket">🚀 Rocket Loan</option>
            <option value="other">🏛️ Other</option>
          </select>
        </div>
        <div id="personFields">
          <div class="input-group">
            <label for="loanPerson">Person's Name</label>
            <input type="text" class="input" id="loanPerson" placeholder="e.g. Ahmed" required>
          </div>
          <div class="input-group">
            <label for="loanPhone">Phone Number <span class="text-muted text-sm">(optional)</span></label>
            <input type="text" class="input" id="loanPhone" placeholder="01XXXXXXXXX">
          </div>
        </div>
        <div id="institutionFields" style="display:none">
          <div class="input-group">
            <label for="loanInstitution">Institution Name</label>
            <input type="text" class="input" id="loanInstitution" placeholder="e.g. Grameen Bank, bKash, City Bank">
          </div>
          <div class="input-group">
            <label for="loanAccount">Account/Reference Number <span class="text-muted text-sm">(optional)</span></label>
            <input type="text" class="input" id="loanAccount" placeholder="Account or reference number">
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label for="loanAmount">Total Amount</label>
            <input type="number" class="input" id="loanAmount" placeholder="0.00" step="0.01" min="0" required>
          </div>
          <div class="input-group">
            <label for="loanPaid">Already Paid</label>
            <input type="number" class="input" id="loanPaid" placeholder="0.00" step="0.01" min="0" value="0">
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label for="loanStartDate">Start Date</label>
            <input type="date" class="input" id="loanStartDate" value="${today()}" required>
          </div>
          <div class="input-group">
            <label for="loanDueDate">Due Date <span class="text-muted text-sm">(optional)</span></label>
            <input type="date" class="input" id="loanDueDate">
          </div>
        </div>
        <div class="input-group">
          <label for="loanRate">Interest Rate (%) <span class="text-muted text-sm">(optional)</span></label>
          <input type="number" class="input" id="loanRate" placeholder="0" step="0.1" min="0" max="100">
        </div>
        <div class="input-group">
          <label for="loanFrequency">Payment Schedule</label>
          <select class="input" id="loanFrequency">
            ${FREQUENCY_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div id="installmentGroup" style="display:none">
          <div class="input-group">
            <label for="loanInstallment">Installment Amount <span class="text-muted text-sm">(auto-calculated if empty)</span></label>
            <input type="number" class="input" id="loanInstallment" placeholder="0.00" step="0.01" min="0">
          </div>
        </div>
        <div class="input-group">
          <label for="loanNotes">Notes <span class="text-muted text-sm">(optional)</span></label>
          <input type="text" class="input" id="loanNotes" placeholder="e.g. For business investment">
        </div>
        <input type="hidden" id="loanEditId">
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal="loanModal">Cancel</button>
          <button class="btn btn-primary" id="loanSaveBtn">Save Loan</button>
        </div>
      </div>
    </div>

    <!-- Record Payment Modal -->
    <div class="modal-overlay" id="paymentModal" role="dialog" aria-modal="true" aria-label="Record Payment">
      <div class="modal">
        <h3>Record Payment</h3>
        <div class="input-group">
          <label for="payAmount">Payment Amount</label>
          <input type="number" class="input" id="payAmount" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="input-group">
          <label for="payDate">Date</label>
          <input type="date" class="input" id="payDate" value="${today()}" required>
        </div>
        <div class="input-group">
          <label for="payNote">Note <span class="text-muted text-sm">(optional)</span></label>
          <input type="text" class="input" id="payNote" placeholder="e.g. Partial payment">
        </div>
        <input type="hidden" id="payLoanId">
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal="paymentModal">Cancel</button>
          <button class="btn btn-primary" id="paySaveBtn">Record Payment</button>
        </div>
      </div>
    </div>
  `;

  bindEvents(container, loans, currency);
}

function renderLoanList(loans, currency) {
  const sorted = loans.slice().sort((a, b) => {
    const sa = getStatus(a);
    const sb = getStatus(b);
    const priority = { overdue: 0, active: 1, settled: 2 };
    if (priority[sa] !== priority[sb]) return priority[sa] - priority[sb];
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return sorted.map(loan => {
    const status = getStatus(loan);
    const progress = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
    const remaining = loan.amount - loan.paid;
    const daysLeft = getDaysLeft(loan.dueDate);
    const sourceInfo = getSourceInfo(loan.source);
    const isPerson = !loan.source || loan.source === 'person';
    const isInstitution = !isPerson;
    const direction = loan.type === 'lent'
      ? { icon: '📤', label: 'Lent to', color: 'var(--accent)' }
      : { icon: '📥', label: 'Borrowed from', color: 'var(--purple)' };
    const nameLabel = isPerson ? loan.person : `${sourceInfo.icon} ${loan.institution || sourceInfo.label}`;
    const freqBadge = getFrequencyBadge(loan.frequency);

    return `
      <div class="panel" style="margin-bottom:12px;border-left:3px solid ${sourceInfo.color}" data-loan-id="${escapeHTML(loan.id)}">
        <div class="flex flex-between" style="align-items:flex-start;margin-bottom:8px">
          <div>
            <div class="flex gap-8" style="align-items:center;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-size:1.2rem">${direction.icon}</span>
              <strong>${escapeHTML(nameLabel)}</strong>
              ${getStatusBadge(status)}
              ${freqBadge}
            </div>
            <div class="text-sm text-muted">
              ${isPerson ? `${direction.label} you` : `${loan.type === 'lent' ? 'They owe me' : 'I owe them'}`}
              · ${escapeHTML(loan.startDate || '')}${loan.dueDate ? ` → ${escapeHTML(loan.dueDate)}` : ''}
            </div>
            ${isPerson && loan.phone ? `<div class="text-sm text-muted">${escapeHTML(loan.phone)}</div>` : ''}
            ${isInstitution && loan.account ? `<div class="text-sm text-muted">Acct: ${escapeHTML(loan.account)}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:1.1rem;font-weight:600">${fmt(remaining, currency)}</div>
            <div class="text-sm text-muted">of ${fmt(loan.amount, currency)}</div>
          </div>
        </div>

        <div style="background:var(--bg3);border-radius:6px;height:6px;margin:8px 0;overflow:hidden">
          <div style="background:${status === 'settled' ? 'var(--green)' : sourceInfo.color};height:100%;width:${progress}%;transition:width 0.3s;border-radius:6px"></div>
        </div>
        <div class="flex flex-between text-sm text-muted" style="margin-bottom:4px">
          <span>${fmt(loan.paid, currency)} paid (${Math.round(progress)}%)</span>
          ${daysLeft !== null && status !== 'settled' ? `<span style="color:${daysLeft < 0 ? 'var(--red)' : 'var(--text3)'}">${daysLeft < 0 ? Math.abs(daysLeft) + ' days overdue' : daysLeft + ' days left'}</span>` : ''}
        </div>

        ${loan.rate > 0 ? `<div class="text-sm text-muted" style="margin-bottom:4px">Interest: ${loan.rate}%</div>` : ''}
        ${loan.installment ? `<div class="text-sm text-muted" style="margin-bottom:4px">Installment: ${fmt(loan.installment, currency)} ${loan.frequency ? '/ ' + FREQUENCY_LABELS[loan.frequency] : ''}</div>` : ''}
        ${loan.notes ? `<div class="text-sm text-muted" style="margin-bottom:4px;font-style:italic">"${escapeHTML(loan.notes)}"</div>` : ''}

        ${loan.payments && loan.payments.length > 0 ? `
          <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
            <div class="text-sm" style="font-weight:500;margin-bottom:4px">Payment History</div>
            ${loan.payments.slice(-3).map(p => `
              <div class="flex flex-between text-sm" style="padding:2px 0">
                <span class="text-muted">${escapeHTML(p.date)} ${p.note ? '· ' + escapeHTML(p.note) : ''}</span>
                <span style="color:var(--green)">+${fmt(p.amount, currency)}</span>
              </div>
            `).join('')}
            ${loan.payments.length > 3 ? `<div class="text-sm text-muted" style="text-align:center">+${loan.payments.length - 3} more</div>` : ''}
          </div>
        ` : ''}

        <div class="flex gap-8" style="margin-top:8px;justify-content:flex-end">
          ${status !== 'settled' ? `<button class="btn btn-ghost btn-sm" data-record-payment="${escapeHTML(loan.id)}" style="color:var(--green)">Record Payment</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit-loan="${escapeHTML(loan.id)}">${ICONS.edit}</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete-loan="${escapeHTML(loan.id)}">${ICONS.delete}</button>
        </div>
      </div>
    `;
  }).join('');
}

function bindEvents(container, loans, currency) {
  const openAddModal = () => {
    document.getElementById('loanEditId').value = '';
    document.getElementById('loanModalTitle').textContent = 'Add Loan';
    document.getElementById('loanSource').value = 'person';
    document.getElementById('loanPerson').value = '';
    document.getElementById('loanPhone').value = '';
    document.getElementById('loanInstitution').value = '';
    document.getElementById('loanAccount').value = '';
    document.getElementById('loanAmount').value = '';
    document.getElementById('loanPaid').value = '0';
    document.getElementById('loanStartDate').value = today();
    document.getElementById('loanDueDate').value = '';
    document.getElementById('loanRate').value = '';
    document.getElementById('loanNotes').value = '';
    document.getElementById('loanFrequency').value = '';
    document.getElementById('loanInstallment').value = '';
    document.getElementById('installmentGroup').style.display = 'none';
    toggleSourceFields('person');
    document.querySelectorAll('#loanTypeTabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#loanTypeTabs .tab[data-type="lent"]').classList.add('active');
    document.getElementById('loanModal').classList.add('show');
    document.getElementById('loanPerson').focus();
  };

  document.getElementById('addLoanBtn')?.addEventListener('click', openAddModal);
  document.getElementById('addLoanEmptyBtn')?.addEventListener('click', openAddModal);

  document.getElementById('loanSource')?.addEventListener('change', (e) => {
    toggleSourceFields(e.target.value);
  });

  document.querySelectorAll('#loanTypeTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#loanTypeTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.getElementById('loanFilterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#loanFilterTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = tab.dataset.filter;
    const filtered = filter === 'all' ? loans : loans.filter(l => getStatus(l) === filter);
    document.getElementById('loanList').innerHTML = filtered.length === 0
      ? `<div class="panel" style="text-align:center;padding:24px"><p class="text-muted">No ${filter} loans</p></div>`
      : renderLoanList(filtered, currency);
    bindDataActions(container, loans, currency);
  });

  document.getElementById('loanFrequency')?.addEventListener('change', (e) => {
    const group = document.getElementById('installmentGroup');
    group.style.display = e.target.value ? '' : 'none';
    if (e.target.value) {
      const amt = parseFloat(document.getElementById('loanAmount').value) || 0;
      const inst = document.getElementById('loanInstallment');
      if (!inst.value && amt > 0) {
        const freq = e.target.value;
        const divisor = freq === 'weekly' ? 4 : freq === 'biweekly' ? 2 : freq === 'quarterly' ? 3 : freq === 'yearly' ? 1 : 12;
        inst.value = (amt / divisor).toFixed(2);
      }
    }
  });

  document.getElementById('loanSaveBtn')?.addEventListener('click', () => {
    const editId = document.getElementById('loanEditId').value;
    const type = document.querySelector('#loanTypeTabs .tab.active')?.dataset.type || 'lent';
    const source = document.getElementById('loanSource').value;
    const isPerson = source === 'person';
    const person = isPerson ? document.getElementById('loanPerson').value.trim() : '';
    const phone = isPerson ? document.getElementById('loanPhone').value.trim() : '';
    const institution = !isPerson ? document.getElementById('loanInstitution').value.trim() : '';
    const account = !isPerson ? document.getElementById('loanAccount').value.trim() : '';
    const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const paid = parseFloat(document.getElementById('loanPaid').value) || 0;
    const startDate = document.getElementById('loanStartDate').value;
    const dueDate = document.getElementById('loanDueDate').value || null;
    const rate = parseFloat(document.getElementById('loanRate').value) || 0;
    const notes = document.getElementById('loanNotes').value.trim();
    const frequency = document.getElementById('loanFrequency').value || null;
    const installment = parseFloat(document.getElementById('loanInstallment').value) || null;

    if (isPerson && !person) { toastError('Person name is required'); return; }
    if (!isPerson && !institution) { toastError('Institution name is required'); return; }
    if (!amount || amount <= 0) { toastError('Amount must be positive'); return; }

    const displayName = isPerson ? person : institution;

    const data = {
      type, source, person: displayName, phone, institution, account,
      amount, paid, startDate, dueDate, rate, notes, frequency, installment,
      status: paid >= amount ? 'settled' : 'active',
      payments: [],
      updatedAt: new Date().toISOString()
    };

    let loanId;
    if (editId) {
      const existing = loans.find(l => l.id === editId);
      data.payments = existing?.payments || [];
      data.createdAt = existing?.createdAt;
      data.transactionId = existing?.transactionId || null;
      loanId = editId;
      updateLoan(editId, data);

      const existingRecurring = getRecurringList().find(r => r.loanId === loanId);
      if (frequency) {
        const installmentAmt = installment || amount / 12;
        const recurringData = {
          amount: installmentAmt,
          description: `${type === 'lent' ? 'Loan received' : 'Loan payment'} - ${displayName}`,
          frequency,
          category: 'other',
          nextDate: advanceDate(startDate, frequency),
          endDate: dueDate || null,
        };
        if (existingRecurring) {
          updateRecurring(existingRecurring.id, recurringData);
        } else {
          addRecurring({
            id: uid(),
            ...recurringData,
            startDate,
            active: true,
            loanId
          });
        }
        toastSuccess('Loan updated & recurring scheduled');
      } else if (existingRecurring) {
        deleteRecurring(existingRecurring.id);
        toastSuccess('Loan updated, recurring removed');
      } else {
        toastSuccess('Loan updated');
      }
    } else {
      loanId = uid();
      data.id = loanId;
      data.createdAt = new Date().toISOString();

      const txnType = type === 'lent' ? 'expense' : 'income';
      const txnDesc = type === 'lent'
        ? `Lent to ${displayName}`
        : `Borrowed from ${displayName}`;
      const txnId = uid();
      data.transactionId = txnId;

      addLoan(data);

      addTransaction({
        id: txnId,
        type: txnType,
        amount,
        date: startDate,
        category: 'other',
        payment: source === 'person' ? 'cash' : source,
        description: notes ? `${txnDesc} - ${notes}` : txnDesc,
        tags: ['loan'],
        recurring: false,
        frequency: null
      });

      if (frequency) {
        const installmentAmt = installment || amount / 12;
        addRecurring({
          id: uid(),
          amount: installmentAmt,
          description: `${type === 'lent' ? 'Loan received' : 'Loan payment'} - ${displayName}`,
          frequency,
          category: 'other',
          startDate,
          nextDate: advanceDate(startDate, frequency),
          endDate: dueDate || null,
          active: true,
          loanId
        });
        toastSuccess('Loan & transaction added, recurring scheduled');
      } else {
        toastSuccess('Loan & transaction added');
      }
    }

    document.getElementById('loanModal').classList.remove('show');
    renderLoans(container);
  });

  document.getElementById('paySaveBtn')?.addEventListener('click', () => {
    const loanId = document.getElementById('payLoanId').value;
    const amount = parseFloat(document.getElementById('payAmount').value) || 0;
    const date = document.getElementById('payDate').value;
    const note = document.getElementById('payNote').value.trim();

    if (!amount || amount <= 0) { toastError('Amount must be positive'); return; }

    const loan = loans.find(l => l.id === loanId);
    if (!loan) { toastError('Loan not found'); return; }

    const payments = [...(loan.payments || []), { date, amount, note }];
    const totalPaid = loan.paid + amount;

    updateLoan(loanId, {
      paid: totalPaid,
      payments,
      status: totalPaid >= loan.amount ? 'settled' : 'active',
      updatedAt: new Date().toISOString()
    });

    const txnType = loan.type === 'lent' ? 'income' : 'expense';
    const desc = loan.type === 'lent'
      ? `Loan repayment from ${loan.person || 'someone'}`
      : `Loan payment to ${loan.person || 'someone'}`;
    addTransaction({
      id: uid(),
      type: txnType,
      amount,
      date,
      category: 'other',
      payment: loan.source === 'person' ? 'cash' : loan.source,
      description: note ? `${desc} - ${note}` : desc,
      tags: ['loan'],
      recurring: false,
      frequency: null
    });

    document.getElementById('paymentModal').classList.remove('show');
    toastSuccess('Payment recorded & transaction created');
    renderLoans(container);
  });

  bindDataActions(container, loans, currency);

  container.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('show');
    });
  });
}

function toggleSourceFields(source) {
  const personFields = document.getElementById('personFields');
  const institutionFields = document.getElementById('institutionFields');
  if (source === 'person') {
    personFields.style.display = '';
    institutionFields.style.display = 'none';
  } else {
    personFields.style.display = 'none';
    institutionFields.style.display = '';
  }
}

function bindDataActions(container, loans, currency) {
  container.querySelectorAll('[data-edit-loan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const loan = loans.find(l => l.id === btn.dataset.editLoan);
      if (!loan) return;
      document.getElementById('loanEditId').value = loan.id;
      document.getElementById('loanModalTitle').textContent = 'Edit Loan';
      const source = loan.source || 'person';
      document.getElementById('loanSource').value = source;
      toggleSourceFields(source);
      if (source === 'person') {
        document.getElementById('loanPerson').value = loan.person || '';
        document.getElementById('loanPhone').value = loan.phone || '';
      } else {
        document.getElementById('loanInstitution').value = loan.institution || loan.person || '';
        document.getElementById('loanAccount').value = loan.account || '';
      }
      document.getElementById('loanAmount').value = loan.amount;
      document.getElementById('loanPaid').value = loan.paid;
      document.getElementById('loanStartDate').value = loan.startDate;
      document.getElementById('loanDueDate').value = loan.dueDate || '';
      document.getElementById('loanRate').value = loan.rate || '';
      document.getElementById('loanNotes').value = loan.notes || '';
      document.getElementById('loanFrequency').value = loan.frequency || '';
      document.getElementById('loanInstallment').value = loan.installment || '';
      document.getElementById('installmentGroup').style.display = loan.frequency ? '' : 'none';
      document.querySelectorAll('#loanTypeTabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`#loanTypeTabs .tab[data-type="${loan.type}"]`).classList.add('active');
      document.getElementById('loanModal').classList.add('show');
    });
  });

  container.querySelectorAll('[data-delete-loan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmModal('Delete this loan? This cannot be undone.')) {
        deleteLoan(btn.dataset.deleteLoan);
        toastSuccess('Loan deleted');
        renderLoans(container);
      }
    });
  });

  container.querySelectorAll('[data-record-payment]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('payLoanId').value = btn.dataset.recordPayment;
      document.getElementById('payAmount').value = '';
      document.getElementById('payDate').value = today();
      document.getElementById('payNote').value = '';
      document.getElementById('paymentModal').classList.add('show');
      document.getElementById('payAmount').focus();
    });
  });
}
