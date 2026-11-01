/**
 * Parses the `CORS_ORIGIN` environment variable into the explicit origin list
 * handed to Nest's CORS middleware.
 *
 * Rules:
 * - comma-separated, so one deployment can allow several front-end hosts;
 * - surrounding whitespace is ignored and empty entries are dropped;
 * - entries are normalised to their URL origin, which removes trailing slashes
 *   (and default ports) so `https://app.example.com/` matches
 *   `https://app.example.com`;
 * - duplicates (after normalisation) are collapsed;
 * - `*` is rejected because the API sends credentials, and a wildcard origin
 *   is illegal in that mode;
 * - non-HTTP(S) URLs, URLs with a path/query/fragment, and URLs carrying
 *   credentials are rejected so a typo fails at startup instead of silently
 *   allowing nothing.
 *
 * Error messages never echo the value so a misconfigured secret-like string
 * cannot end up in the logs.
 */
export function parseCorsOrigins(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    throw new Error('CORS_ORIGIN must be a comma-separated string of origins');
  }

  const origins: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw.split(',')) {
    const value = entry.trim();
    if (!value) continue;

    if (value === '*') {
      throw new Error(
        'CORS_ORIGIN must not contain "*" because credentialed requests are enabled',
      );
    }

    // Trailing slashes are not part of an origin; strip them before parsing so
    // `https://app.example.com//` normalises the same way as `.../`.
    const withoutTrailingSlashes = value.replace(/\/+$/, '');

    let url: URL;
    try {
      url = new URL(withoutTrailingSlashes);
    } catch {
      throw new Error('CORS_ORIGIN contains an invalid URL entry');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('CORS_ORIGIN entries must use http or https');
    }

    if (url.username || url.password) {
      throw new Error('CORS_ORIGIN entries must not contain credentials');
    }

    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error(
        'CORS_ORIGIN entries must be origins without a path, query or fragment',
      );
    }

    const origin = url.origin;
    if (!seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }

  return origins;
}
