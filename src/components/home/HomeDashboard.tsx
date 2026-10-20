import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  Users,
  Mic,
  Camera,
  BellRing,
  UserPlus,
  RefreshCw,
  Share2,
  Sparkles,
  ArrowUpRight,
  Clock,
  PackageX,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Customer, Language, Product, ShelfScan, ShopProfile } from '../../types';
import { formatINR, formatRelativeDate } from '../../utils/formatters';
import { translations } from '../../utils/translations';
import { getDailySummary } from '../../services/api';
import { createWhatsAppUrl } from '../../utils/whatsapp';

interface HomeDashboardProps {
  profile: ShopProfile;
  language: Language;
  totalUdhaar: number;
  todayRecovery: number;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  overdueCustomers: Customer[];
  topDebtors: (Customer & { balance: number })[];
  cashFlow7Days: Array<{ date: string; displayDate: string; credit: number; payment: number }>;
  scans: ShelfScan[];
  onNavigate: (tab: any) => void;
  onOpenQuickVoice: () => void;
  onOpenAddCustomer: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  language,
  totalUdhaar,
  todayRecovery,
  lowStockProducts,
  outOfStockProducts,
  overdueCustomers,
  topDebtors,
  cashFlow7Days,
  scans,
  onNavigate,
  onOpenQuickVoice,
  onOpenAddCustomer,
}) => {
  const t = translations[language].home;

  const [summaryData, setSummaryData] = useState<{
    lines: string[];
    tip: string;
    isDemo?: boolean;
  }>({
    lines: [
      `Kul udhaar baaki: ${formatINR(totalUdhaar)}, aaj ${formatINR(todayRecovery)} ki vasooli hui.`,
      `${lowStockProducts.length + outOfStockProducts.length} zaroori items shelf par low stock ya out of stock hain.`,
      `Sharma ji aur Sunita Verma samet ${overdueCustomers.length} grahakon ka udhaar 30 din se upar ho chuka hai.`,
    ],
    tip: 'Aaj shaam 6 se 8 baje ke beech reminder bhejne se 40% zyada grahak UPI se turant payment karte hain.',
  });

  const [loadingSummary, setLoadingSummary] = useState(false);

  // Fetch AI daily summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const topDebtorsNames = topDebtors.map((d) => d.name).join(', ') || 'Koi nahi';
      const res = await getDailySummary({
        totalUdhaar,
        todayRecovery,
        lowStockCount: lowStockProducts.length + outOfStockProducts.length,
        topDebtors: topDebtorsNames,
        language,
      });
      setSummaryData(res);
    } catch (e) {
      console.error('Summary fetch error:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [language]);

  const handleShareSummaryWhatsApp = () => {
    const text = `*Dukaan Saathi - ${profile.name} Daily Summary*\n\n` +
      summaryData.lines.map((l, i) => `${i + 1}. ${l}`).join('\n') +
      `\n\n*Smart Tip:* ${summaryData.tip}\n\n_Bolo. Photo kheencho. Paisa wapas pao._`;
    const url = createWhatsAppUrl(profile.phone || '9811234567', text);
    window.open(url, '_blank');
  };

  // Check if scans are older than 3 days
  const latestScan = scans.length > 0 ? scans[0] : null;
  const isScanStale =
    !latestScan || Date.now() - new Date(latestScan.created_at).getTime() > 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-emerald-900/10 via-[#DDF3E7] to-transparent p-4 rounded-2xl border border-emerald-100">
        <div>
          <h2 className="text-xl font-black text-[#0B3D2E] tracking-tight">
            {t.greeting}, {profile.owner || 'Shopkeeper'}! 🙏
          </h2>
          <p className="text-xs text-[#5F7A6E]">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0B3D2E] text-white shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span>Store Online</span>
          </span>
        </div>
      </div>

      {/* KPI Cards Grid (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Udhaar Baaki */}
        <div
          onClick={() => onNavigate('khata')}
          className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5F7A6E] truncate">{t.totalUdhaar}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#E4572E] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl lg:text-2xl font-black text-[#0B3D2E] tracking-tight">
            {formatINR(totalUdhaar)}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1">
            <span>Pending balance</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Aaj Ki Vasooli */}
        <div
          onClick={() => onNavigate('khata')}
          className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5F7A6E] truncate">{t.todayRecovery}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F7A5C] flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl lg:text-2xl font-black text-[#1F7A5C] tracking-tight">
            {formatINR(todayRecovery)}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-1">
            <span>Jama hui rashi</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          onClick={() => onNavigate('stock')}
          className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5F7A6E] truncate">{t.lowStock}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#F5A623] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl lg:text-2xl font-black text-[#123D31] tracking-tight">
            {lowStockProducts.length + outOfStockProducts.length} <span className="text-xs text-gray-500 font-normal">SKUs</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 mt-1">
            <span>Reorder zaroori</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Overdue Customers */}
        <div
          onClick={() => onNavigate('reminders')}
          className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5F7A6E] truncate">{t.overdueCustomers}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl lg:text-2xl font-black text-rose-700 tracking-tight">
            {overdueCustomers.length} <span className="text-xs text-gray-500 font-normal">Grahak</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1">
            <span>30 din se baaki</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* "Aaj Ka Summary" AI Briefing Card */}
      <div className="bg-gradient-to-br from-[#0B3D2E] via-[#124234] to-[#1F7A5C] text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 mb-3.5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#25D366] text-[#0B3D2E] flex items-center justify-center font-black">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">{t.todaySummary}</h3>
              <p className="text-[11px] text-emerald-200">Gemini 3.8 Flash Kirana Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSummary}
              disabled={loadingSummary}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-95 disabled:opacity-50"
              title={t.regenerate}
            >
              <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleShareSummaryWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-bold text-xs shadow-xs transition-transform active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Summary Bullets */}
        <div className="space-y-2.5 relative z-10">
          {summaryData.lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-emerald-100">
              <span className="w-5 h-5 rounded-full bg-[#25D366]/20 text-[#25D366] font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                {idx + 1}
              </span>
              <p className="leading-relaxed font-medium">{line}</p>
            </div>
          ))}

          {/* Actionable Tip Box */}
          <div className="mt-3 p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs">
            <span className="text-[#F5A623] font-bold uppercase tracking-wider text-[10px] block mb-0.5">
              💡 {t.aiTip}
            </span>
            <p className="text-emerald-50 italic">{summaryData.tip}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions (4 Buttons) */}
      <div>
        <h3 className="text-sm font-bold text-[#123D31] mb-3 px-1">{t.quickActions}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenQuickVoice}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-xs text-left group active:scale-98 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B3D2E] to-[#25D366] text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#123D31]">{t.voiceEntry}</p>
              <p className="text-[10px] text-[#5F7A6E]">Boliye aur likhiye</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('stock')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-xs text-left group active:scale-98 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F5A623] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#123D31]">{t.scanShelf}</p>
              <p className="text-[10px] text-[#5F7A6E]">Stock gap check</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('reminders')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-xs text-left group active:scale-98 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1F7A5C] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#123D31]">{t.sendReminders}</p>
              <p className="text-[10px] text-[#5F7A6E]">WhatsApp & UPI</p>
            </div>
          </button>

          <button
            onClick={onOpenAddCustomer}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-xs text-left group active:scale-98 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#123D31]">{t.addCustomer}</p>
              <p className="text-[10px] text-[#5F7A6E]">Khata register</p>
            </div>
          </button>
        </div>
      </div>

      {/* Visual Charts: 7-day Cash Flow & Top Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash Flow Chart */}
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-extrabold text-[#123D31]">{t.cashFlowTitle}</h4>
              <p className="text-[11px] text-[#5F7A6E]">Udhaar Diya vs Vasooli</p>
            </div>
          </div>
          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#5F7A6E" tick={{ fontSize: 10 }} />
                <YAxis stroke="#5F7A6E" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val)), '']}
                  contentStyle={{ backgroundColor: '#0B3D2E', color: '#fff', borderRadius: '12px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="credit" name="Udhaar Diya" fill="#E4572E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payment" name="Vasooli (Jama)" fill="#25D366" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Debtors Horizontal Bar */}
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-extrabold text-[#123D31]">{t.topDebtorsTitle}</h4>
              <p className="text-[11px] text-[#5F7A6E]">Top pending accounts</p>
            </div>
            <button
              onClick={() => onNavigate('khata')}
              className="text-xs font-bold text-[#1F7A5C] hover:underline"
            >
              Sabhi Dekhein
            </button>
          </div>
          <div className="space-y-3">
            {topDebtors.map((debtor, idx) => {
              const maxBal = topDebtors[0]?.balance || 1;
              const percent = Math.min(100, Math.round((debtor.balance / maxBal) * 100));

              return (
                <div key={debtor.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#123D31] truncate max-w-[200px]">
                      {idx + 1}. {debtor.name}
                    </span>
                    <span className="text-rose-600 font-bold">{formatINR(debtor.balance)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Attention Alerts List */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
        <h4 className="text-sm font-extrabold text-[#123D31] mb-3">{t.alertsTitle}</h4>
        <div className="space-y-2.5">
          {/* Overdue alert */}
          {overdueCustomers.length > 0 && (
            <div
              onClick={() => onNavigate('reminders')}
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-900">
                    {overdueCustomers.length} grahakon ka udhaar 30+ dino se baaki hai
                  </p>
                  <p className="text-[11px] text-rose-700">
                    Sharma ji, Sunita Verma ko turant reminder bhejein.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-700" />
            </div>
          )}

          {/* Out of stock alert */}
          {outOfStockProducts.length > 0 && (
            <div
              onClick={() => onNavigate('stock')}
              className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <PackageX className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    {outOfStockProducts.map((p) => p.name.split(' ')[0]).join(', ')} poori tarah se khatam hain!
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Distributor order list mein add karke WhatsApp karein.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-800" />
            </div>
          )}

          {/* Scan age alert */}
          {isScanStale && (
            <div
              onClick={() => onNavigate('stock')}
              className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#1F7A5C] flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Shelf scan 3 din purana ho chuka hai
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Nayi photo kheench kar taza stock gaps check karein.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#1F7A5C]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
