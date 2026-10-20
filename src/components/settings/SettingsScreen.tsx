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
import { Language, ShopProfile } from '../../types';

interface SettingsScreenProps {
  profile: ShopProfile;
  onUpdateProfile: (p: ShopProfile) => void;
  onResetToDemo: () => void;
  onExportData: () => any;
  onImportData: (data: any) => boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  profile,
  onUpdateProfile,
  onResetToDemo,
  onExportData,
  onImportData,
}) => {
  const [shopName, setShopName] = useState(profile.name);
  const [ownerName, setOwnerName] = useState(profile.owner);
  const [upiId, setUpiId] = useState(profile.upi_id);
  const [phone, setPhone] = useState(profile.phone || '9811234567');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Toggles for UI-only notification preferences
  const [smsReminder, setSmsReminder] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      name: shopName.trim() || 'Hamari Dukaan',
      owner: ownerName.trim() || 'Owner',
      upi_id: upiId.trim() || 'shop@upi',
      phone: phone.trim(),
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

      {/* Notifications & Sound (UI Toggles) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#1F7A5C]" />
          <span>Preferences & Sound</span>
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-gray-100 text-xs">
          <div>
            <span className="font-bold text-[#123D31] block">Automatic WhatsApp Pre-fill</span>
            <span className="text-[#5F7A6E]">Open wa.me link directly with UPI deep link</span>
          </div>
          <input
            type="checkbox"
            checked={smsReminder}
            onChange={(e) => setSmsReminder(e.target.checked)}
            className="w-4 h-4 text-[#25D366] rounded"
          />
        </div>

        <div className="flex items-center justify-between py-2 text-xs">
          <div>
            <span className="font-bold text-[#123D31] block">Voice Audio Waveform Animations</span>
            <span className="text-[#5F7A6E]">Live audio feedback while recording</span>
          </div>
          <input
            type="checkbox"
            checked={soundEffects}
            onChange={(e) => setSoundEffects(e.target.checked)}
            className="w-4 h-4 text-[#25D366] rounded"
          />
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
        <h3 className="text-sm font-extrabold text-[#0B3D2E] flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#1F7A5C]" />
          <span>Device Backup & Restore</span>
        </h3>

        <p className="text-xs text-[#5F7A6E] leading-relaxed">
          Aapka saara data aapke browser ke LocalStorage mein surakshit hai. Phone badalne ya backup lene ke liye export karein.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            • <strong className="text-[#0B3D2E]">Simulated WhatsApp vs Real:</strong> Sending messages triggers authentic <code>wa.me</code> deep links with prefilled text and UPI links. Dukaan Saathi does not silently transmit data without shopkeeper review.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">Visual Scanner Limits:</strong> The AI flags shelf gaps and low stock relative to shelf facing, not exact unit counts.
          </p>
          <p>
            • <strong className="text-[#0B3D2E]">DPDP Compliance:</strong> All records are stored strictly on this client device.
          </p>
        </div>
      </div>
    </div>
  );
};
