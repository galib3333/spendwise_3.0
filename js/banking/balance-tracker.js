// ===== BALANCE TRACKER =====
// Maintains running balance per account, detects discrepancies

import { getBankAccounts, updateBankAccount } from '../store.js';

export function calculateBalanceFromTransactions(accountId, transactions) {
  const account = getBankAccounts().find(a => a.id === accountId);
  if (!account) return null;

  let balance = account.initialBalance || 0;
  const sorted = [...transactions]
    .filter(t => t.bankAccountId === accountId)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    switch (tx.type) {
      case 'received':
      case 'credit':
      case 'cashin':
      case 'salary':
      case 'bonus':
      case 'addfund':
        balance += tx.amount;
        break;
      case 'sent':
      case 'debit':
      case 'cashout':
      case 'payment':
      case 'recharge':
      case 'withdrawal':
      case 'pos':
      case 'online':
      case 'bill':
      case 'card':
      case 'transfer':
        balance -= tx.amount;
        if (tx.fee) balance -= tx.fee;
        break;
    }
  }

  return balance;
}

export function reconcileBalance(accountId, transactions) {
  const account = getBankAccounts().find(a => a.id === accountId);
  if (!account) return { tracked: null, calculated: null, diff: 0, healthy: false };

  const calculated = calculateBalanceFromTransactions(accountId, transactions);
  const tracked = account.currentBalance;

  if (tracked === null || tracked === undefined || calculated === null) {
    return { tracked, calculated, diff: 0, healthy: true };
  }

  const diff = Math.round((tracked - calculated) * 100) / 100;
  return {
    tracked,
    calculated,
    diff,
    healthy: Math.abs(diff) < 0.01,
  };
}

export function updateBalanceFromParsed(accountId, parsed) {
  if (!parsed.balance) return;
  updateBankAccount(accountId, {
    currentBalance: parsed.balance,
    lastSynced: new Date().toISOString(),
  });
}

export function formatBalance(amount, currency = '৳') {
  if (amount === null || amount === undefined) return `${currency} --`;
  return `${currency}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
