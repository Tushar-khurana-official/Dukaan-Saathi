/**
 * Customer statement links: /s/<token> shows ONE customer their own entries and balance, read-only,
 * without a login. The token holds the shop id, the customer id and a random key stored on the customer.
 * Turning the link off (or making a new one) changes the key, so old links stop working.
 */

export function newStatementKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(s: string): string {
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
}

export function makeStatementToken(shopId: string, customerId: string, key: string): string {
  return toBase64Url(`${shopId}|${customerId}|${key}`);
}

export function parseStatementToken(token: string): { shopId: string; customerId: string; key: string } | null {
  if (!/^[A-Za-z0-9_-]{20,400}$/.test(token)) return null;
  try {
    const [shopId, customerId, key] = fromBase64Url(token).split('|');
    if (!shopId || !customerId || !key || !/^[0-9a-f]{36}$/.test(key)) return null;
    return { shopId, customerId, key };
  } catch {
    return null;
  }
}

export function statementUrl(origin: string, shopId: string, customerId: string, key: string): string {
  return `${origin.replace(/\/$/, '')}/s/${makeStatementToken(shopId, customerId, key)}`;
}
