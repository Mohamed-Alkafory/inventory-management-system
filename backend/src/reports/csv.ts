/** One CSV column: header text plus an accessor for the row value. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * RFC-4180 CSV: comma separated, CRLF line endings, every field quoted when
 * it contains a comma, quote or line break (quotes doubled). Text fields
 * starting with a spreadsheet formula character are prefixed with `'` to
 * prevent CSV/formula injection (numbers are left untouched).
 */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => escapeField(column.header)).join(',');
  const lines = [header];

  for (const row of rows) {
    lines.push(
      columns.map((column) => escapeField(column.value(row))).join(','),
    );
  }

  return `${lines.join('\r\n')}\r\n`;
}

/** Escape one field. Exported for the unit tests. */
export function escapeField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = typeof value === 'string' ? value : String(value);

  // Formula injection guard — only for text, so negative numbers stay numeric.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}
