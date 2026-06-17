// ===== GMAIL FETCHER =====
// Fetches and parses bKash/EBL emails via Gmail API

import { getAccessToken, isGmailConnected } from './gmail-auth.js';
import { parseEmailAuto, detectProvider } from './email-parser.js';
import './bkb-adapter.js';
import './ebl-adapter.js';
import './nagad-adapter.js';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

// Gmail search queries for each provider
const PROVIDER_QUERIES = {
  bkash: 'from:(no-reply@bkash.com OR alerts@bkash.com) newer_than:30d',
  nagad: 'from:(no-reply@nagad.com.bd OR alerts@nagad.com.bd) newer_than:30d',
  ebl: 'from:(alerts@ebl.com.pl OR noreply@ebl.com.pl) newer_than:30d',
};

async function gmailFetch(endpoint) {
  const token = getAccessToken();
  if (!token) throw new Error('Not connected to Gmail');

  const res = await fetch(`${GMAIL_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Gmail token expired');
    throw new Error(`Gmail API error: ${res.status}`);
  }
  return res.json();
}

function decodeBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return atob(padded);
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBody(payload) {
  if (!payload) return '';

  // Simple text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Simple text/html body
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }

  // Multipart — find text/plain part first, then text/html as fallback
  if (payload.parts) {
    let htmlBody = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = stripHtml(decodeBase64Url(part.body.data));
      }
      // Nested multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    if (htmlBody) return htmlBody;
  }

  // Fallback: try body.data
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') return stripHtml(raw);
    return raw;
  }

  return '';
}

function getHeader(headers, name) {
  const h = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

async function fetchEmailList(query, maxResults = 50) {
  const data = await gmailFetch(`/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  return data.messages || [];
}

async function fetchEmail(messageId) {
  const data = await gmailFetch(`/users/me/messages/${messageId}?format=full`);
  return {
    id: data.id,
    subject: getHeader(data.payload?.headers, 'Subject'),
    from: getHeader(data.payload?.headers, 'From'),
    date: getHeader(data.payload?.headers, 'Date'),
    body: extractBody(data.payload),
  };
}

export async function fetchAndParseEmails(providerId, maxResults = 50, onProgress = null) {
  if (!isGmailConnected()) throw new Error('Not connected to Gmail');

  const query = PROVIDER_QUERIES[providerId];
  if (!query) throw new Error(`Unknown provider: ${providerId}`);

  const messages = await fetchEmailList(query, maxResults);
  const parsed = [];
  const errors = [];

  for (let i = 0; i < messages.length; i++) {
    if (onProgress) onProgress(i + 1, messages.length);

    try {
      const email = await fetchEmail(messages[i].id);
      const result = parseEmailAuto(email.subject, email.body, email.from, email.date);
      if (result) {
        result.emailId = email.id;
        parsed.push(result);
      }
    } catch (e) {
      errors.push({ messageId: messages[i].id, error: e.message });
    }
  }

  return { parsed, errors, total: messages.length };
}

export async function fetchLatestBalance(providerId) {
  if (!isGmailConnected()) return null;

  const query = PROVIDER_QUERIES[providerId];
  if (!query) return null;

  // Fetch just the latest email
  const messages = await fetchEmailList(query, 1);
  if (messages.length === 0) return null;

  const email = await fetchEmail(messages[0].id);
  const result = parseEmailAuto(email.subject, email.body, email.from, email.date);
  return result?.balance ?? null;
}

export function getSupportedProviders() {
  return Object.keys(PROVIDER_QUERIES);
}
