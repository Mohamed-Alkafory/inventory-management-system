import { parseCorsOrigins } from './cors-origins.js';

describe('parseCorsOrigins', () => {
  it('accepts a single origin', () => {
    expect(parseCorsOrigins('https://app.example.com')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(
      parseCorsOrigins(
        ' https://app.example.com , http://localhost:5173 ,https://admin.example.com ',
      ),
    ).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
      'https://admin.example.com',
    ]);
  });

  it('removes trailing slashes and deduplicates after normalisation', () => {
    expect(
      parseCorsOrigins(
        'https://app.example.com/,https://app.example.com,https://app.example.com//',
      ),
    ).toEqual(['https://app.example.com']);
  });

  it('drops empty entries', () => {
    expect(parseCorsOrigins(',, https://app.example.com , ,')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('rejects the wildcard because credentialed requests are enabled', () => {
    expect(() => parseCorsOrigins('*')).toThrow(/"\*"/);
    expect(() => parseCorsOrigins('https://app.example.com,*')).toThrow(
      /must not contain "\*"/,
    );
  });

  it.each([
    ['not a url', 'not-a-url'],
    ['a non-http protocol', 'ftp://app.example.com'],
    ['a path', 'https://app.example.com/dashboard'],
    ['a query string', 'https://app.example.com?x=1'],
    ['a fragment', 'https://app.example.com#top'],
    ['embedded credentials', 'https://user:pass@app.example.com'],
  ])('rejects %s', (_label, value) => {
    expect(() => parseCorsOrigins(value)).toThrow();
  });

  it('rejects an empty list', () => {
    expect(() => parseCorsOrigins(' , , ')).toThrow(/at least one origin/);
  });

  it('rejects a non-string value', () => {
    expect(() => parseCorsOrigins(['https://app.example.com'])).toThrow(
      /comma-separated string/,
    );
  });
});
