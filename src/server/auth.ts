/**
 * Email + password login for vendors (shops) and one platform admin.
 * - Passwords are stored as scrypt hashes, never in plain text.
 * - The admin login comes from ADMIN_EMAIL / ADMIN_PASSWORD environment variables, never from code.
 * - Sessions are HMAC-signed tokens in an httpOnly cookie.
 */
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type Role = 'admin' | 'shop';
export interface Session {
  role: Role;
  sub: string; // shop id, or "admin"
  exp: number; // unix seconds
}
export type AuthedRequest = Request & { session?: Session };

const COOKIE = 'ds_session';
const MAX_AGE_S = 30 * 24 * 3600;

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return Buffer.from(s);
  // Fallback so serverless instances agree without extra setup. Set SESSION_SECRET in production.
  const basis = `${process.env.ADMIN_EMAIL ?? ''}|${process.env.ADMIN_PASSWORD ?? ''}|${process.env.DATABASE_URL ?? ''}|dukaan-saathi`;
  return crypto.createHash('sha256').update(basis).digest();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isAdminLogin(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  return safeEqual(email.trim().toLowerCase(), adminEmail) && safeEqual(password, adminPassword);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

/** Password rule for vendor accounts. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Password kam se kam 8 characters ka ho';
  if (password.length > 200) return 'Password bahut lamba hai';
  return null;
}

export function signSession(s: Omit<Session, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (s.exp < Date.now() / 1000 || (s.role !== 'admin' && s.role !== 'shop')) return null;
    return s;
  } catch {
    return null;
  }
}

function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function getSession(req: Request): Session | null {
  return readSession(cookieValue(req, COOKIE));
}

export function setSessionCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`);
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export function requireRole(role: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const s = getSession(req);
    if (!s || s.role !== role) return res.status(401).json({ error: 'Login required' });
    req.session = s;
    next();
  };
}

/** Any logged-in user. Keeps the AI endpoints (paid per call) from being used by strangers. */
export function requireLogin(req: AuthedRequest, res: Response, next: NextFunction) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Login required' });
  req.session = s;
  next();
}

/** Small in-memory limiter for login attempts (per instance; slows down password guessing). */
const attempts = new Map<string, { count: number; until: number }>();
export function loginRateLimited(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { count: 1, until: now + 15 * 60_000 });
    return false;
  }
  a.count++;
  return a.count > 10;
}
export function resetLoginAttempts(key: string) {
  attempts.delete(key);
}
