// ===== EBL (Eastern Bank Limited) EMAIL ADAPTER =====
import { registerAdapter } from './email-parser.js';
import { today, toDateStr } from '../utils.js';

const PROVIDER_ID = 'ebl';
const PROVIDER_NAME = 'EBL';

// Transaction type patterns
const TYPE_PATTERNS = [
  { regex: /debit\s+(?:alert|notification)/i, type: 'debit' },
  { regex: /credit\s+(?:alert|notification)/i, type: 'credit' },
  { regex: /(?:fund\s*transfer|transferred)/i, type: 'transfer' },
  { regex: /(?:salary\s*(?:credit|deposit))/i, type: 'salary' },
  { regex: /(?:atm\s*(?:withdrawal|cash))/i, type: 'withdrawal' },
  { regex: /(?:pos\s*(?:transaction|payment))/i, type: 'pos' },
  { regex: /(?:ecommerce|online\s*(?:transaction|payment))/i, type: 'online' },
  { regex: /(?:bill\s*payment|utility)/i, type: 'bill' },
  { regex: /(?:card\s*(?:payment|transaction))/i, type: 'card' },
];

// Amount pattern: Tk 5,000.00 or BDT 5,000.00 or ৳5,000.00 or BDT5000
const AMOUNT_REGEX = /(?:Tk|৳|BDT)\s*([\d,]+\.?\d*)/i;

// Fallback: "debited with 5,000.00" or "credited with 5,000.00" or "amount: 5,000.00"
const AMOUNT_FALLBACK_REGEX = /(?:debited|credited|with|amount)\s*(?:of|:)?\s*([\d,]+\.?\d{2})/i;

// Balance pattern: Avail Bal: Tk 45,000.00 or Balance: BDT 45,000.00 or available balance Tk 45,000.00
const BALANCE_REGEX = /(?:avail(?:able)?(?:\s*bal)?|balance|closing|current)\s*(?::|is)?\s*(?:Tk|৳|BDT)\s*([\d,]+\.?\d*)/i;

// Reference pattern
const REF_REGEX = /(?:ref(?:erence)?|auth(?:orization)?)\s*(?::)?\s*([A-Z0-9]+)/i;

// Account pattern: account ending in 1234
const ACCOUNT_REGEX = /account\s+(?:ending\s+in\s+)?(\d{4,})/i;

// Merchant/location pattern: at STAR WARS
const MERCHANT_REGEX = /(?:at|to|from)\s+([A-Z][A-Z\s]+?)(?:\.|,|\n|$)/i;

// Date patterns: 15/06/2026 or 2026-06-15 or "15 June 2026"
const DATE_REGEX = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{1,2}\s+\w+\s+\d{4})/i;

function parseAmount(text) {
  const match = text.match(AMOUNT_REGEX);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  // Fallback: try to find amount after "debited with X" or "amount: X"
  const fallback = text.match(AMOUNT_FALLBACK_REGEX);
  if (fallback) return parseFloat(fallback[1].replace(/,/g, ''));
  return null;
}

function parseBalance(text) {
  const match = text.match(BALANCE_REGEX);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

function parseRef(text) {
  const match = text.match(REF_REGEX);
  return match ? match[1] : null;
}

function parseAccount(text) {
  const match = text.match(ACCOUNT_REGEX);
  return match ? `****${match[1]}` : null;
}

function parseMerchant(text) {
  const match = text.match(MERCHANT_REGEX);
  return match ? match[1].trim() : null;
}

function parseType(text) {
  for (const p of TYPE_PATTERNS) {
    if (p.regex.test(text)) return p.type;
  }
  // Default: check for credit/debit keywords
  if (/\bcredited?\b/i.test(text)) return 'credit';
  if (/\bdebited?\b/i.test(text)) return 'debit';
  return 'unknown';
}

function formatDate(dateStr) {
  if (!dateStr) return today();

  // Handle ISO format YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    let [, day, month, year] = slashMatch;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try "15 June 2026"
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return toDateStr(d);

  return today();
}

function parse(subject, body, date) {
  const text = `${subject || ''} ${body || ''}`;

  // Context-aware: extract amount from "debited with Tk X" or "credited with Tk X" first
  const ctxMatch = text.match(/(?:debited|credited)\s+with\s+(?:(?:Tk|৳|BDT)\s*)?([\d,]+\.?\d*)/i);
  let amount = ctxMatch ? parseFloat(ctxMatch[1].replace(/,/g, '')) : null;

  // Fallback to generic amount pattern
  if (amount === null) amount = parseAmount(text);
  if (amount === null) return null;

  const txType = parseType(text);
  const balance = parseBalance(text);
  const ref = parseRef(text);
  const account = parseAccount(text);
  const counterparty = parseMerchant(text);

  // Extract date from body if not provided
  let txDate = date;
  if (!txDate) {
    const dateMatch = text.match(DATE_REGEX);
    if (dateMatch) txDate = dateMatch[0];
  }

  return {
    provider: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    type: txType,
    amount,
    balance,
    counterparty,
    ref,
    account,
    date: formatDate(txDate),
    raw: text.slice(0, 500),
  };
}

function detect(from, subject) {
  return /ebl\.com/i.test(from) || /ebl\s*bank/i.test(from) || /\bebl\b/i.test(subject);
}

registerAdapter({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  parse,
  detect,
  typePatterns: TYPE_PATTERNS,
});
