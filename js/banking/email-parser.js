// ===== EMAIL PARSER REGISTRY =====
// Base parser interface + adapter registry for bank email parsing

const adapters = new Map();

export function registerAdapter(adapter) {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id) {
  return adapters.get(id);
}

export function getAllAdapters() {
  return [...adapters.values()];
}

export function parseEmail(providerId, subject, body, date) {
  const adapter = adapters.get(providerId);
  if (!adapter) return null;
  return adapter.parse(subject, body, date);
}

export function detectProvider(subject, from) {
  const lowerFrom = (from || '').toLowerCase();
  const lowerSubject = (subject || '').toLowerCase();

  for (const adapter of adapters.values()) {
    if (adapter.detect(lowerFrom, lowerSubject)) {
      return adapter.id;
    }
  }
  return null;
}

export function parseEmailAuto(subject, body, from, date) {
  const provider = detectProvider(subject, from);
  if (!provider) return null;
  return parseEmail(provider, subject, body, date);
}
