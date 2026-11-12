/**
 * Public statement page (/s/<token>): a customer sees their own entries and balance at one shop.
 * Read-only, no login. Shows a UPI pay button when something is due.
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowDownLeft, ArrowUpRight, Store, AlertTriangle } from 'lucide-react';
import { formatPaise } from '../../lib/money';
import { createUpiUri, isValidUpiId } from '../../lib/reminders';

interface Statement {
  shop: { name: string; upi_id: string };
  customer: { name: string };
  balance_paise: number;
  entries: Array<{ type: 'credit' | 'payment'; amount_paise: number; note: string; date: string }>;
  total_entries: number;
  generated_at: string;
}

export const StatementPage: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    fetch(`/api/statement/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Khata khul nahi paya');
        return j as Statement;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Khata khul nahi paya'));
  }, [token]);

  const upi = data && data.balance_paise > 0 && isValidUpiId(data.shop.upi_id)
    ? createUpiUri(data.shop.upi_id, data.shop.name, data.balance_paise)
    : null;

  useEffect(() => {
    if (upi) QRCode.toDataURL(upi, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [upi]);

  return (
    <div className="min-h-screen bg-[#F2F8F5] text-[#123D31] flex justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <header className="bg-[#0B3D2E] text-white rounded-3xl p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#25D366] text-[#0B3D2E] flex items-center justify-center shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-lg truncate">{data?.shop.name ?? 'Dukaan ka khata'}</h1>
            <p className="text-xs text-emerald-200">Aapka khata • sirf dekhne ke liye</p>
          </div>
        </header>

        {error && (
          <p className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </p>
        )}
        {!data && !error && <p className="text-center text-sm font-bold text-[#1F7A5C] py-10">Khata khul raha hai...</p>}

        {data && (
          <>
            <section className="bg-white rounded-3xl p-5 border border-emerald-100 text-center">
              <p className="text-xs text-[#5F7A6E]">Namaste {data.customer.name} ji, aapka kul baaki</p>
              <p className={`text-4xl font-black mt-1 ${data.balance_paise > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {formatPaise(Math.max(0, data.balance_paise))}
              </p>
              {data.balance_paise < 0 && (
                <p className="text-xs text-emerald-700 font-bold mt-1">Aapka {formatPaise(-data.balance_paise)} advance jama hai</p>
              )}
              {data.balance_paise <= 0 && <p className="text-sm font-bold text-emerald-700 mt-1">Koi baaki nahi 🎉</p>}
              {upi && (
                <div className="mt-4 space-y-3">
                  <a
                    href={upi}
                    className="block w-full py-3 rounded-xl bg-[#25D366] text-[#0B3D2E] font-black text-sm"
                  >
                    UPI se {formatPaise(data.balance_paise)} chukayein
                  </a>
                  {qr && <img src={qr} alt="UPI QR" className="w-44 h-44 mx-auto" />}
                  <p className="text-[11px] text-gray-500">
                    Payment ke baad dukaan khate mein jama likhegi. Yeh page payment ki pushti nahi karta.
                  </p>
                </div>
              )}
            </section>

            <section className="bg-white rounded-3xl p-5 border border-emerald-100">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3">
                Saari entries ({data.total_entries})
              </h2>
              {data.entries.length === 0 && <p className="text-xs text-gray-400 italic">Abhi koi entry nahi.</p>}
              <ul className="space-y-2">
                {data.entries.map((e, i) => {
                  const credit = e.type === 'credit';
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${credit ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {credit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold truncate">{credit ? 'Udhaar' : 'Jama'}{e.note ? ` • ${e.note}` : ''}</p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(e.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <span className={`font-black shrink-0 ${credit ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {credit ? '+' : '−'}{formatPaise(e.amount_paise)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {data.total_entries > data.entries.length && (
                <p className="text-[11px] text-gray-500 mt-2">Sirf nayi {data.entries.length} entries dikh rahi hain.</p>
              )}
            </section>

            <p className="text-[10px] text-center text-gray-400">
              Koi entry galat lage to dukaan se baat karein. Updated {new Date(data.generated_at).toLocaleString('en-IN')} • Dukaan Saathi
            </p>
          </>
        )}
      </div>
    </div>
  );
};
