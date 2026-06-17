import { describe, it, expect } from 'vitest';
import {
  uid, fmt, fmtShort, today, formatDate,
  getCat, getWeekDates, escapeCSV, parseCSVSimple,
  validateTransaction, validateBudget, validateGoal, validateRecurring,
  sanitizeImportData, EXPENSE_CATS, INCOME_CATS, ALL_CATS, PAYMENT_LABELS
} from '../js/utils.js';

describe('uid', () => {
  it('generates unique ids', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(uid());
    expect(ids.size).toBe(100);
  });
});

describe('fmt', () => {
  it('formats number with currency', () => {
    expect(fmt(1234.56, '$')).toBe('$1,234.56');
  });
  it('handles zero', () => {
    expect(fmt(0, '৳')).toBe('৳0.00');
  });
  it('handles null/undefined', () => {
    expect(fmt(null, '$')).toBe('$0.00');
    expect(fmt(undefined, '$')).toBe('$0.00');
  });
});

describe('fmtShort', () => {
  it('formats without decimals', () => {
    expect(fmtShort(1234.56, '$')).toBe('$1,235');
  });
});

describe('today', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('formats YYYY-MM-DD', () => {
    expect(formatDate('2026-06-14', 'YYYY-MM-DD')).toBe('2026-06-14');
  });
  it('formats DD/MM/YYYY', () => {
    expect(formatDate('2026-06-14', 'DD/MM/YYYY')).toBe('14/06/2026');
  });
  it('formats MM/DD/YYYY', () => {
    expect(formatDate('2026-06-14', 'MM/DD/YYYY')).toBe('06/14/2026');
  });
  it('handles empty', () => {
    expect(formatDate('', 'YYYY-MM-DD')).toBe('');
  });
});

describe('getCat', () => {
  it('finds expense category', () => {
    const cat = getCat('food');
    expect(cat.name).toBe('Food & Dining');
    expect(cat.icon).toBe('🍽️');
  });
  it('finds income category', () => {
    const cat = getCat('salary');
    expect(cat.name).toBe('Salary');
  });
  it('returns unknown for missing', () => {
    const cat = getCat('nonexistent');
    expect(cat.name).toBe('Unknown');
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    const dates = getWeekDates('2026-06-14');
    expect(dates).toHaveLength(7);
  });
  it('all dates are YYYY-MM-DD', () => {
    const dates = getWeekDates('2026-06-14');
    dates.forEach(d => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe('escapeCSV', () => {
  it('wraps commas in quotes', () => {
    expect(escapeCSV('hello, world')).toBe('"hello, world"');
  });
  it('escapes double quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });
  it('passes plain text', () => {
    expect(escapeCSV('hello')).toBe('hello');
  });
});

describe('parseCSVSimple', () => {
  it('parses basic CSV', () => {
    const result = parseCSVSimple('a,b,c\n1,2,3');
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields', () => {
    const result = parseCSVSimple('"a,b",c');
    expect(result).toEqual([['a,b', 'c']]);
  });
});

describe('validation', () => {
  describe('validateTransaction', () => {
    it('accepts valid data', () => {
      const errors = validateTransaction({
        amount: 100, date: '2026-06-14', category: 'food', type: 'expense', payment: 'cash'
      });
      expect(errors).toHaveLength(0);
    });
    it('rejects zero amount', () => {
      const errors = validateTransaction({
        amount: 0, date: '2026-06-14', category: 'food', type: 'expense'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
    it('rejects negative amount', () => {
      const errors = validateTransaction({
        amount: -100, date: '2026-06-14', category: 'food', type: 'expense'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
    it('rejects huge amount', () => {
      const errors = validateTransaction({
        amount: 9999999999999, date: '2026-06-14', category: 'food', type: 'expense'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
    it('rejects invalid date', () => {
      const errors = validateTransaction({
        amount: 100, date: 'bad-date', category: 'food', type: 'expense'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
    it('rejects missing category', () => {
      const errors = validateTransaction({
        amount: 100, date: '2026-06-14', category: '', type: 'expense'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
    it('rejects invalid type', () => {
      const errors = validateTransaction({
        amount: 100, date: '2026-06-14', category: 'food', type: 'invalid'
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateBudget', () => {
    it('accepts valid data', () => {
      expect(validateBudget({ category: 'food', limit: 5000 })).toHaveLength(0);
    });
    it('rejects zero limit', () => {
      expect(validateBudget({ category: 'food', limit: 0 }).length).toBeGreaterThan(0);
    });
  });

  describe('validateGoal', () => {
    it('accepts valid data', () => {
      expect(validateGoal({ name: 'Emergency Fund', target: 100000 })).toHaveLength(0);
    });
    it('rejects empty name', () => {
      expect(validateGoal({ name: '', target: 100000 }).length).toBeGreaterThan(0);
    });
  });

  describe('validateRecurring', () => {
    it('accepts valid data', () => {
      expect(validateRecurring({
        amount: 500, description: 'Netflix', frequency: 'monthly',
        category: 'subscriptions', startDate: '2026-01-01', nextDate: '2026-06-01'
      })).toHaveLength(0);
    });
    it('rejects invalid frequency', () => {
      expect(validateRecurring({
        amount: 500, description: 'Netflix', frequency: 'invalid',
        category: 'subscriptions', startDate: '2026-01-01', nextDate: '2026-06-01'
      }).length).toBeGreaterThan(0);
    });
  });
});

describe('sanitizeImportData', () => {
  it('cleans valid data', () => {
    const data = {
      transactions: [{ id: '1', amount: 100, date: '2026-06-14', type: 'expense', category: 'food' }],
      budgets: [{ id: 'b1', category: 'food', limit: 5000 }]
    };
    const clean = sanitizeImportData(data);
    expect(clean.transactions).toHaveLength(1);
    expect(clean.budgets).toHaveLength(1);
  });
  it('filters invalid transactions', () => {
    const data = {
      transactions: [
        { id: '1', amount: 100, date: '2026-06-14', type: 'expense', category: 'food' },
        { id: '2' }, // missing required fields
        null,
        { notATransaction: true }
      ]
    };
    const clean = sanitizeImportData(data);
    expect(clean.transactions).toHaveLength(1);
  });
  it('handles null input', () => {
    expect(sanitizeImportData(null)).toBeNull();
  });
});

describe('constants', () => {
  it('has 12 expense categories', () => {
    expect(EXPENSE_CATS).toHaveLength(12);
  });
  it('has 6 income categories', () => {
    expect(INCOME_CATS).toHaveLength(6);
  });
  it('has 18 total categories', () => {
    expect(ALL_CATS).toHaveLength(18);
  });
  it('has 9 payment methods', () => {
    expect(Object.keys(PAYMENT_LABELS)).toHaveLength(9);
  });
});
