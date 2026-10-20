import React, { useState } from 'react';
import { ShieldCheck, Store, ArrowRight, Sparkles, CheckSquare, Square } from 'lucide-react';
import { Language, ShopProfile } from '../../types';

interface ConsentModalProps {
  isOpen: boolean;
  onComplete: (profile: ShopProfile) => void;
  onLoadDemoData: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onComplete,
  onLoadDemoData,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [shopName, setShopName] = useState('Gupta Kirana Store');
  const [ownerName, setOwnerName] = useState('Ramesh Gupta');
  const [upiId, setUpiId] = useState('guptakirana@okaxis');
  const [language, setLanguage] = useState<Language>('hinglish');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAccepted) {
      setConsentError(true);
      return;
    }

    onComplete({
      name: shopName.trim() || 'Hamari Dukaan',
      owner: ownerName.trim() || 'Shopkeeper',
      upi_id: upiId.trim() || 'shop@upi',
      language,
      consent_accepted: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col">
        {/* Header Splash */}
        <div className="bg-gradient-to-br from-[#0B3D2E] to-[#1F7A5C] text-white p-6 text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-[#25D366] text-[#0B3D2E] mx-auto flex items-center justify-center shadow-lg mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Dukaan Saathi</h2>
          <p className="text-xs text-[#25D366] font-bold mt-1 tracking-wider uppercase">
            Bolo. Photo kheencho. Paisa wapas pao.
          </p>
          <p className="text-xs text-emerald-200 mt-2 max-w-xs mx-auto">
            Aapka digital WhatsApp-style kirana saathi. Notebook chhodhein, voice aur AI apnayein.
          </p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. 9811234567@okaxis ya shop@upi"
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm font-mono"
            />
            <p className="text-[11px] text-[#5F7A6E] mt-1">
              Grahak ke WhatsApp reminder mein yeh UPI link jud jayega.
            </p>
          </div>

          {/* DPDP Privacy Consent Checkbox */}
          <div className="p-3.5 rounded-2xl bg-[#DDF3E7]/60 border border-emerald-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#1F7A5C] shrink-0 mt-0.5" />
              <div className="text-xs text-[#123D31]">
                <p className="font-bold mb-0.5">Suraksha aur Data Privacy (DPDP Notice):</p>
                <p className="text-[#5F7A6E] leading-relaxed">
                  Aapke grahakon ke naam, mobile number aur bahi-khata balances sirf aapke is mobile/device par safe hain.
                  Koi bhi customer private data kisi third-party ad network ko nahi bheja jata.
                </p>
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
                Main privacy sharton se sehmat hoon (I accept)
              </span>
            </label>
            {consentError && (
              <p className="text-[11px] font-bold text-rose-600">
                Aage badhne ke liye kripya checkbox tick karein.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-[#0B3D2E] hover:bg-[#124b39] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
            >
              <span>Shuru Karein (Get Started)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onLoadDemoData}
              className="w-full py-3 px-4 rounded-xl bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Demo Data Ke Saath Try Karo (Instant 12 Customers)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
