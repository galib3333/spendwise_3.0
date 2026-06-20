import { describe, it, expect } from 'vitest';
import { detectProvider, parseEmailAuto } from '../js/banking/email-parser.js';
import '../js/banking/bkb-adapter.js';
import '../js/banking/ebl-adapter.js';
import '../js/banking/nagad-adapter.js';

describe('email parser', () => {
  describe('detectProvider', () => {
    it('detects bKash from sender', () => {
      expect(detectProvider('', 'no-reply@bkash.com')).toBe('bkash');
    });

    it('detects bKash from subject', () => {
      expect(detectProvider('bKash Payment Confirmation', '')).toBe('bkash');
    });

    it('detects EBL from sender', () => {
      expect(detectProvider('', 'alerts@ebl.com.pl')).toBe('ebl');
    });

    it('detects EBL from subject', () => {
      expect(detectProvider('EBL Debit Alert', '')).toBe('ebl');
    });

    it('returns null for unknown provider', () => {
      expect(detectProvider('random email', 'unknown@test.com')).toBeNull();
    });
  });

  describe('Nagad email parsing', () => {
    it('detects Nagad from sender', () => {
      expect(detectProvider('', 'no-reply@nagad.com.bd')).toBe('nagad');
    });

    it('detects Nagad from subject', () => {
      expect(detectProvider('Nagad Payment Confirmation', '')).toBe('nagad');
    });

    it('parses sent money email', () => {
      const body = `You have sent Tk 3,000.00 to Rahim (01712345678).
Fee: Tk 0.00. Bal: Tk 8,500.00. TrxID: NAG7A8B9C0D.
Date: 15 June 2026, 4:30 PM`;
      const result = parseEmailAuto('Nagad Payment Confirmation', body, 'no-reply@nagad.com.bd', '2026-06-15T16:30:00Z');
      expect(result).not.toBeNull();
      expect(result.provider).toBe('nagad');
      expect(result.type).toBe('sent');
      expect(result.amount).toBe(3000);
      expect(result.balance).toBe(8500);
      expect(result.fee).toBe(0);
      expect(result.counterparty).toBe('Rahim');
      expect(result.trxId).toBe('NAG7A8B9C0D');
      expect(result.date).toBe('2026-06-15');
    });

    it('parses received money email', () => {
      const body = `You have received Tk 15,000.00 from Karim (01812345678).
Bal: Tk 23,500.00. TrxID: NAG1B2C3D4E`;
      const result = parseEmailAuto('Nagad Receive', body, 'no-reply@nagad.com.bd');
      expect(result).not.toBeNull();
      expect(result.type).toBe('received');
      expect(result.amount).toBe(15000);
      expect(result.counterparty).toBe('Karim');
    });

    it('parses cash-out email', () => {
      const body = `You have cashed out Tk 5,000.00. Fee: Tk 10.00. Bal: Tk 3,490.00. TrxID: NAG5E6F7G8H`;
      const result = parseEmailAuto('Nagad Cashout', body, 'no-reply@nagad.com.bd');
      expect(result).not.toBeNull();
      expect(result.type).toBe('cashout');
      expect(result.amount).toBe(5000);
      expect(result.fee).toBe(10);
    });

    it('returns null for unparseable text', () => {
      const result = parseEmailAuto('Nagad', 'No transaction info here', 'no-reply@nagad.com.bd');
      expect(result).toBeNull();
    });
  });

  describe('bKash email parsing', () => {
    const bkbSubject = 'bKash Payment Confirmation';
    const bkbBody = `You have sent Tk 2,500.00 to John (01712345678).
Fee: TK 0.00. Bal: TK 12,345.67. TrxID: 8A7B2C3D4E.
Date: 15 June 2026, 3:45 PM`;

    it('parses sent money email', () => {
      const result = parseEmailAuto(bkbSubject, bkbBody, 'no-reply@bkash.com', '2026-06-15T15:45:00Z');
      expect(result).not.toBeNull();
      expect(result.provider).toBe('bkash');
      expect(result.type).toBe('sent');
      expect(result.amount).toBe(2500);
      expect(result.balance).toBe(12345.67);
      expect(result.fee).toBe(0);
      expect(result.counterparty).toBe('John');
      expect(result.trxId).toBe('8A7B2C3D4E');
      expect(result.date).toBe('2026-06-15');
    });

    it('parses received money email', () => {
      const body = `You have received Tk 10,000.00 from Ahmed (01812345678).
Bal: TK 22,345.67. TrxID: 9B8C7D6E5F`;
      const result = parseEmailAuto('bKash Receive', body, 'no-reply@bkash.com');
      expect(result).not.toBeNull();
      expect(result.type).toBe('received');
      expect(result.amount).toBe(10000);
      expect(result.counterparty).toBe('Ahmed');
    });

    it('parses cash-out email', () => {
      const body = `You have cashed out Tk 5,000.00. Fee: TK 10.00. Bal: TK 7,335.67. TrxID: 1A2B3C4D5E`;
      const result = parseEmailAuto('bKash Cashout', body, 'no-reply@bkash.com');
      expect(result).not.toBeNull();
      expect(result.type).toBe('cashout');
      expect(result.amount).toBe(5000);
      expect(result.fee).toBe(10);
    });

    it('returns null for unparseable text', () => {
      const result = parseEmailAuto('bKash', 'No transaction info here', 'no-reply@bkash.com');
      expect(result).toBeNull();
    });
  });

  describe('EBL email parsing', () => {
    const eblSubject = 'EBL Debit Alert';
    const eblBody = `Dear Customer,
Your account ending in 1234 has been debited with Tk 5,000.00
on 15/06/2026 at STAR WARS.
Available balance: Tk 45,000.00
Reference: EBL123456`;

    it('parses debit alert email', () => {
      const result = parseEmailAuto(eblSubject, eblBody, 'alerts@ebl.com.pl', '2026-06-15');
      expect(result).not.toBeNull();
      expect(result.provider).toBe('ebl');
      expect(result.type).toBe('debit');
      expect(result.amount).toBe(5000);
      expect(result.balance).toBe(45000);
      expect(result.counterparty).toBe('STAR WARS');
      expect(result.ref).toBe('EBL123456');
      expect(result.account).toBe('****1234');
      expect(result.date).toBe('2026-06-15');
    });

    it('parses credit alert email', () => {
      const body = `Your account ending in 5678 has been credited with Tk 50,000.00
on 20/06/2026. Available balance: Tk 95,000.00. Reference: EBL789012`;
      const result = parseEmailAuto('EBL Credit Alert', body, 'alerts@ebl.com.pl');
      expect(result).not.toBeNull();
      expect(result.type).toBe('credit');
      expect(result.amount).toBe(50000);
    });

    it('returns null for unparseable text', () => {
      const result = parseEmailAuto('EBL', 'No transaction info', 'alerts@ebl.com.pl');
      expect(result).toBeNull();
    });

    it('detects EBL from "EBL Bank" sender', () => {
      expect(detectProvider('', 'noreply@eblbank.com')).toBe('ebl');
    });

    it('parses debit email with fallback amount pattern', () => {
      const body = `Dear Customer, Your account has been debited with 12,500.00 on 15/06/2026.
Balance: BDT 87,500.00. Reference: EBL999999`;
      const result = parseEmailAuto('EBL Debit Alert', body, 'alerts@ebl.com.pl');
      expect(result).not.toBeNull();
      expect(result.provider).toBe('ebl');
      expect(result.type).toBe('debit');
      expect(result.amount).toBe(12500);
      expect(result.balance).toBe(87500);
    });

    it('parses email with BDT prefix (no space)', () => {
      const body = `Your account ending in 9999 has been debited with BDT 3,200.00
on 10/06/2026 at AMAZON. Available balance: BDT 46,800.00. Reference: EBL111222`;
      const result = parseEmailAuto('EBL Debit Alert', body, 'alerts@ebl.com.pl');
      expect(result).not.toBeNull();
      expect(result.amount).toBe(3200);
      expect(result.balance).toBe(46800);
    });
  });
});
