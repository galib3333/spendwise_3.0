// ===== BANKING PAGE =====
import {
  getBankAccounts, getBankTransactions, getBankTransactionsForAccount,
  addBankAccount, updateBankAccount, deleteBankAccount,
  addBulkBankTransactions, getSettings
} from '../store.js';
import { uid, fmt } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastError, toastWarning } from '../toast.js';
import { navigate } from '../router.js';
import { isGmailConnected, initGmailAuth, requestGmailAccess, disconnectGmail, renderGmailStatus, onConnectionChange } from '../banking/gmail-auth.js';
import { fetchAndParseEmails, fetchLatestBalance } from '../banking/gmail-fetcher.js';
import { detectProvider, parseEmailAuto } from '../banking/email-parser.js';
import { formatBalance } from '../banking/balance-tracker.js';
import '../banking/bkb-adapter.js';
import '../banking/ebl-adapter.js';

const ACCOUNT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

let _unsubscribeConnection = null;

const PROVIDER_INFO = {
  bkash: { name: 'bKash', icon: '📱', color: '#e2136e' },
  ebl: { name: 'EBL', icon: '🏦', color: '#003087' },
};

function getProviderInfo(id) {
  return PROVIDER_INFO[id] || { name: id, icon: '💳', color: '#666' };
}

export function renderBanking(container) {
  const accounts = getBankAccounts();
  const allTxns = getBankTransactions();
  const settings = getSettings();
  const connected = isGmailConnected();

  container.innerHTML = `
    <div class="fade-in">
      <div class="header flex flex-between" style="align-items:center">
        <h2>Banking</h2>
        <div class="flex gap-8">
          ${connected ? '<button class="btn btn-secondary btn-sm" id="syncAllBtn">Sync All</button>' : ''}
          <button class="btn btn-primary btn-sm" id="addAccountBtn">+ Add Account</button>
        </div>
      </div>

      <!-- Gmail Connection Status -->
      <div class="panel" style="margin-bottom:16px">
        <div class="flex flex-between" style="align-items:center">
          <div>
            <h3 style="margin:0 0 4px">Gmail Auto-Import</h3>
            <p class="text-sm text-muted" style="margin:0">
              ${connected
                ? 'Connected. bKash and EBL emails are auto-imported.'
                : 'Connect Gmail to auto-import bKash & EBL transactions.'}
            </p>
            ${renderGmailStatus()}
          </div>
          <div>
            ${connected
              ? '<button class="btn btn-secondary btn-sm" id="disconnectGmailBtn">Disconnect</button>'
              : '<button class="btn btn-primary btn-sm" id="connectGmailBtn">Connect Gmail</button>'}
          </div>
        </div>
        ${!connected ? `
        <div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px">
          <p class="text-sm" style="margin:0 0 8px;color:var(--text2)"><strong>Setup required:</strong></p>
          <ol class="text-sm" style="margin:0;padding-left:20px;color:var(--text3);line-height:1.8">
            <li>Create a <a href="https://console.cloud.google.com" target="_blank" rel="noopener" style="color:var(--accent)">Google Cloud project</a></li>
            <li>Enable <strong>Gmail API</strong></li>
            <li>Create OAuth 2.0 credentials (Web app)</li>
            <li>Add your site to authorized origins</li>
            <li>Paste the Client ID in <a href="#" id="goToSettingsLink" style="color:var(--accent)">Settings</a></li>
          </ol>
        </div>` : ''}
      </div>

      <!-- Manual Paste Parser -->
      <div class="panel" style="margin-bottom:16px">
        <h3 style="margin:0 0 8px">Quick Import</h3>
        <p class="text-sm text-muted" style="margin:0 0 8px">Paste a bKash or EBL SMS/email to auto-create a transaction.</p>
        <div class="input-group" style="margin-bottom:8px">
          <textarea class="input" id="pasteText" rows="3" placeholder="Paste bKash/EBL SMS or email text here..." style="font-family:monospace;font-size:0.75rem"></textarea>
        </div>
        <div class="flex gap-8">
          <select class="input" id="pasteAccount" style="max-width:200px">
            <option value="">Select account (optional)</option>
            ${accounts.map(a => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="parsePasteBtn">Parse & Import</button>
        </div>
        <div id="pasteResult" style="margin-top:8px"></div>
      </div>

      <!-- Accounts Grid -->
      ${accounts.length === 0 ? `
        <div class="panel" style="text-align:center;padding:40px">
          <div style="font-size:2.5rem;margin-bottom:12px">🏦</div>
          <h3 style="margin:0 0 8px">No accounts yet</h3>
          <p class="text-sm text-muted" style="margin:0 0 16px">Add your bKash or EBL account to start tracking.</p>
          <button class="btn btn-primary" id="addAccountEmptyBtn">+ Add Account</button>
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">
          ${accounts.map(a => renderAccountCard(a, allTxns, settings)).join('')}
        </div>
      `}

      <!-- Recent Auto-Imported Transactions -->
      ${allTxns.length > 0 ? `
        <div class="panel">
          <div class="flex flex-between" style="align-items:center;margin-bottom:12px">
            <h3 style="margin:0">Recent Imported Transactions</h3>
            <span class="text-sm text-muted">${allTxns.length} total</span>
          </div>
          <div style="max-height:400px;overflow-y:auto">
            ${allTxns.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30).map(tx => renderBankTxRow(tx, accounts, settings)).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Add Account Modal -->
    <div class="modal-overlay" id="addAccountModal" role="dialog" aria-modal="true" aria-label="Add Bank Account">
      <div class="modal">
        <h3>Add Bank Account</h3>
        <div class="input-group">
          <label for="acctProvider">Provider</label>
          <select class="input" id="acctProvider">
            <option value="bkash">bKash</option>
            <option value="ebl">EBL</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="input-group">
          <label for="acctName">Account Name</label>
          <input type="text" class="input" id="acctName" placeholder="e.g. My bKash">
        </div>
        <div class="input-group">
          <label for="acctNumber">Account/Phone Number <span class="text-muted text-sm">(optional)</span></label>
          <input type="text" class="input" id="acctNumber" placeholder="01XXXXXXXXX">
        </div>
        <div class="input-group">
          <label for="acctBalance">Current Balance</label>
          <input type="number" class="input" id="acctBalance" placeholder="0.00" step="0.01" min="0">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal="addAccountModal">Cancel</button>
          <button class="btn btn-primary" id="saveAccountBtn">Save Account</button>
        </div>
      </div>
    </div>
  `;

  bindEvents(container, accounts, settings);
}

function renderAccountCard(account, allTxns, settings) {
  const info = getProviderInfo(account.provider);
  const txns = allTxns.filter(t => t.bankAccountId === account.id);
  const recent = txns.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
  const balance = account.currentBalance;

  return `
    <div class="panel" style="border-left:3px solid ${account.color || info.color}">
      <div class="flex flex-between" style="align-items:flex-start;margin-bottom:12px">
        <div>
          <span style="font-size:1.5rem">${info.icon}</span>
          <h3 style="margin:4px 0 0;font-size:0.95rem">${escapeHTML(account.name)}</h3>
          ${account.accountNumber ? `<p class="text-sm text-muted" style="margin:2px 0 0">${escapeHTML(account.accountNumber)}</p>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:600;color:var(--text1)">
            ${formatBalance(balance, settings.currency)}
          </div>
          ${account.lastSynced ? `<p class="text-sm text-muted" style="margin:2px 0 0">Synced ${timeAgo(account.lastSynced)}</p>` : ''}
        </div>
      </div>
      ${recent.length > 0 ? `
        <div style="border-top:1px solid var(--border);padding-top:8px">
          ${recent.map(tx => `
            <div class="flex flex-between text-sm" style="padding:4px 0">
              <span style="color:var(--text2)">${escapeHTML(tx.counterparty || tx.type)}</span>
              <span style="color:${tx.type === 'sent' || tx.type === 'debit' || tx.type === 'payment' ? 'var(--red)' : 'var(--green)'}">
                ${tx.type === 'sent' || tx.type === 'debit' || tx.type === 'payment' ? '-' : '+'}${settings.currency}${tx.amount.toLocaleString('en-IN')}
              </span>
            </div>
          `).join('')}
        </div>
      ` : '<p class="text-sm text-muted" style="margin:0;text-align:center;padding:8px 0">No transactions yet</p>'}
      <div class="flex gap-8" style="margin-top:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" data-sync-account="${account.id}">Sync</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete-account="${account.id}">Delete</button>
      </div>
    </div>
  `;
}

function renderBankTxRow(tx, accounts, settings) {
  const account = accounts.find(a => a.id === tx.bankAccountId);
  const info = getProviderInfo(tx.provider);
  const isOut = ['sent', 'debit', 'cashout', 'payment', 'recharge', 'withdrawal', 'pos', 'online', 'bill', 'card', 'transfer'].includes(tx.type);

  return `
    <div class="flex flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);align-items:center">
      <div class="flex gap-8" style="align-items:center">
        <span style="font-size:1.1rem">${info.icon}</span>
        <div>
          <div class="text-sm" style="font-weight:500">${escapeHTML(tx.counterparty || tx.type)}</div>
          <div class="text-sm text-muted">${tx.date} ${account ? `· ${escapeHTML(account.name)}` : ''}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:500;color:${isOut ? 'var(--red)' : 'var(--green)'}">
          ${isOut ? '-' : '+'}${settings.currency}${tx.amount.toLocaleString('en-IN')}
        </div>
        ${tx.fee ? `<div class="text-sm text-muted">Fee: ${settings.currency}${tx.fee}</div>` : ''}
        ${tx.trxId ? `<div class="text-sm text-muted" style="font-size:0.65rem">${escapeHTML(tx.trxId)}</div>` : ''}
      </div>
    </div>
  `;
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function bindEvents(container, accounts, settings) {
  // Add account buttons
  const openAddModal = () => {
    document.getElementById('addAccountModal')?.classList.add('show');
  };
  document.getElementById('addAccountBtn')?.addEventListener('click', openAddModal);
  document.getElementById('addAccountEmptyBtn')?.addEventListener('click', openAddModal);

  // Save account
  document.getElementById('saveAccountBtn')?.addEventListener('click', () => {
    const provider = document.getElementById('acctProvider')?.value || '';
    const name = document.getElementById('acctName')?.value.trim() || '';
    const accountNumber = document.getElementById('acctNumber')?.value.trim() || '';
    const balance = parseFloat(document.getElementById('acctBalance')?.value) || 0;

    if (!name) { toastError('Account name is required'); return; }

    const color = ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];
    addBankAccount({
      id: uid(),
      provider,
      name,
      accountNumber,
      currentBalance: balance,
      initialBalance: balance,
      lastSynced: null,
      color,
    });

    document.getElementById('addAccountModal')?.classList.remove('show');
    toastSuccess('Account added');
    renderBanking(container);
  });

  // Close modal
  container.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('show');
    });
  });

  // Gmail connect
  document.getElementById('connectGmailBtn')?.addEventListener('click', async () => {
    const clientId = localStorage.getItem('sw_gmail_client_id');
    if (!clientId) {
      toastWarning('Please set your Gmail Client ID in Settings first.');
      return;
    }
    // Unsubscribe previous listener to prevent stacking
    if (_unsubscribeConnection) _unsubscribeConnection();
    // Listen for connection change — re-render page when OAuth completes
    _unsubscribeConnection = onConnectionChange((connected) => {
      if (connected) {
        toastSuccess('Gmail connected successfully!');
        renderBanking(container);
      }
    });
    // Fallback: re-render on window focus (popup closes → user returns)
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      if (isGmailConnected()) {
        renderBanking(container);
      }
    };
    window.addEventListener('focus', onFocus);
    const ready = await initGmailAuth(clientId);
    if (ready) requestGmailAccess();
  });

  document.getElementById('disconnectGmailBtn')?.addEventListener('click', () => {
    if (confirm('Disconnect Gmail? Auto-import will stop.')) {
      disconnectGmail();
      toastSuccess('Gmail disconnected');
      renderBanking(container);
    }
  });

  document.getElementById('goToSettingsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('settings');
  });

  // Sync all accounts
  document.getElementById('syncAllBtn')?.addEventListener('click', async () => {
    if (!isGmailConnected()) { toastWarning('Connect Gmail first'); return; }
    const btn = document.getElementById('syncAllBtn');
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    let totalImported = 0;
    for (const acct of accounts) {
      try {
        const { parsed } = await fetchAndParseEmails(acct.provider, 20);
        const newTxns = parsed
          .filter(p => !allTxns.some(existing => existing.trxId === p.trxId && p.trxId))
          .map(p => ({
            id: uid(),
            bankAccountId: acct.id,
            ...p,
          }));
        if (newTxns.length) addBulkBankTransactions(newTxns);
        totalImported += newTxns.length;

        // Update balance from latest
        const balance = await fetchLatestBalance(acct.provider);
        if (balance !== null) updateBankAccount(acct.id, { currentBalance: balance, lastSynced: new Date().toISOString() });
      } catch (e) {
        console.error(`Sync failed for ${acct.name}:`, e);
      }
    }

    btn.disabled = false;
    btn.textContent = 'Sync All';
    toastSuccess(`Imported ${totalImported} new transactions`);
    renderBanking(container);
  });

  // Sync individual account
  container.querySelectorAll('[data-sync-account]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const accountId = btn.dataset.syncAccount;
      const acct = accounts.find(a => a.id === accountId);
      if (!acct) return;
      if (!isGmailConnected()) { toastWarning('Connect Gmail first'); return; }

      btn.disabled = true;
      btn.textContent = 'Syncing...';

      try {
        const { parsed } = await fetchAndParseEmails(acct.provider, 20);
        const existing = getBankTransactionsForAccount(accountId);
        const newTxns = parsed
          .filter(p => !existing.some(e => e.trxId === p.trxId && p.trxId))
          .map(p => ({ id: uid(), bankAccountId: accountId, ...p }));
        if (newTxns.length) addBulkBankTransactions(newTxns);

        const balance = await fetchLatestBalance(acct.provider);
        if (balance !== null) updateBankAccount(accountId, { currentBalance: balance, lastSynced: new Date().toISOString() });

        toastSuccess(`Imported ${newTxns.length} new transactions`);
        renderBanking(container);
      } catch (e) {
        toastError(`Sync failed: ${e.message}`);
        btn.disabled = false;
        btn.textContent = 'Sync';
      }
    });
  });

  // Delete account
  container.querySelectorAll('[data-delete-account]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accountId = btn.dataset.deleteAccount;
      if (confirm('Delete this account and all its transactions?')) {
        deleteBankAccount(accountId);
        toastSuccess('Account deleted');
        renderBanking(container);
      }
    });
  });

  // Manual paste parser
  document.getElementById('parsePasteBtn')?.addEventListener('click', () => {
    const text = document.getElementById('pasteText')?.value.trim() || '';
    const accountId = document.getElementById('pasteAccount')?.value;
    const resultDiv = document.getElementById('pasteResult');

    if (!text) { toastError('Paste some text first'); return; }

    const detected = detectProvider('', text);
    if (!detected) {
      resultDiv.innerHTML = `<p class="text-sm" style="color:var(--red)">Could not detect bKash or EBL format. Please check the text.</p>`;
      return;
    }

    const parsed = parseEmailAuto('', text, '', null);
    if (!parsed) {
      resultDiv.innerHTML = `<p class="text-sm" style="color:var(--red)">Failed to parse transaction. Please check the format.</p>`;
      return;
    }

    const finalAccountId = accountId || accounts.find(a => a.provider === parsed.provider)?.id;

    resultDiv.innerHTML = `
      <div style="padding:12px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">
        <div class="flex flex-between" style="margin-bottom:8px">
          <strong>${escapeHTML(parsed.providerName)} Transaction Detected</strong>
          <span class="text-sm" style="color:${['sent','debit','payment'].includes(parsed.type) ? 'var(--red)' : 'var(--green)'}">
            ${parsed.type === 'sent' || parsed.type === 'debit' || parsed.type === 'payment' ? '-' : '+'}${settings.currency}${parsed.amount.toLocaleString('en-IN')}
          </span>
        </div>
        <div class="text-sm text-muted" style="margin-bottom:4px">Type: ${parsed.type} · Counterparty: ${escapeHTML(parsed.counterparty || 'N/A')}</div>
        ${parsed.balance ? `<div class="text-sm text-muted" style="margin-bottom:4px">Balance: ${settings.currency}${parsed.balance.toLocaleString('en-IN')}</div>` : ''}
        ${parsed.trxId ? `<div class="text-sm text-muted" style="margin-bottom:8px">TrxID: ${escapeHTML(parsed.trxId)}</div>` : ''}
        <button class="btn btn-primary btn-sm" id="confirmPasteImport">Import This Transaction</button>
      </div>
    `;

    document.getElementById('confirmPasteImport')?.addEventListener('click', () => {
      if (!finalAccountId) {
        toastWarning('Select or create an account first');
        return;
      }
      addBulkBankTransactions([{ id: uid(), bankAccountId: finalAccountId, ...parsed }]);
      toastSuccess('Transaction imported');
      document.getElementById('pasteText').value = '';
      resultDiv.innerHTML = '';
      renderBanking(container);
    });
  });
}
