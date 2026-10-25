import { describe, expect, it } from 'vitest';

import { escapeField, toCsv } from './csv.js';

describe('CSV helpers', () => {
  it('writes a header row and every data row with CRLF endings', () => {
    const csv = toCsv(
      [
        {
          header: 'SKU',
          value: (row: { sku: string; qty: number }) => row.sku,
        },
        {
          header: 'Qty',
          value: (row: { sku: string; qty: number }) => row.qty,
        },
      ],
      [
        { sku: 'PEN-1', qty: 5 },
        { sku: 'PAP-2', qty: 0 },
      ],
    );

    expect(csv).toBe('SKU,Qty\r\nPEN-1,5\r\nPAP-2,0\r\n');
  });

  it('always emits headers even with no rows', () => {
    expect(toCsv([{ header: 'SKU', value: () => '' }], [])).toBe('SKU\r\n');
  });

  it('quotes values containing commas, quotes or newlines and doubles quotes', () => {
    expect(escapeField('Paper, A4')).toBe('"Paper, A4"');
    expect(escapeField('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeField('plain')).toBe('plain');
  });

  it('renders null/undefined as empty fields', () => {
    expect(escapeField(null)).toBe('');
    expect(escapeField(undefined)).toBe('');
  });

  it('serializes dates and numbers', () => {
    expect(escapeField(new Date('2026-10-25T12:00:00.000Z'))).toBe(
      '2026-10-25T12:00:00.000Z',
    );
    expect(escapeField(-5)).toBe('-5');
    expect(escapeField(BigInt(42))).toBe('42');
  });

  it('neutralizes spreadsheet formula injection in text fields only', () => {
    expect(escapeField('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeField('@import')).toBe("'@import");
    expect(escapeField('-5')).toBe("'-5");
    expect(escapeField(-5)).toBe('-5');
  });
});
