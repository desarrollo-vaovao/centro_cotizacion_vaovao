import { describe, it, expect } from 'vitest';
import { cn, fmtMoney, fmtDate } from './utils.js';

describe('cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('fmtMoney', () => {
  it('formats GTQ with the Q symbol and two decimals', () => {
    expect(fmtMoney(3100)).toBe('Q3,100.00');
  });

  it('formats USD with the $ symbol', () => {
    expect(fmtMoney(50, 'USD')).toBe('$50.00');
  });

  it('treats a non-numeric value as zero', () => {
    expect(fmtMoney(undefined)).toBe('Q0.00');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date in es-GT style', () => {
    expect(fmtDate('2026-07-10')).toBe('10 jul 2026');
  });

  it('returns an em dash for a missing date', () => {
    expect(fmtDate(null)).toBe('—');
  });
});
