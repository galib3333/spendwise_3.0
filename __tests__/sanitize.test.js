import { describe, it, expect } from 'vitest';
import { escapeHTML } from '../js/sanitize.js';

describe('escapeHTML', () => {
  it('escapes angle brackets', () => {
    expect(escapeHTML('<script>alert("xss")</script>')).toContain('&lt;');
    expect(escapeHTML('<script>alert("xss")</script>')).not.toContain('<script>');
  });

  it('escapes ampersand', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('handles null by returning empty string', () => {
    expect(escapeHTML(null)).toBe('');
  });

  it('handles undefined by returning empty string', () => {
    expect(escapeHTML(undefined)).toBe('');
  });

  it('converts numbers to string', () => {
    expect(escapeHTML(123)).toBe('123');
  });

  it('passes plain text unchanged', () => {
    expect(escapeHTML('hello world')).toBe('hello world');
  });
});
