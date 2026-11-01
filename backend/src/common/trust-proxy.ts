/** Minimal surface of an Express application used to configure proxy trust. */
export type TrustProxyTarget = {
  set(setting: string, value: unknown): unknown;
};

/**
 * Applies the `TRUST_PROXY` hop count to the underlying Express instance.
 *
 * Express treats `false` (and `0`) as "do not trust any proxy", so the default
 * of 0 keeps the socket address for `req.ip`. With 1, exactly one proxy hop is
 * trusted and the client address is read from `X-Forwarded-For` — which is what
 * a single hosting proxy (Render, Nginx, ...) needs so rate limits are keyed
 * per client instead of per proxy.
 */
export function applyTrustProxy(
  target: TrustProxyTarget,
  hops: number,
): void {
  target.set('trust proxy', hops > 0 ? hops : false);
}
