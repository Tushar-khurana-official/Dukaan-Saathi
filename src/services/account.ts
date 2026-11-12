/** Browser client for login, the shop's data sync and the admin API. Cookies carry the session. */
import type { LocalShopData } from '../lib/storage';

export interface PublicShop {
  id: string;
  email: string;
  name: string;
  owner: string;
  phone: string;
  upi_id: string;
  status: 'active' | 'suspended';
  plan: 'free' | 'basic' | 'pro';
  admin_notes: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
  stats: null | {
    customers: number;
    customers_with_phone: number;
    transactions: number;
    pending_paise: number;
    sales_30d_paise: number;
    credit_30d_paise: number;
    recovered_30d_paise: number;
    voice_entries: number;
    reminders_opened: number;
    shelf_scans: number;
    products_low_or_out: number;
    last_activity_at: string | null;
  };
}

export type Me = { role: 'admin' } | { role: 'shop'; shop: PublicShop } | { role: null; signupAllowed?: boolean };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Server se connect nahi ho paya. Internet check karein.', 0);
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // The server is not there (e.g. a static-only deployment returns HTML)
    throw new ApiError('Server (API) nahi mila. Deployment mein backend chalu karein.', res.status || 0);
  }
  if (!res.ok) throw new ApiError(String(json.error ?? `Error ${res.status}`), res.status);
  return json as T;
}

export const account = {
  me: () => call<Me>('GET', '/api/auth/me'),
  login: (email: string, password: string) => call<Me>('POST', '/api/auth/login', { email, password }),
  signup: (p: { email: string; password: string; shopName: string; ownerName: string }) => call<Me>('POST', '/api/auth/signup', p),
  logout: () => call<{ ok: boolean }>('POST', '/api/auth/logout'),
  loadData: () => call<{ shop: PublicShop; data: LocalShopData | null; updated_at: string | null }>('GET', '/api/shop/data'),
  saveData: (data: LocalShopData) => call<{ ok: boolean; saved_at: string }>('PUT', '/api/shop/data', { data }),
  changePassword: (current: string, next: string) => call<{ ok: boolean }>('POST', '/api/shop/password', { current, next }),
};

export interface AdminOverview {
  storage: 'postgres' | 'file';
  storage_persistent: boolean;
  shops_total: number;
  shops_active: number;
  shops_suspended: number;
  shops_active_7d: number;
  plans: { free: number; basic: number; pro: number };
  customers_total: number;
  transactions_total: number;
  voice_entries_total: number;
  reminders_opened_total: number;
  shelf_scans_total: number;
  pending_paise_total: number;
  sales_30d_paise_total: number;
  recovered_30d_paise_total: number;
}

export const adminApi = {
  overview: () => call<AdminOverview>('GET', '/api/admin/overview'),
  shops: () => call<{ shops: PublicShop[] }>('GET', '/api/admin/shops'),
  createShop: (p: { email: string; password: string; name: string; owner: string; phone: string; plan: string }) =>
    call<{ shop: PublicShop }>('POST', '/api/admin/shops', p),
  updateShop: (id: string, p: Partial<Pick<PublicShop, 'name' | 'owner' | 'phone' | 'email' | 'upi_id' | 'status' | 'plan' | 'admin_notes'>>) =>
    call<{ shop: PublicShop }>('PATCH', `/api/admin/shops/${encodeURIComponent(id)}`, p),
  resetPassword: (id: string, password: string) => call<{ ok: boolean }>('POST', `/api/admin/shops/${encodeURIComponent(id)}/password`, { password }),
  deleteShop: (id: string) => call<{ ok: boolean }>('DELETE', `/api/admin/shops/${encodeURIComponent(id)}`),
  usage: () => call<{ model: string; usage: Record<string, { gemini_calls: number; handled_without_ai: number; avg_input_tokens: number; avg_output_tokens: number; est_usd_per_call: number | null }> }>('GET', '/api/usage'),
};
