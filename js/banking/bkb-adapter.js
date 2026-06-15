// ===== bKash EMAIL ADAPTER =====
import { registerAdapter } from './email-parser.js';
import { today, toDateStr } from '../utils.js';

const PROVIDER_ID = 'bkash';
const PROVIDER_NAME = 'bKash';

// Transaction type patterns
const TYPE_PATTERNS = [
  { regex: /sent\s+(?:Tk|৳|BDT|money)/i, type: 'sent' },
  { regex: /received\s+(?:Tk|৳|BDT|money)/i, type: 'received' },
  { regex: /(?:cash\s*out|withdrawn|withdrawal)/i, type: 'cashout' },
  { regex: /(?:cash\s*in|deposited)/i, type: 'cashin' },
  { regex: /(?:payment\s+(?:to|made))/i, type: 'payment' },
  { regex: /(?:mobile\s*recharge|recharge)/i, type: 'recharge' },
  { regex: /(?:add\s*funds|fund\s*added)/i, type: 'addfund' },
  { regex: /(?:bonus|cashback)/i, type: 'bonus' },
];

// Amount pattern: Tk 1,234.56 or ৳1,234.56 or BDT 1,234.56
const AMOUNT_REGEX = /(?:Tk|৳|BDT)\s*([\d,]+\.?\d*)/i;

// Balance pattern: Bal: Tk X,XXX.XX or Balance: ৳X,XXX.XX
const BALANCE_REGEX = /(?:bal(?:ance)?|avail(?:able)?(?:\s*bal)?)\s*(?:is|:)?\s*(?:Tk|৳|BDT)\s*([\d,]+\.?\d*)/i;

// Fee pattern
const FEE_REGEX = /(?:fee|charge|commission)\s*(?:is|:)?\s*(?:Tk|৳|BDT)\s*([\d,]+\.?\d*)/i;

// Transaction ID pattern
const TRXID_REGEX = /(?:TrxID|trx\s*id|transaction\s*(?:id|no))\s*:?\s*([A-Z0-9]+)/i;

// Counterparty pattern: to 01712345678 (John) or to John (01712345678) or from Ahmed (01812345678)
const COUNTERPARTY_REGEX = /(?:to|from)\s+(?:(\d{11})\s*\(([^)]+)\)|([A-Za-z][\w\s]*?)\s*\((\d{11})\)|([A-Za-z][\w\s]*?))\s*(?:\.|,|\(|$)/i;

function parseAmount(text) {
  const match = text.match(AMOUNT_REGEX);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

function parseBalance(text) {
  const match = text.match(BALANCE_REGEX);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

function parseFee(text) {
  const match = text.match(FEE_REGEX);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ''));
}

function parseTrxId(text) {
  const match = text.match(TRXID_REGEX);
  return match ? match[1] : null;
}

function parseCounterparty(text) {
  const match = text.match(COUNTERPARTY_REGEX);
  if (!match) return null;
  // match[2] = name when phone-first, match[3] = name when name-first, match[5] = name alone
  return match[2] || match[3] || match[5] || null;
}

function parseType(text) {
  for (const p of TYPE_PATTERNS) {
    if (p.regex.test(text)) return p.type;
  }
  return 'unknown';
}

function formatDate(dateStr) {
  if (!dateStr) return today();
  // bKash emails: "15 June 2026, 3:45 PM" or "2026-06-15"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return today();
  return toDateStr(d);
}

function parse(subject, body, date) {
  const text = `${subject || ''} ${body || ''}`;
  const amount = parseAmount(text);
  if (amount === null) return null;

  const txType = parseType(text);
  const balance = parseBalance(text);
  const fee = parseFee(text);
  const trxId = parseTrxId(text);
  const counterparty = parseCounterparty(text);

  return {
    provider: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    type: txType,
    amount,
    balance,
    fee,
    counterparty,
    trxId,
    date: formatDate(date),
    raw: text.slice(0, 500),
  };
}

function detect(from, subject) {
  return /bkash\.com/i.test(from) || /bkash/i.test(subject);
}

registerAdapter({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  parse,
  detect,
  typePatterns: TYPE_PATTERNS,
});
