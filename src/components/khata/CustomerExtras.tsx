/**
 * Extra tools in a customer's detail view:
 *  - Statement link: the customer sees their own entries and balance (fewer "maine to de diya tha" disputes).
 *  - WhatsApp receipts after each entry, only with the customer's consent.
 *  - Credit limit: the app suggests one from the repayment record; the owner decides.
 */
import React, { useMemo, useState } from 'react';
import { Link2, Copy, Check, Send, RefreshCw, Receipt, Gauge, Ban } from 'lucide-react';
import type { Customer, ShopProfile, Transaction } from '../../types';
import { formatPaise, paiseToUpiAmount, parseRupeeInput } from '../../lib/money';
import { newStatementKey, statementUrl } from '../../lib/statement';
import { buildStatementMessage, createWhatsAppShareUrl, createWhatsAppUrl } from '../../lib/reminders';
import { suggestCreditLimit } from '../../lib/customerInsights';

type Patch = Partial<Pick<Customer, 'receipts_opt_in' | 'statement_key' | 'credit_limit_paise'>>;

interface Props {
  customer: Customer;
  profile: ShopProfile;
  mode: 'shop' | 'demo';
  transactions: Transaction[]; // this customer's entries
  score: number;
  onPatch: (updates: Patch) => void;
}

export function customerStatementUrl(profile: ShopProfile, customer: Customer): string | null {
  return customer.statement_key ? statementUrl(window.location.origin, profile.id, customer.id, customer.statement_key) : null;
}

export const CustomerExtras: React.FC<Props> = ({ customer, profile, mode, transactions, score, onPatch }) => {
  const [copied, setCopied] = useState(false);
  const [limitInput, setLimitInput] = useState(
    customer.credit_limit_paise ? paiseToUpiAmount(customer.credit_limit_paise) : '',
  );
  const suggestion = useMemo(() => suggestCreditLimit(transactions, score), [transactions, score]);
  const url = customerStatementUrl(profile, customer);
  const hasPhone = Boolean(customer.phone && customer.consent_given_at);

  const share = () => {
    if (!url) return;
    const text = buildStatementMessage({ shopName: profile.name, url, language: profile.reminder_settings.language });
    const wa = (hasPhone && createWhatsAppUrl(customer.phone, text)) || createWhatsAppShareUrl(text);
    window.open(wa, '_blank', 'noopener');
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('Link copy karein:', url);
    }
  };

  const saveLimit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = limitInput.trim() ? parseRupeeInput(limitInput) : null;
    onPatch({ credit_limit_paise: p && p > 0 ? p : null });
  };

  const box = 'p-3 rounded-2xl border border-emerald-100 bg-white text-xs space-y-2';

  return (
    <div className="space-y-3">
      {/* Statement link */}
      <div className={box}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#123D31] flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5 text-[#1F7A5C]" /> Grahak ka khata link
          </span>
          {url && (
            <button
              onClick={() => {
                if (confirm('Link band karein? Grahak purana link nahi khol payega.')) onPatch({ statement_key: null });
              }}
              className="text-rose-600 font-bold hover:underline flex items-center gap-1"
            >
              <Ban className="w-3 h-3" /> Band karein
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-500">
          Grahak apni saari entries aur baaki khud dekh sakta hai (sirf dekhna, badalna nahi). "Maine to de diya tha" wale
          jhagde kam hote hain. Grahak se poochh kar hi bhejein.
        </p>
        {mode === 'demo' ? (
          <p className="text-[11px] font-bold text-amber-800">Yeh feature login karne par chalta hai (khata server par hona chahiye).</p>
        ) : url ? (
          <>
            <p className="font-mono text-[10px] break-all bg-gray-50 border border-gray-100 rounded-lg p-2">{url}</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={share} className="py-2 rounded-xl bg-[#25D366] text-[#0B3D2E] font-bold flex items-center justify-center gap-1">
                <Send className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <button onClick={copy} className="py-2 rounded-xl bg-gray-100 font-bold flex items-center justify-center gap-1">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Naya link banayein? Purana link band ho jayega.')) onPatch({ statement_key: newStatementKey() });
                }}
                className="py-2 rounded-xl bg-gray-100 font-bold flex items-center justify-center gap-1"
                title="Naya link (purana band)"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Naya
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => onPatch({ statement_key: newStatementKey() })}
            className="w-full py-2 rounded-xl bg-[#0B3D2E] text-white font-bold"
          >
            Link banayein
          </button>
        )}
      </div>

      {/* Receipts */}
      <div className={box}>
        <label className={`flex items-start gap-2 ${hasPhone ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            disabled={!hasPhone}
            checked={Boolean(customer.receipts_opt_in)}
            onChange={(e) => onPatch({ receipts_opt_in: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-bold text-[#123D31] flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-[#1F7A5C]" /> Har entry ke baad WhatsApp receipt
            </span>
            <span className="text-[11px] text-gray-500 block">
              {hasPhone
                ? 'Sirf tab tick karein jab grahak ne receipt lene ki haan kahi ho. Entry save hone par "Receipt bhejein" button aayega; bhejna aap dabayenge.'
                : 'Pehle grahak ki sehmati se phone number jodein.'}
            </span>
          </span>
        </label>
      </div>

      {/* Credit limit */}
      <div className={box}>
        <span className="font-bold text-[#123D31] flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5 text-[#1F7A5C]" /> Udhaar ki seema
        </span>
        {suggestion.limit_paise ? (
          <p className="text-[11px] text-gray-600">
            Sujhaav: <span className="font-black text-[#0B3D2E]">{formatPaise(suggestion.limit_paise)}</span> — {suggestion.reason}{' '}
            <span className="text-gray-400">Faisla aapka.</span>
          </p>
        ) : (
          <p className="text-[11px] text-gray-500">{suggestion.reason}</p>
        )}
        <form onSubmit={saveLimit} className="flex gap-2">
          <input
            inputMode="decimal"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            placeholder="Apni seema (₹), khali = koi seema nahi"
            className="flex-1 p-2 rounded-lg border border-emerald-200"
          />
          {suggestion.limit_paise && (
            <button type="button" onClick={() => setLimitInput(paiseToUpiAmount(suggestion.limit_paise!))} className="px-2 rounded-lg bg-gray-100 font-bold">
              Sujhaav lo
            </button>
          )}
          <button type="submit" className="px-3 rounded-lg bg-[#0B3D2E] text-white font-bold">Save</button>
        </form>
        {customer.credit_limit_paise ? (
          <p className="text-[11px] text-[#1F7A5C] font-bold">Abhi ki seema: {formatPaise(customer.credit_limit_paise)}. Isse upar udhaar par chetavni dikhegi.</p>
        ) : null}
      </div>
    </div>
  );
};
