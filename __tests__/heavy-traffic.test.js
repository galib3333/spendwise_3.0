import { describe, it, expect, beforeEach } from 'vitest';
import {
  uid, parseCSVSimple,
  validateTransaction, validateRecurring,
  sanitizeImportData, EXPENSE_CATS
} from '../js/utils.js';
import {
  initStore, addTransaction, getTransactions, deleteTransaction,
  addRecurring, getRecurringList, updateRecurring, deleteRecurring,
  toggleRecurringActive, addBulkTransactions, replaceAllData,
  clearAllData
} from '../js/store.js';

// ===== HELPERS =====
function makeTransaction(i) {
  const cats = EXPENSE_CATS.map(c => c.id);
  return {
    id: uid(),
    type: 'expense',
    amount: Math.round(Math.random() * 50000 * 100) / 100,
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    category: cats[i % cats.length],
    payment: ['cash', 'card', 'upi'][i % 3],
    description: `Transaction ${i} test item`,
    tags: i % 5 === 0 ? ['recurring'] : [],
    recurring: i % 10 === 0,
    frequency: i % 10 === 0 ? 'monthly' : null
  };
}

function makeRecurring(i, freq = 'monthly', endDate = null) {
  const cats = EXPENSE_CATS.map(c => c.id);
  return {
    id: uid(),
    amount: (i + 1) * 100,
    description: `Recurring item ${i}`,
    frequency: freq,
    category: cats[i % cats.length],
    startDate: '2026-01-01',
    nextDate: '2026-06-01',
    endDate,
    active: true
  };
}

// ===== INIT STORE (runs once) =====
beforeAll(async () => {
  await initStore();
});

beforeEach(() => {
  clearAllData();
});

// ==========================================
// 1. LARGE TRANSACTION VOLUME
// ==========================================
describe('Heavy Traffic - Large Transaction Volume', () => {
  it.each([1000, 5000])('adds %i transactions without error', (count) => {
    const txns = [];
    for (let i = 0; i < count; i++) txns.push(makeTransaction(i));
    addBulkTransactions(txns);
    expect(getTransactions()).toHaveLength(count);
  });

  it('filters 1000 transactions under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));
    addBulkTransactions(txns);

    const start = performance.now();
    const filtered = getTransactions().filter(t => t.type === 'expense' && t.category === 'food');
    const elapsed = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('sorts 1000 transactions under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));
    addBulkTransactions(txns);

    const start = performance.now();
    const sorted = [...getTransactions()].sort((a, b) => b.amount - a.amount);
    const elapsed = performance.now() - start;

    expect(sorted[0].amount).toBeGreaterThanOrEqual(sorted[1].amount);
    expect(elapsed).toBeLessThan(500);
  });

  it('deletes from 1000 transactions without error', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));
    addBulkTransactions(txns);

    const ids = getTransactions().slice(0, 100).map(t => t.id);
    ids.forEach(id => deleteTransaction(id));
    expect(getTransactions()).toHaveLength(900);
  });
});

// ==========================================
// 2. LARGE TRANSACTION GENERATION
// ==========================================
describe('Heavy Traffic - Bulk Transaction Generation', () => {
  it('generates 5000 transactions via addBulkTransactions under 1s', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) txns.push(makeTransaction(i));

    const start = performance.now();
    addBulkTransactions(txns);
    const elapsed = performance.now() - start;

    expect(getTransactions()).toHaveLength(5000);
    expect(elapsed).toBeLessThan(1000);
  });

  it('replaceAllData with 5000 transactions completes under 1s', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) txns.push(makeTransaction(i));

    const start = performance.now();
    replaceAllData({ transactions: txns, budgets: [], savingsGoals: [], recurringList: [] });
    const elapsed = performance.now() - start;

    expect(getTransactions()).toHaveLength(5000);
    expect(elapsed).toBeLessThan(1000);
  });
});

// ==========================================
// 3. UID UNIQUENESS UNDER LOAD
// ==========================================
describe('Heavy Traffic - UID Uniqueness', () => {
  it('generates 10000 unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 10000; i++) ids.add(uid());
    expect(ids.size).toBe(10000);
  });

  it('generates 50000 unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 50000; i++) ids.add(uid());
    expect(ids.size).toBe(50000);
  });
});

// ==========================================
// 4. CSV PARSING AT SCALE
// ==========================================
describe('Heavy Traffic - CSV Parsing', () => {
  it('parses 5000-row CSV under 1s', () => {
    let csv = 'Date,Description,Amount\n';
    for (let i = 0; i < 5000; i++) {
      csv += `2026-01-${String((i % 28) + 1).padStart(2, '0')},Item ${i},${(i + 1) * 10}\n`;
    }

    const start = performance.now();
    const rows = parseCSVSimple(csv);
    const elapsed = performance.now() - start;

    expect(rows.length).toBe(5001); // header + 5000 rows
    expect(elapsed).toBeLessThan(1000);
  });

  it('parses 10000-row CSV under 2s', () => {
    let csv = 'Date,Description,Amount\n';
    for (let i = 0; i < 10000; i++) {
      csv += `2026-01-${String((i % 28) + 1).padStart(2, '0')},Item ${i},${(i + 1) * 10}\n`;
    }

    const start = performance.now();
    const rows = parseCSVSimple(csv);
    const elapsed = performance.now() - start;

    expect(rows.length).toBe(10001);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ==========================================
// 5. SANITIZE IMPORT DATA AT SCALE
// ==========================================
describe('Heavy Traffic - Sanitize Import', () => {
  it('sanitizes 1000 transactions under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) {
      txns.push({
        id: String(i), amount: 100 + i, date: '2026-06-14',
        type: 'expense', category: 'food', description: `Item ${i}`,
        payment: 'cash', tags: [], recurring: false
      });
    }

    const start = performance.now();
    const clean = sanitizeImportData({ transactions: txns });
    const elapsed = performance.now() - start;

    expect(clean.transactions).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500);
  });

  it('sanitizes 5000 transactions under 2s', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) {
      txns.push({
        id: String(i), amount: 100 + i, date: '2026-06-14',
        type: i % 2 === 0 ? 'expense' : 'income', category: 'food',
        description: `Item ${i}`, payment: 'cash', tags: [], recurring: false
      });
    }

    const start = performance.now();
    const clean = sanitizeImportData({ transactions: txns });
    const elapsed = performance.now() - start;

    expect(clean.transactions).toHaveLength(5000);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ==========================================
// 6. VALIDATION AT SCALE
// ==========================================
describe('Heavy Traffic - Validation', () => {
  it('validates 1000 transactions under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) {
      txns.push({ amount: 100 + i, date: '2026-06-14', category: 'food', type: 'expense', payment: 'cash' });
    }

    const start = performance.now();
    let errorCount = 0;
    for (const t of txns) {
      if (validateTransaction(t).length > 0) errorCount++;
    }
    const elapsed = performance.now() - start;

    expect(errorCount).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('validates 1000 recurring items under 500ms', () => {
    const items = [];
    for (let i = 0; i < 1000; i++) {
      items.push({
        amount: 500, description: `Item ${i}`, frequency: 'monthly',
        category: 'subscriptions', startDate: '2026-01-01', nextDate: '2026-06-01'
      });
    }

    const start = performance.now();
    let errorCount = 0;
    for (const item of items) {
      if (validateRecurring(item).length > 0) errorCount++;
    }
    const elapsed = performance.now() - start;

    expect(errorCount).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });
});

// ==========================================
// 7. RECURRING PROCESSING
// ==========================================
describe('Heavy Traffic - Recurring Processing', () => {
  it('adds 100 recurring items without error', () => {
    for (let i = 0; i < 100; i++) {
      addRecurring(makeRecurring(i));
    }
    expect(getRecurringList()).toHaveLength(100);
  });

  it('adds 500 recurring items without error', () => {
    for (let i = 0; i < 500; i++) {
      addRecurring(makeRecurring(i));
    }
    expect(getRecurringList()).toHaveLength(500);
  });

  it('toggles 100 recurring items under 500ms', () => {
    for (let i = 0; i < 100; i++) addRecurring(makeRecurring(i));

    const start = performance.now();
    const ids = getRecurringList().slice(0, 100).map(r => r.id);
    ids.forEach(id => toggleRecurringActive(id));
    const elapsed = performance.now() - start;

    const allPaused = getRecurringList().every(r => !r.active);
    expect(allPaused).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it('updates nextDate for 500 recurring items under 500ms', () => {
    for (let i = 0; i < 500; i++) addRecurring(makeRecurring(i));

    const start = performance.now();
    const ids = getRecurringList().map(r => r.id);
    ids.forEach(id => updateRecurring(id, { nextDate: '2026-07-01' }));
    const elapsed = performance.now() - start;

    const allUpdated = getRecurringList().every(r => r.nextDate === '2026-07-01');
    expect(allUpdated).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it('deletes 200 recurring items under 500ms', () => {
    for (let i = 0; i < 300; i++) addRecurring(makeRecurring(i));
    expect(getRecurringList()).toHaveLength(300);

    const start = performance.now();
    const ids = getRecurringList().slice(0, 200).map(r => r.id);
    ids.forEach(id => deleteRecurring(id));
    const elapsed = performance.now() - start;

    expect(getRecurringList()).toHaveLength(100);
    expect(elapsed).toBeLessThan(500);
  });
});

// ==========================================
// 8. RECURRING END DATE HANDLING
// ==========================================
describe('Heavy Traffic - Recurring End Dates', () => {
  it('creates recurring items with end dates', () => {
    for (let i = 0; i < 50; i++) {
      addRecurring(makeRecurring(i, 'monthly', '2026-09-01'));
    }
    const items = getRecurringList();
    expect(items).toHaveLength(50);
    items.forEach(r => expect(r.endDate).toBe('2026-09-01'));
  });

  it('creates mixed ongoing and finite recurring items', () => {
    for (let i = 0; i < 25; i++) addRecurring(makeRecurring(i, 'monthly', null));
    for (let i = 25; i < 50; i++) addRecurring(makeRecurring(i, 'monthly', '2026-09-01'));

    const items = getRecurringList();
    expect(items).toHaveLength(50);
    const ongoing = items.filter(r => !r.endDate);
    const finite = items.filter(r => r.endDate);
    expect(ongoing).toHaveLength(25);
    expect(finite).toHaveLength(25);
  });

  it('handles all frequency types with end dates', () => {
    const freqs = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
    freqs.forEach((freq, i) => {
      for (let j = 0; j < 10; j++) {
        addRecurring(makeRecurring(i * 10 + j, freq, '2026-12-31'));
      }
    });
    expect(getRecurringList()).toHaveLength(50);
  });
});

// ==========================================
// 9. RENDER STRING GENERATION PERFORMANCE
// ==========================================
describe('Heavy Traffic - Render Performance', () => {
  it('builds 500 transaction row HTML under 200ms', () => {
    const txns = [];
    for (let i = 0; i < 500; i++) txns.push(makeTransaction(i));

    const start = performance.now();
    const html = txns.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td>${t.category}</td>
        <td>${t.amount}</td>
      </tr>
    `).join('');
    const elapsed = performance.now() - start;

    expect(html.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('builds 1000 transaction row HTML under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));

    const start = performance.now();
    const html = txns.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td>${t.category}</td>
        <td>${t.amount}</td>
      </tr>
    `).join('');
    const elapsed = performance.now() - start;

    expect(html.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('builds 200 recurring row HTML under 100ms', () => {
    const items = [];
    for (let i = 0; i < 200; i++) items.push(makeRecurring(i));

    const start = performance.now();
    const html = items.map(r => `
      <div class="recurring-row">
        <span>${r.description}</span>
        <span>${r.amount}</span>
        <span>${r.frequency}</span>
        <span>${r.endDate || 'Ongoing'}</span>
      </div>
    `).join('');
    const elapsed = performance.now() - start;

    expect(html.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });
});

// ==========================================
// 10. STORAGE LIMITS
// ==========================================
describe('Heavy Traffic - Storage Limits', () => {
  it('localStorage holds 1000 transactions (serialized)', () => {
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));

    const serialized = JSON.stringify(txns);
    expect(serialized.length).toBeGreaterThan(0);

    // Typical localStorage limit is 5-10MB
    expect(serialized.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('localStorage holds 5000 transactions (serialized)', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) txns.push(makeTransaction(i));

    const serialized = JSON.stringify(txns);
    // 5000 transactions should be under 5MB
    expect(serialized.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('10000 transactions serialized size is measurable', () => {
    const txns = [];
    for (let i = 0; i < 10000; i++) txns.push(makeTransaction(i));

    const serialized = JSON.stringify(txns);
    const sizeKB = serialized.length / 1024;
    const sizeMB = sizeKB / 1024;

    // Just verify it's measurable and reasonable
    expect(sizeMB).toBeGreaterThan(0);
    expect(sizeMB).toBeLessThan(20); // should be well under 20MB
  });

  it('500 recurring items serialized size is reasonable', () => {
    const items = [];
    for (let i = 0; i < 500; i++) items.push(makeRecurring(i));

    const serialized = JSON.stringify(items);
    const sizeKB = serialized.length / 1024;

    expect(sizeKB).toBeGreaterThan(0);
    expect(sizeKB).toBeLessThan(1024); // under 1MB
  });
});

// ==========================================
// 11. EDGE CASES
// ==========================================
describe('Heavy Traffic - Edge Cases', () => {
  it('handles empty transaction list', () => {
    expect(getTransactions()).toHaveLength(0);
  });

  it('handles single transaction', () => {
    addTransaction(makeTransaction(0));
    expect(getTransactions()).toHaveLength(1);
  });

  it('handles max amount', () => {
    const txn = makeTransaction(0);
    txn.amount = 999999999999;
    const errors = validateTransaction(txn);
    expect(errors).toHaveLength(0);
  });

  it('rejects over-max amount', () => {
    const txn = makeTransaction(0);
    txn.amount = 9999999999999;
    const errors = validateTransaction(txn);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles max-length description', () => {
    const txn = makeTransaction(0);
    txn.description = 'A'.repeat(200);
    const errors = validateTransaction(txn);
    expect(errors).toHaveLength(0);
  });

  it('rejects over-max-length description', () => {
    const txn = makeTransaction(0);
    txn.description = 'A'.repeat(201);
    const errors = validateTransaction(txn);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles max-amount recurring', () => {
    const errors = validateRecurring({
      amount: 999999999999, description: 'Test', frequency: 'monthly',
      category: 'rent', startDate: '2026-01-01', nextDate: '2026-06-01'
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects over-max-amount recurring', () => {
    const errors = validateRecurring({
      amount: 9999999999999, description: 'Test', frequency: 'monthly',
      category: 'rent', startDate: '2026-01-01', nextDate: '2026-06-01'
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles end date before start date', () => {
    const errors = validateRecurring({
      amount: 500, description: 'Test', frequency: 'monthly',
      category: 'rent', startDate: '2026-06-01', nextDate: '2026-06-01',
      endDate: '2026-01-01'
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles recurring with no endDate (ongoing)', () => {
    const errors = validateRecurring({
      amount: 500, description: 'Netflix', frequency: 'monthly',
      category: 'subscriptions', startDate: '2026-01-01', nextDate: '2026-06-01'
    });
    expect(errors).toHaveLength(0);
  });

  it('allows duplicate recurring items with different IDs', () => {
    const item = makeRecurring(0);
    addRecurring(item);
    addRecurring({ ...item, id: uid() });
    addRecurring({ ...item, id: uid() });
    expect(getRecurringList()).toHaveLength(3); // allows duplicates (user might want same item)
  });
});

// ==========================================
// 12. COMBINED STRESS TEST
// ==========================================
describe('Heavy Traffic - Combined Stress', () => {
  it('full workflow: add 1000 txns + 100 recurring + operations under 3s', () => {
    const start = performance.now();

    // Add 1000 transactions
    const txns = [];
    for (let i = 0; i < 1000; i++) txns.push(makeTransaction(i));
    addBulkTransactions(txns);

    // Add 100 recurring items
    for (let i = 0; i < 100; i++) addRecurring(makeRecurring(i));

    // Filter transactions
    const expenses = getTransactions().filter(t => t.type === 'expense');
    expect(expenses.length).toBeGreaterThan(0);

    // Sort transactions
    const sorted = [...getTransactions()].sort((a, b) => b.amount - a.amount);
    expect(sorted.length).toBe(1000);

    // Toggle some recurring
    const recurringIds = getRecurringList().slice(0, 50).map(r => r.id);
    recurringIds.forEach(id => toggleRecurringActive(id));

    // Update some recurring
    getRecurringList().slice(50, 100).forEach(r => updateRecurring(r.id, { nextDate: '2026-07-01' }));

    // Delete some transactions
    const deleteIds = getTransactions().slice(0, 100).map(t => t.id);
    deleteIds.forEach(id => deleteTransaction(id));

    const elapsed = performance.now() - start;

    expect(getTransactions()).toHaveLength(900);
    expect(getRecurringList()).toHaveLength(100);
    expect(elapsed).toBeLessThan(3000);
  });

  it('replaceAllData with 5000 txns + 500 recurring under 2s', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) txns.push(makeTransaction(i));
    const recurring = [];
    for (let i = 0; i < 500; i++) recurring.push(makeRecurring(i));

    const start = performance.now();
    replaceAllData({ transactions: txns, budgets: [], savingsGoals: [], recurringList: recurring });
    const elapsed = performance.now() - start;

    expect(getTransactions()).toHaveLength(5000);
    expect(getRecurringList()).toHaveLength(500);
    expect(elapsed).toBeLessThan(2000);
  });

  it('clearAllData after heavy load under 500ms', () => {
    const txns = [];
    for (let i = 0; i < 5000; i++) txns.push(makeTransaction(i));
    const recurring = [];
    for (let i = 0; i < 500; i++) recurring.push(makeRecurring(i));
    replaceAllData({ transactions: txns, budgets: [], savingsGoals: [], recurringList: recurring });

    const start = performance.now();
    clearAllData();
    const elapsed = performance.now() - start;

    expect(getTransactions()).toHaveLength(0);
    expect(getRecurringList()).toHaveLength(0);
    expect(elapsed).toBeLessThan(500);
  });
});
