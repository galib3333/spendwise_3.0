import { describe, it, expect, beforeEach } from 'vitest';

describe('Security Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports all expected functions', async () => {
    const mod = await import('../js/security.js');
    expect(typeof mod.hasPIN).toBe('function');
    expect(typeof mod.setupPIN).toBe('function');
    expect(typeof mod.verifyPIN).toBe('function');
    expect(typeof mod.removePIN).toBe('function');
    expect(typeof mod.isLockEnabled).toBe('function');
    expect(typeof mod.setLockEnabled).toBe('function');
    expect(typeof mod.isLocked).toBe('function');
    expect(typeof mod.setLocked).toBe('function');
    expect(typeof mod.isLockedOut).toBe('function');
    expect(typeof mod.getRemainingLockoutMs).toBe('function');
    expect(typeof mod.encryptData).toBe('function');
    expect(typeof mod.decryptData).toBe('function');
    expect(typeof mod.setLockTimeout).toBe('function');
    expect(typeof mod.getLockTimeout).toBe('function');
    expect(typeof mod.getPrivacyPolicy).toBe('function');
    expect(typeof mod.setDataKey).toBe('function');
    expect(typeof mod.clearDataKey).toBe('function');
    expect(typeof mod.isDataEncrypted).toBe('function');
    expect(typeof mod.encryptForStorage).toBe('function');
    expect(typeof mod.decryptFromStorage).toBe('function');
    expect(typeof mod.generateRecoveryKey).toBe('function');
    expect(typeof mod.setRecoveryKey).toBe('function');
    expect(typeof mod.verifyRecoveryKey).toBe('function');
    expect(typeof mod.hasRecoveryKey).toBe('function');
    expect(typeof mod.removeRecoveryKey).toBe('function');
  });

  it('hasPIN returns false initially', async () => {
    const { hasPIN } = await import('../js/security.js');
    expect(hasPIN()).toBe(false);
  });

  it('isLockEnabled returns false when no PIN', async () => {
    const { isLockEnabled } = await import('../js/security.js');
    expect(isLockEnabled()).toBe(false);
  });

  it('getLockTimeout returns default 5 min', async () => {
    const { getLockTimeout } = await import('../js/security.js');
    expect(getLockTimeout()).toBe(5 * 60 * 1000);
  });

  it('setLockTimeout persists value', async () => {
    const { setLockTimeout, getLockTimeout } = await import('../js/security.js');
    setLockTimeout(60000);
    expect(getLockTimeout()).toBe(60000);
    expect(localStorage.getItem('sw_lock_timeout')).toBe('60000');
  });

  it('isLockedOut returns false initially', async () => {
    const { isLockedOut } = await import('../js/security.js');
    expect(isLockedOut()).toBe(false);
  });

  it('getRemainingLockoutMs returns 0 initially', async () => {
    const { getRemainingLockoutMs } = await import('../js/security.js');
    expect(getRemainingLockoutMs()).toBe(0);
  });

  it('getPrivacyPolicy returns markdown string', async () => {
    const { getPrivacyPolicy } = await import('../js/security.js');
    const policy = getPrivacyPolicy();
    expect(typeof policy).toBe('string');
    expect(policy).toContain('SpendWise');
    expect(policy).toContain('Privacy Policy');
    expect(policy).toContain('Data Collection');
  });

  it('setupPIN rejects short PIN', async () => {
    const { setupPIN } = await import('../js/security.js');
    const result = await setupPIN('12');
    expect(result).toBe(false);
  });

  it('setupPIN rejects non-numeric PIN', async () => {
    const { setupPIN } = await import('../js/security.js');
    const result = await setupPIN('abcd');
    expect(result).toBe(false);
  });

  it('encryptData returns valid structure', async () => {
    const { encryptData } = await import('../js/security.js');
    const result = await encryptData({ test: true }, 'password123');
    expect(result).toHaveProperty('salt');
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('version', 1);
    expect(typeof result.salt).toBe('string');
    expect(typeof result.iv).toBe('string');
    expect(typeof result.data).toBe('string');
  });

  it('isDataEncrypted returns false initially', async () => {
    const { isDataEncrypted } = await import('../js/security.js');
    expect(isDataEncrypted()).toBe(false);
  });

  it('clearDataKey resets encryption state', async () => {
    const { clearDataKey, isDataEncrypted } = await import('../js/security.js');
    clearDataKey();
    expect(isDataEncrypted()).toBe(false);
  });

  it('encryptForStorage passes through when no data key', async () => {
    const { encryptForStorage, clearDataKey } = await import('../js/security.js');
    clearDataKey();
    const data = { test: 'value' };
    const result = await encryptForStorage(data);
    expect(result).toEqual(data);
  });

  it('decryptFromStorage passes through non-encrypted data', async () => {
    const { decryptFromStorage } = await import('../js/security.js');
    const data = { test: 'value' };
    const result = await decryptFromStorage(data);
    expect(result).toEqual(data);
  });

  it('decryptFromStorage returns null for encrypted data without key', async () => {
    const { decryptFromStorage } = await import('../js/security.js');
    const encrypted = { sw_enc_: true, iv: 'aabb', data: 'ccdd' };
    const result = await decryptFromStorage(encrypted);
    expect(result).toBeNull();
  });

  it('generateRecoveryKey returns 16-character alphanumeric string', async () => {
    const { generateRecoveryKey } = await import('../js/security.js');
    const key = generateRecoveryKey();
    expect(key).toHaveLength(16);
    expect(/^[A-Z2-9]+$/.test(key)).toBe(true);
  });

  it('generateRecoveryKey produces unique keys', async () => {
    const { generateRecoveryKey } = await import('../js/security.js');
    const keys = new Set();
    for (let i = 0; i < 100; i++) keys.add(generateRecoveryKey());
    expect(keys.size).toBe(100);
  });

  it('hasRecoveryKey returns false initially', async () => {
    const { hasRecoveryKey } = await import('../js/security.js');
    expect(hasRecoveryKey()).toBe(false);
  });

  it('setRecoveryKey and verifyRecoveryKey work correctly', async () => {
    const { generateRecoveryKey, setRecoveryKey, verifyRecoveryKey, removeRecoveryKey } = await import('../js/security.js');
    const key = generateRecoveryKey();
    await setRecoveryKey(key);
    expect(await verifyRecoveryKey(key)).toBe(true);
    expect(await verifyRecoveryKey('WRONGKEYXXXXXX')).toBe(false);
    removeRecoveryKey();
  });

  it('removeRecoveryKey clears stored key', async () => {
    const { generateRecoveryKey, setRecoveryKey, hasRecoveryKey, removeRecoveryKey } = await import('../js/security.js');
    const key = generateRecoveryKey();
    await setRecoveryKey(key);
    expect(hasRecoveryKey()).toBe(true);
    removeRecoveryKey();
    expect(hasRecoveryKey()).toBe(false);
  });
});
