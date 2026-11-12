import React, { useState } from 'react';
import { ShieldCheck, Store, ArrowRight, Sparkles, CheckSquare, Square } from 'lucide-react';
import { Language, ShopProfile } from '../../types';
import { isValidUpiId } from '../../lib/reminders';

interface ConsentModalProps {
  isOpen: boolean;
  /** Only the no-login demo offers "demo data vs empty khata"; a real account keeps its own data. */
  allowDemoChoice: boolean;
  profile: ShopProfile;
  onComplete: (profile: ShopProfile) => void;
  /** Clear the demo ledger so a real shop starts with an empty khata. */
  onStartEmpty: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, allowDemoChoice, profile, onComplete, onStartEmpty }) => {
  const [shopName, setShopName] = useState(profile.name);
  const [ownerName, setOwnerName] = useState(profile.owner);
  const [upiId, setUpiId] = useState(profile.upi_id);
  const [language, setLanguage] = useState<Language>(profile.language);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [upiError, setUpiError] = useState(false);
  const [mode, setMode] = useState<'demo' | 'empty'>('demo');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAccepted) {
      setConsentError(true);
      return;
    }
    if (!isValidUpiId(upiId)) {
      setUpiError(true);
      return;
    }
    const startEmpty = allowDemoChoice && mode === 'empty';
    if (startEmpty) onStartEmpty();
    onComplete({
      ...profile,
      id: startEmpty ? `shop-${Date.now().toString(36)}` : profile.id,
      created_at: startEmpty ? new Date().toISOString() : profile.created_at,
      name: shopName.trim() || 'Hamari Dukaan',
      owner: ownerName.trim(),
      upi_id: upiId.trim(),
      language,
      reminder_settings: { ...profile.reminder_settings, language },
      consent_accepted: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-y-auto max-h-[calc(100dvh-2rem)] border border-emerald-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0B3D2E] to-[#1F7A5C] text-white px-6 py-4 text-center shrink-0">
          <h2 className="text-xl font-black tracking-tight flex items-center justify-center gap-2">
            <Store className="w-5 h-5 text-[#25D366]" /> Dukaan Saathi
          </h2>
          <p className="text-[11px] text-[#25D366] font-bold mt-0.5 tracking-wider uppercase">Bolo. Photo kheencho. Paisa wapas pao.</p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#123D31] mb-1">
              Dukaan Ka Naam (Shop Name)
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Gupta Kirana & General Store"
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#123D31] mb-1">
                Owner Name
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Gupta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#123D31] mb-1">
                Bhasha (Language)
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm bg-white"
              >
                <option value="hinglish">Hinglish</option>
                <option value="hindi">हिंदी (Hindi)</option>
                <option value="english">English</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#123D31] mb-1">
              Dukaan Ki UPI ID (Reminders aur QR ke liye)
            </label>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                setUpiError(false);
              }}
              placeholder="e.g. 9811234567@okaxis ya shop@upi"
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm font-mono"
            />
            <p className={`text-[11px] mt-1 ${upiError ? 'text-rose-600 font-bold' : 'text-[#5F7A6E]'}`}>
              {upiError ? 'UPI ID aisi dikhni chahiye: naam@bank' : 'Grahak ke WhatsApp reminder mein yeh UPI link jud jayega.'}
            </p>
          </div>

          {/* DPDP Privacy Consent Checkbox */}
          <div className="p-3.5 rounded-2xl bg-[#DDF3E7]/60 border border-emerald-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#1F7A5C] shrink-0 mt-0.5" />
              <div className="text-xs text-[#123D31]">
                <p className="font-bold mb-0.5">Data ka upyog</p>
                <p className="text-[#5F7A6E] leading-relaxed">
                  Grahak ka data sirf udhaar ke hisaab aur payment reminder ke liye. Phone number sirf grahak ki sehmati se.
                </p>
                <details className="mt-1 text-[#5F7A6E]">
                  <summary className="cursor-pointer font-bold text-[#1F7A5C]">Poori jaankari</summary>
                  <ul className="leading-relaxed list-disc pl-4 space-y-0.5 mt-1">
                    <li>Login karne par khata server par save hota hai aur sirf aapko dikhta hai. Admin ko sirf totals dikhte hain.</li>
                    <li>Voice/photo samajhne ke liye awaaz, photo aur grahakon ke naam AI (Google Gemini) ko jaate hain — phone number nahi.</li>
                    <li>Kisi bhi grahak ka data export ya delete kar sakte hain (Khata → grahak).</li>
                  </ul>
                </details>
              </div>
            </div>

            <label
              onClick={() => {
                setConsentAccepted(!consentAccepted);
                setConsentError(false);
              }}
              className="flex items-center gap-2 cursor-pointer pt-1"
            >
              {consentAccepted ? (
                <CheckSquare className="w-5 h-5 text-[#25D366] fill-[#0B3D2E]" />
              ) : (
                <Square className={`w-5 h-5 ${consentError ? 'text-rose-500' : 'text-emerald-700'}`} />
              )}
              <span className="text-xs font-bold text-[#123D31]">
                Main samajh gaya/gayi aur sehmat hoon
              </span>
            </label>
            {consentError && (
              <p className="text-[11px] font-bold text-rose-600">
                Aage badhne ke liye kripya checkbox tick karein.
              </p>
            )}
          </div>

          {/* Start with demo data or an empty khata (demo mode only) */}
          <div className={`grid grid-cols-2 gap-2 text-xs ${allowDemoChoice ? '' : 'hidden'}`}>
            <button
              type="button"
              onClick={() => setMode('demo')}
              className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
                mode === 'demo' ? 'bg-[#F5A623] border-[#F5A623] text-[#0B3D2E]' : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Demo data (12 grahak)
            </button>
            <button
              type="button"
              onClick={() => setMode('empty')}
              className={`p-2.5 rounded-xl border font-bold ${
                mode === 'empty' ? 'bg-[#0B3D2E] border-[#0B3D2E] text-white' : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              Khali khata
            </button>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-[#0B3D2E] hover:bg-[#124b39] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md"
            >
              <span>Shuru Karein</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
