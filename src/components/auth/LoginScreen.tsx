import React, { useState } from 'react';
import { Store, LogIn, UserPlus, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { account, Me } from '../../services/account';

interface LoginScreenProps {
  variant: 'shop' | 'admin';
  signupAllowed: boolean;
  /** Set when the API could not be reached (e.g. static-only hosting). */
  apiError?: string | null;
  onLoggedIn: (me: Me) => void;
  onDemo?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ variant, signupAllowed, apiError, onLoggedIn, onDemo }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me =
        mode === 'login'
          ? await account.login(email, password)
          : await account.signup({ email, password, shopName, ownerName });
      onLoggedIn(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login nahi ho paya');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm';

  return (
    <div className="min-h-screen bg-[#F2F8F5] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-br from-[#0B3D2E] to-[#1F7A5C] text-white p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#25D366] text-[#0B3D2E] mx-auto flex items-center justify-center mb-3">
            {variant === 'admin' ? <ShieldCheck className="w-7 h-7" /> : <Store className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-black tracking-tight">{variant === 'admin' ? 'Dukaan Saathi Admin' : 'Dukaan Saathi'}</h1>
          <p className="text-xs text-emerald-200 mt-1">
            {variant === 'admin' ? 'Vendors aur platform manage karein' : 'Bolo. Photo kheencho. Paisa wapas pao.'}
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-3">
          {apiError && (
            <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {apiError}
            </p>
          )}
          {mode === 'signup' && (
            <>
              <input className={input} required placeholder="Dukaan ka naam" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              <input className={input} placeholder="Owner ka naam" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </>
          )}
          <input className={input} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className={input}
            type="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? 'Password (kam se kam 8 characters)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-[#0B3D2E] hover:bg-[#124b39] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {busy ? 'Ruko...' : mode === 'login' ? 'Login' : 'Account banayein'}
          </button>

          {variant === 'shop' && signupAllowed && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="w-full text-xs font-bold text-[#1F7A5C] hover:underline"
            >
              {mode === 'login' ? 'Naya dukaan account banayein' : 'Pehle se account hai? Login karein'}
            </button>
          )}

          {variant === 'shop' && onDemo && (
            <button
              type="button"
              onClick={onDemo}
              className="w-full py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Bina login demo dekhein (data sirf is browser mein)
            </button>
          )}
          {variant === 'admin' && (
            <a href="/" className="block text-center text-xs font-bold text-[#1F7A5C] hover:underline">
              ← Dukaan app par jaayein
            </a>
          )}
        </form>
      </div>
    </div>
  );
};
