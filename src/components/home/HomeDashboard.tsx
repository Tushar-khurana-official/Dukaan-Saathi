import React, { useMemo } from 'react';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  Users,
  Mic,
  Camera,
  BellRing,
  UserPlus,
  Share2,
  ArrowUpRight,
  Clock,
  PackageX,
  ChevronRight,
  ShoppingCart,
  BookOpen,
  Package,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Customer, Language, Product, ShelfScan, ShopProfile, Transaction } from '../../types';
import { translations } from '../../utils/translations';
import { formatPaise } from '../../lib/money';
import { createWhatsAppShareUrl } from '../../lib/reminders';
import { addDays, RangeSummary, startOfDay } from '../../lib/ledger';
import { topProductsFromNotes } from '../../lib/productMatch';

interface HomeDashboardProps {
  profile: ShopProfile;
  language: Language;
  totalUdhaar: number; // paise
  todaySummary: RangeSummary;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  overdueCustomers: Customer[];
  topDebtors: (Customer & { balance: number })[];
  topCustomersThisWeek: Array<{ customer_id: string; credit_paise: number }>;
  customers: Customer[];
  transactions: Transaction[];
  catalog: Product[];
  cashFlow7Days: Array<RangeSummary & { label: string; date: string }>;
  scans: ShelfScan[];
  onNavigate: (tab: any) => void;
  onOpenQuickVoice: () => void;
  onOpenAddCustomer: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  language,
  totalUdhaar,
  todaySummary,
  lowStockProducts,
  outOfStockProducts,
  overdueCustomers,
  topDebtors,
  topCustomersThisWeek,
  customers,
  transactions,
  catalog,
  cashFlow7Days,
  scans,
  onNavigate,
  onOpenQuickVoice,
  onOpenAddCustomer,
}) => {
  const t = translations[language].home;

  // Top products: catalog items mentioned most in this week's udhaar / sale notes.
  const topProducts = useMemo(() => {
    const from = addDays(startOfDay(new Date()), -6).getTime();
    const notes = transactions
      .filter((tx) => tx.type !== 'payment' && new Date(tx.confirmed_at).getTime() >= from)
      .map((tx) => tx.note);
    return topProductsFromNotes(notes, catalog, 5);
  }, [transactions, catalog]);

  const chartData = cashFlow7Days.map((d) => ({
    label: d.label,
    sales: d.sales_paise / 100,
    credit: d.credit_given_paise / 100,
    payment: d.recovered_paise / 100,
  }));

  const summaryLines = [
    `Aaj ki bikri ${formatPaise(todaySummary.sales_paise)}, naya udhaar ${formatPaise(todaySummary.credit_given_paise)}, vasooli ${formatPaise(todaySummary.recovered_paise)}.`,
    `Kul udhaar baaki: ${formatPaise(totalUdhaar)} (${overdueCustomers.length} grahak 30 din se upar).`,
    `${outOfStockProducts.length} item khatam, ${lowStockProducts.length} item kam (pichli shelf photo ke hisaab se).`,
  ];

  // Shared to the owner's own chat: aggregate numbers only, no customer names.
  const handleShareSummaryWhatsApp = () => {
    const text = `*${profile.name} — aaj ka hisaab*\n\n${summaryLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
    window.open(createWhatsAppShareUrl(text), '_blank', 'noopener');
  };

  const latestScan = scans.length > 0 ? scans[0] : null;
  const isScanStale = !latestScan || Date.now() - new Date(latestScan.created_at).getTime() > 3 * 86_400_000;

  const tile = (opts: {
    label: string;
    value: React.ReactNode;
    sub: string;
    icon: React.ReactNode;
    tone: string;
    onClick: () => void;
  }) => (
    <div
      onClick={opts.onClick}
      className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#5F7A6E] truncate">{opts.label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${opts.tone}`}>{opts.icon}</div>
      </div>
      <div className="text-xl lg:text-2xl font-black text-[#0B3D2E] tracking-tight">{opts.value}</div>
      <div className="flex items-center gap-1 text-[11px] font-bold text-[#5F7A6E] mt-1">
        <span>{opts.sub}</span>
        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-emerald-900/10 via-[#DDF3E7] to-transparent p-4 rounded-2xl border border-emerald-100">
        <div>
          <h2 className="text-xl font-black text-[#0B3D2E] tracking-tight">
            {t.greeting}, {profile.owner || 'Shopkeeper'}! 🙏
          </h2>
          <p className="text-xs text-[#5F7A6E]">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={handleShareSummaryWhatsApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-bold text-xs shadow-xs w-fit"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Aaj ka hisaab share</span>
        </button>
      </div>

      {/* Daily numbers — every tile is a sum over the transaction log for today */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tile({ label: 'Aaj ki bikri', value: formatPaise(todaySummary.sales_paise), sub: 'Counter sales', icon: <ShoppingCart className="w-4 h-4" />, tone: 'bg-indigo-50 text-indigo-600', onClick: () => onNavigate('assistant') })}
        {tile({ label: t.totalUdhaar, value: formatPaise(totalUdhaar), sub: 'Kul pending', icon: <Wallet className="w-4 h-4" />, tone: 'bg-rose-50 text-[#E4572E]', onClick: () => onNavigate('khata') })}
        {tile({ label: t.todayRecovery, value: formatPaise(todaySummary.recovered_paise), sub: 'Aaj jama hua', icon: <TrendingDown className="w-4 h-4" />, tone: 'bg-emerald-50 text-[#1F7A5C]', onClick: () => onNavigate('khata') })}
        {tile({ label: 'Aaj naya udhaar', value: formatPaise(todaySummary.credit_given_paise), sub: `${todaySummary.transaction_count} entries aaj`, icon: <BookOpen className="w-4 h-4" />, tone: 'bg-amber-50 text-amber-700', onClick: () => onNavigate('khata') })}
        {tile({ label: t.lowStock, value: <>{lowStockProducts.length + outOfStockProducts.length} <span className="text-xs text-gray-500 font-normal">items</span></>, sub: 'Reorder dekhein', icon: <AlertTriangle className="w-4 h-4" />, tone: 'bg-amber-50 text-[#F5A623]', onClick: () => onNavigate('stock') })}
        {tile({ label: t.overdueCustomers, value: <>{overdueCustomers.length} <span className="text-xs text-gray-500 font-normal">grahak</span></>, sub: '30 din se baaki', icon: <Users className="w-4 h-4" />, tone: 'bg-rose-50 text-rose-600', onClick: () => onNavigate('reminders') })}
      </div>

      {/* Aaj ka hisaab (plain summary, no AI needed) */}
      <div className="bg-gradient-to-br from-[#0B3D2E] via-[#124234] to-[#1F7A5C] text-white p-5 rounded-3xl shadow-lg">
        <h3 className="text-base font-extrabold tracking-tight mb-3">{t.todaySummary}</h3>
        <div className="space-y-2.5">
          {summaryLines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-emerald-100">
              <span className="w-5 h-5 rounded-full bg-[#25D366]/20 text-[#25D366] font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                {idx + 1}
              </span>
              <p className="leading-relaxed font-medium">{line}</p>
            </div>
          ))}
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
              <p className="text-[11px] text-[#5F7A6E]">Bikri, udhaar aur vasooli (7 din)</p>
            </div>
          </div>
          <div className="h-56 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" stroke="#5F7A6E" tick={{ fontSize: 10 }} />
                <YAxis stroke="#5F7A6E" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [formatPaise(Math.round(Number(val) * 100)), '']}
                  contentStyle={{ backgroundColor: '#0B3D2E', color: '#fff', borderRadius: '12px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="sales" name="Bikri" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="credit" name="Udhaar diya" fill="#E4572E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payment" name="Vasooli" fill="#25D366" radius={[4, 4, 0, 0]} />
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
                    <span className="text-rose-600 font-bold">{formatPaise(debtor.balance)}</span>
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

      {/* Top products and top customers this week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
          <h4 className="text-sm font-extrabold text-[#123D31] flex items-center gap-1.5">
            <Package className="w-4 h-4 text-[#1F7A5C]" /> Top products (7 din)
          </h4>
          <p className="text-[11px] text-[#5F7A6E] mb-3">Udhaar/bikri notes mein sabse zyada naam aaye</p>
          {topProducts.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Entries mein saman ka naam likhne par yahan dikhega.</p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {topProducts.map((p, i) => (
                <li key={p.product.id} className="flex justify-between gap-2">
                  <span className="text-[#123D31] font-semibold truncate">{i + 1}. {p.product.name}</span>
                  <span className="text-[#5F7A6E] shrink-0">{p.mentions} baar</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
          <h4 className="text-sm font-extrabold text-[#123D31] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#1F7A5C]" /> Top grahak (7 din)
          </h4>
          <p className="text-[11px] text-[#5F7A6E] mb-3">Is hafte sabse zyada udhaar liya</p>
          {topCustomersThisWeek.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Is hafte koi udhaar nahi.</p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {topCustomersThisWeek.map((c, i) => (
                <li key={c.customer_id} className="flex justify-between gap-2">
                  <span className="text-[#123D31] font-semibold truncate">
                    {i + 1}. {customers.find((x) => x.id === c.customer_id)?.name ?? 'Grahak'}
                  </span>
                  <span className="text-rose-600 font-bold shrink-0">{formatPaise(c.credit_paise)}</span>
                </li>
              ))}
            </ol>
          )}
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
                    {overdueCustomers.slice(0, 2).map((c) => c.name).join(', ')} ko reminder bhejein.
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
                    {latestScan ? 'Shelf photo 3 din se purani hai' : 'Abhi tak koi shelf photo nahi'}
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
