/**
 * Platform admin dashboard (/admin). Same backend as the shop app.
 *
 * The admin manages vendor accounts (create, edit, plan, suspend, reset password, delete) and sees
 * shop-level totals. By design (spec, DPDP section) it never shows a shop's customer names, phone numbers
 * or per-customer balances.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  LogOut,
  Store,
  Users,
  BookOpen,
  Mic,
  BellRing,
  Camera,
  Wallet,
  ShoppingCart,
  TrendingDown,
  Plus,
  Search,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  X,
  Cpu,
} from 'lucide-react';
import { adminApi, AdminOverview, PublicShop } from '../services/account';
import { formatPaise } from '../lib/money';

type Usage = Awaited<ReturnType<typeof adminApi.usage>>;

function since(iso: string | null | undefined): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Aaj';
  if (days === 1) return 'Kal';
  return `${days} din pehle`;
}

const inputCls = 'w-full p-2.5 rounded-xl border border-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]';

export const AdminApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [editing, setEditing] = useState<PublicShop | 'new' | null>(null);
  const [resetting, setResetting] = useState<PublicShop | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s, u] = await Promise.all([adminApi.overview(), adminApi.shops(), adminApi.usage().catch(() => null)]);
      setOverview(o);
      setShops(s.shops);
      setUsage(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load nahi hua');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shops.filter(
      (s) =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (!q || s.name.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q) || s.email.includes(q) || s.phone.includes(q)),
    );
  }, [shops, query, statusFilter]);

  const toggleStatus = async (s: PublicShop) => {
    const next = s.status === 'active' ? 'suspended' : 'active';
    if (next === 'suspended' && !confirm(`${s.name} ko suspend karein? Vendor login nahi kar payega.`)) return;
    try {
      await adminApi.updateShop(s.id, { status: next });
      flash(next === 'suspended' ? 'Vendor suspend ho gaya' : 'Vendor active ho gaya');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const remove = async (s: PublicShop) => {
    const typed = prompt(`${s.name} aur uska saara khata hamesha ke liye delete hoga. Confirm karne ke liye vendor ka email likhein:`);
    if (typed?.trim().toLowerCase() !== s.email) return;
    try {
      await adminApi.deleteShop(s.id);
      flash('Vendor delete ho gaya');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const tile = (label: string, value: React.ReactNode, icon: React.ReactNode, sub?: string) => (
    <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-[#5F7A6E]">{label}</span>
        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F7A5C] flex items-center justify-center">{icon}</span>
      </div>
      <div className="text-xl font-black text-[#0B3D2E]">{value}</div>
      {sub && <p className="text-[11px] text-[#5F7A6E] mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F8F5] text-[#123D31]">
      <header className="sticky top-0 z-30 bg-[#0B3D2E] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] text-[#0B3D2E] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold">Dukaan Saathi Admin</h1>
              <p className="text-xs text-emerald-200">Vendors aur platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-2 rounded-lg hover:bg-white/10" title="Refresh">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold">{error}</p>}

        {overview && !overview.storage_persistent && (
          <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Database set nahi hai: data temporary storage mein hai aur server restart par mit sakta hai. Vercel par
            DATABASE_URL (Postgres, jaise Neon) set karein.
          </p>
        )}

        {overview && (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {tile('Vendors', overview.shops_total, <Store className="w-4 h-4" />, `${overview.shops_active} active • ${overview.shops_suspended} suspended`)}
            {tile('Active (7 din)', overview.shops_active_7d, <CheckCircle2 className="w-4 h-4" />, 'Is hafte entry ki')}
            {tile('Grahak (kul)', overview.customers_total, <Users className="w-4 h-4" />, 'Sab dukaanon mein')}
            {tile('Entries (kul)', overview.transactions_total, <BookOpen className="w-4 h-4" />, `${overview.voice_entries_total} voice se`)}
            {tile('Reminders khole', overview.reminders_opened_total, <BellRing className="w-4 h-4" />)}
            {tile('Shelf photos', overview.shelf_scans_total, <Camera className="w-4 h-4" />)}
            {tile('Udhaar baaki (kul)', formatPaise(overview.pending_paise_total), <Wallet className="w-4 h-4" />)}
            {tile('Bikri (30 din)', formatPaise(overview.sales_30d_paise_total), <ShoppingCart className="w-4 h-4" />)}
            {tile('Vasooli (30 din)', formatPaise(overview.recovered_30d_paise_total), <TrendingDown className="w-4 h-4" />)}
            {tile('Plans', `${overview.plans.free} / ${overview.plans.basic} / ${overview.plans.pro}`, <Store className="w-4 h-4" />, 'free / basic / pro')}
            {tile('Storage', overview.storage === 'postgres' ? 'Postgres' : 'File', <Cpu className="w-4 h-4" />, overview.storage_persistent ? 'Permanent' : 'Temporary')}
            {usage &&
              tile(
                'AI calls',
                Object.values(usage.usage).reduce((a, u) => a + u.gemini_calls, 0),
                <Mic className="w-4 h-4" />,
                `${Object.values(usage.usage).reduce((a, u) => a + u.handled_without_ai, 0)} bina AI • server start se`,
              )}
          </section>
        )}

        {usage && (
          <section className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-xs">
            <h2 className="text-sm font-extrabold mb-1">AI kharcha (Gemini, {usage.model})</h2>
            <p className="text-[11px] text-[#5F7A6E] mb-3">Sirf is server instance ke start se. Cost dikhane ke liye price env vars set karein.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[#5F7A6E]">
                  <tr>
                    <th className="py-1.5 pr-3">Type</th>
                    <th className="py-1.5 pr-3">Gemini calls</th>
                    <th className="py-1.5 pr-3">Bina AI</th>
                    <th className="py-1.5 pr-3">Avg input tokens</th>
                    <th className="py-1.5 pr-3">Avg output tokens</th>
                    <th className="py-1.5">Est. $/call</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.usage).map(([k, u]) => (
                    <tr key={k} className="border-t border-gray-100">
                      <td className="py-1.5 pr-3 font-bold">{k.replace('_', ' ')}</td>
                      <td className="py-1.5 pr-3">{u.gemini_calls}</td>
                      <td className="py-1.5 pr-3">{u.handled_without_ai}</td>
                      <td className="py-1.5 pr-3">{u.avg_input_tokens}</td>
                      <td className="py-1.5 pr-3">{u.avg_output_tokens}</td>
                      <td className="py-1.5">{u.est_usd_per_call ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Vendors ({filtered.length})</h2>
              <p className="text-[11px] text-[#5F7A6E]">
                Sirf dukaan-level totals. Grahakon ke naam, number aur alag-alag balance admin ko nahi dikhte (DPDP).
              </p>
            </div>
            <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold w-fit">
              <Plus className="w-4 h-4" /> Naya vendor
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Dukaan, owner, email ya phone" className={`${inputCls} pl-9`} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={`${inputCls} sm:w-44 bg-white`}>
              <option value="all">Sab</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="text-left text-[#5F7A6E] border-b border-gray-100">
                <tr>
                  <th className="py-2 pr-3">Dukaan</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Grahak</th>
                  <th className="py-2 pr-3">Entries</th>
                  <th className="py-2 pr-3">Udhaar baaki</th>
                  <th className="py-2 pr-3">Bikri 30d</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-extrabold text-[#123D31]">{s.name}</p>
                      <p className="text-[#5F7A6E]">{s.owner || '—'}{s.phone ? ` • ${s.phone}` : ''}</p>
                      {s.admin_notes && <p className="text-[10px] text-amber-800 mt-0.5">📝 {s.admin_notes}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{s.email}</td>
                    <td className="py-2.5 pr-3 uppercase font-bold">{s.plan}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                        {s.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{s.stats?.customers ?? 0}</td>
                    <td className="py-2.5 pr-3">{s.stats?.transactions ?? 0}</td>
                    <td className="py-2.5 pr-3 font-bold text-rose-600">{formatPaise(s.stats?.pending_paise ?? 0)}</td>
                    <td className="py-2.5 pr-3">{formatPaise(s.stats?.sales_30d_paise ?? 0)}</td>
                    <td className="py-2.5 pr-3">{since(s.stats?.last_activity_at ?? s.last_sync_at)}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(s)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#1F7A5C]" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setResetting(s)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#1F7A5C]" title="Password reset">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleStatus(s)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700" title={s.status === 'active' ? 'Suspend' : 'Activate'}>
                          {s.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      {shops.length === 0 ? 'Abhi koi vendor nahi. "Naya vendor" se banayein ya vendor khud signup kare.' : 'Koi vendor nahi mila'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {editing && (
        <VendorModal
          shop={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            flash(msg);
            refresh();
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          shop={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null);
            flash('Password badal diya');
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0B3D2E] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-sm text-[#0B3D2E]">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const VendorModal: React.FC<{ shop: PublicShop | null; onClose: () => void; onSaved: (msg: string) => void }> = ({ shop, onClose, onSaved }) => {
  const [name, setName] = useState(shop?.name ?? '');
  const [owner, setOwner] = useState(shop?.owner ?? '');
  const [email, setEmail] = useState(shop?.email ?? '');
  const [phone, setPhone] = useState(shop?.phone ?? '');
  const [upi, setUpi] = useState(shop?.upi_id ?? '');
  const [plan, setPlan] = useState<PublicShop['plan']>(shop?.plan ?? 'free');
  const [status, setStatus] = useState<PublicShop['status']>(shop?.status ?? 'active');
  const [notes, setNotes] = useState(shop?.admin_notes ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (shop) {
        await adminApi.updateShop(shop.id, { name, owner, email, phone, upi_id: upi, plan, status, admin_notes: notes });
        onSaved('Vendor update ho gaya');
      } else {
        await adminApi.createShop({ name, owner, email, phone, plan, password });
        onSaved('Naya vendor ban gaya');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save nahi hua');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={shop ? `Edit: ${shop.name}` : 'Naya vendor'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2.5 text-xs">
        <label className="block font-bold">Dukaan ka naam<input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
        <label className="block font-bold">Owner<input value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls} /></label>
        <label className="block font-bold">Login email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></label>
        {!shop && (
          <label className="block font-bold">
            Password (8+)
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
        )}
        <label className="block font-bold">Dukaan phone<input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></label>
        {shop && <label className="block font-bold">UPI ID<input value={upi} onChange={(e) => setUpi(e.target.value)} className={inputCls} /></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="block font-bold">
            Plan
            <select value={plan} onChange={(e) => setPlan(e.target.value as PublicShop['plan'])} className={`${inputCls} bg-white`}>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          {shop && (
            <label className="block font-bold">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as PublicShop['status'])} className={`${inputCls} bg-white`}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          )}
        </div>
        {shop && (
          <label className="block font-bold">
            Admin notes (vendor ko nahi dikhte)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </label>
        )}
        {error && <p className="font-bold text-rose-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold disabled:opacity-50">
          {busy ? 'Save ho raha hai...' : 'Save'}
        </button>
      </form>
    </Modal>
  );
};

const ResetPasswordModal: React.FC<{ shop: PublicShop; onClose: () => void; onDone: () => void }> = ({ shop, onClose, onDone }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.resetPassword(shop.id, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };
  return (
    <Modal title={`Password reset: ${shop.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2.5 text-xs">
        <p className="text-[#5F7A6E]">Naya password vendor ko khud batayein (WhatsApp/call). Purana password kaam nahi karega.</p>
        <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Naya password (8+)" className={inputCls} />
        {error && <p className="font-bold text-rose-600">{error}</p>}
        <button type="submit" className="w-full py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold">Password set karein</button>
      </form>
    </Modal>
  );
};
