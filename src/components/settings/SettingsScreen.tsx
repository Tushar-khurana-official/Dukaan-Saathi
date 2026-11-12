import React, { useState } from 'react';
import {
  Store,
  User,
  CreditCard,
  Globe,
  Bell,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Shield,
  Info,
  Check,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { Language, ReminderTone, ShopProfile } from '../../types';
import { isValidUpiId } from '../../lib/reminders';
import { account } from '../../services/account';

interface SettingsScreenProps {
  profile: ShopProfile;
  onUpdateProfile: (p: ShopProfile) => void;
  onResetToDemo: () => void;
  onClearAllData: () => void;
  onExportData: () => object;
  onImportData: (data: unknown) => boolean;
  mode: 'shop' | 'demo';
  accountEmail?: string;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  profile,
  onUpdateProfile,
  onResetToDemo,
  onClearAllData,
  onExportData,
  onImportData,
  mode,
  accountEmail,
  onLogout,
}) => {
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await account.changePassword(pwCurrent, pwNext);
      setPwMsg({ ok: true, text: 'Password badal gaya' });
      setPwCurrent('');
      setPwNext('');
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Password nahi badla' });
    }
  };

  const [shopName, setShopName] = useState(profile.name);
  const [ownerName, setOwnerName] = useState(profile.owner);
  const [upiId, setUpiId] = useState(profile.upi_id);
  const [phone, setPhone] = useState(profile.owner_phone);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [upiError, setUpiError] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUpiId(upiId)) {
      setUpiError(true);
      return;
    }
    setUpiError(false);
    onUpdateProfile({
      ...profile,
      name: shopName.trim() || 'Hamari Dukaan',
      owner: ownerName.trim(),
      upi_id: upiId.trim(),
      owner_phone: phone.replace(/\D/g, '').slice(-10),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportJson = () => {
    const data = onExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Dukaan_Saathi_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (onImportData(json)) {
          alert('Data successfully imported!');
        } else {
          alert('Failed to import data: invalid format.');
        }
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0B3D2E] to-[#1F7A5C] text-white p-5 rounded-3xl shadow-sm">
        <h2 className="text-xl font-black tracking-tight">Dukaan Settings</h2>
        <p className="text-xs text-emerald-200">
          Shop profile, UPI payment handle, backup & device data control
        </p>
      </div>

      {/* Shop Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <Store className="w-4 h-4 text-[#1F7A5C]" />
          <span>Dukaan & Owner Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Dukaan Ka Naam (Shop Name)</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-[#123D31]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Owner Name</label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-[#123D31]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Shop UPI ID (Payment Links & QR)</label>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs font-mono text-[#0B3D2E]"
            />
            {upiError && <p className="text-[11px] text-rose-600 font-bold mt-1">UPI ID aisi dikhni chahiye: naam@bank</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Dukaan Phone / WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs text-[#123D31]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>Settings save ho gayi!</span>
            </span>
          ) : <span />}

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] hover:bg-[#124b39] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            Save Changes
          </button>
        </div>
      </form>

      {/* Reminder settings (per shop). Sending stays manual. */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#1F7A5C]" />
          <span>Reminder settings</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="block">
            <span className="font-bold text-gray-700 block mb-1">Message ki bhasha</span>
            <select
              value={profile.reminder_settings.language}
              onChange={(e) =>
                onUpdateProfile({ ...profile, reminder_settings: { ...profile.reminder_settings, language: e.target.value as Language } })
              }
              className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white"
            >
              <option value="hinglish">Hinglish</option>
              <option value="hindi">हिंदी</option>
              <option value="english">English</option>
            </select>
          </label>
          <label className="block">
            <span className="font-bold text-gray-700 block mb-1">Tone</span>
            <select
              value={profile.reminder_settings.default_tone}
              onChange={(e) =>
                onUpdateProfile({ ...profile, reminder_settings: { ...profile.reminder_settings, default_tone: e.target.value as ReminderTone } })
              }
              className="w-full p-2.5 rounded-xl border border-emerald-200 bg-white"
            >
              <option value="polite">Vinamra (polite)</option>
              <option value="friendly">Dostana (friendly)</option>
              <option value="firm">Sakht (firm)</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-[#5F7A6E]">
          Reminder WhatsApp mein khulta hai aur aap khud "send" dabate hain. Automatic bhejna WhatsApp Cloud API
          approval aur aapki manzoori ke baad hi aayega.
        </p>
      </div>

      {/* Account */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3 text-xs">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <User className="w-4 h-4 text-[#1F7A5C]" />
          <span>Account</span>
        </h3>
        {mode === 'demo' ? (
          <p className="text-[#5F7A6E]">
            Aap demo mein hain: data sirf is browser mein hai. Apni dukaan ke liye login karein ya account banayein.
          </p>
        ) : (
          <>
            <p className="text-[#5F7A6E]">
              Login: <span className="font-bold text-[#123D31]">{accountEmail}</span>. Khata server par save hota hai aur
              kisi bhi phone se login karke mil jayega.
            </p>
            <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="password" required placeholder="Purana password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className="p-2.5 rounded-xl border border-emerald-200" />
              <input type="password" required minLength={8} placeholder="Naya password (8+)" value={pwNext} onChange={(e) => setPwNext(e.target.value)} className="p-2.5 rounded-xl border border-emerald-200" />
              <button type="submit" className="py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold">Password badlein</button>
            </form>
            {pwMsg && <p className={`font-bold ${pwMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{pwMsg.text}</p>}
          </>
        )}
        <button onClick={onLogout} className="py-2 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-[#123D31]">
          {mode === 'demo' ? 'Demo band karein / Login' : 'Logout'}
        </button>
      </div>

      {/* Data Backup & Restore */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#1F7A5C]" />
          <span>Device Backup & Restore</span>
        </h3>

        <p className="text-xs text-[#5F7A6E] leading-relaxed">
          {mode === 'shop' ? 'Aapka khata server par save hota hai (upar "Saved" dikhega). Extra safety ke liye JSON backup bhi le sakte hain.' : 'Demo mein data sirf isi browser mein hai. Browser data saaf karne par mit jayega.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportJson}
            className="py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-emerald-50 text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <label className="py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-emerald-50 text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import JSON Backup</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            hidden={mode === 'shop'}
            onClick={() => {
              if (confirm('Kya aap demo data (12 grahak, 40 transactions, 25 SKUs) reload karna chahte hain?')) {
                onResetToDemo();
                alert('Demo data reloaded!');
              }
            }}
            className="py-2.5 px-3 rounded-xl bg-[#F5A623]/20 hover:bg-[#F5A623]/30 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-300"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo Data</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Saare grahak, khata aur reminders delete karke khali khata shuru karein? Pehle backup export kar lein.')) {
                onClearAllData();
              }
            }}
            className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Khali khata (sab delete)</span>
          </button>
        </div>
      </div>

      {/* About & Privacy Section */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#1F7A5C]" />
          <h3 className="text-sm font-extrabold text-[#123D31]">About Dukaan Saathi & Privacy (DPDP)</h3>
        </div>

        <p className="text-xs text-[#123D31] font-semibold leading-relaxed">
          "Kirana owners keep credit in paper notebooks and track stock in their heads. Dukaan Saathi turns voice and photos into a self-updating ledger and shelf guardian."
        </p>

        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-[11px] text-[#5F7A6E] space-y-1.5">
          <p>
            • <strong className="text-[#0B3D2E]">Data ka upyog:</strong> grahak ka data sirf udhaar ke hisaab aur payment reminder ke liye.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">Phone number:</strong> sirf grahak ki sehmati se, sehmati ki tareekh ke saath. Grahak ka data Khata screen se export ya delete karein.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">AI:</strong> voice note, shelf photo aur grahakon ke naam Google Gemini ko server ke through bheje jaate hain. Phone number aur balance nahi. Server logs mein naam/number nahi likhe jaate.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">WhatsApp:</strong> app ke andar ka chat ek simulation hai. Reminders asli WhatsApp mein khulte hain; bhejna aap dabate hain.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">Shelf scanner:</strong> khali jagah aur kam stock batata hai, sahi ginti nahi.
          </p>
          <p className="italic">Yeh product requirement hai, kanooni salah nahi. Asli pilot se pehle vakeel se review karwayein.</p>
        </div>
      </div>
    </div>
  );
};
