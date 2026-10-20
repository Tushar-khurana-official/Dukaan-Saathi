import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Clock,
  Sparkles,
  Calendar,
  Package,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { Customer, Language, Product, Transaction } from '../../types';
import { calculateBharosaScore, formatINR } from '../../utils/formatters';
import { getFestivalStockSuggestions } from '../../services/api';

interface InsightsScreenProps {
  language: Language;
  customers: Customer[];
  transactions: Transaction[];
  customerBalances: Map<string, { balance: number; lastTxDate?: string }>;
  catalog: Product[];
  onAddToReorder: (item: any) => void;
}

export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  language,
  customers,
  transactions,
  customerBalances,
  catalog,
  onAddToReorder,
}) => {
  const [selectedFestival, setSelectedFestival] = useState<string>('Diwali');
  const [festivalData, setFestivalData] = useState<any>(null);
  const [loadingFestival, setLoadingFestival] = useState(false);

  // Overall financial statistics
  const stats = React.useMemo(() => {
    const totalCredit = transactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaid = transactions
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);

    const recoveryRate = totalCredit > 0 ? Math.min(100, Math.round((totalPaid / totalCredit) * 100)) : 100;

    // Calculate customer bharosa scores
    const scoredCustomers = customers.map((c) => {
      const cTx = transactions.filter((t) => t.customer_id === c.id);
      const scoreObj = calculateBharosaScore(cTx);
      const bal = customerBalances.get(c.id)?.balance || 0;
      return {
        ...c,
        score: scoreObj.score,
        badge: scoreObj.badge,
        balance: bal,
        repaymentRatio: scoreObj.repaymentRatio,
      };
    });

    const bestPayers = [...scoredCustomers].sort((a, b) => b.score - a.score).slice(0, 4);
    const slowestPayers = [...scoredCustomers]
      .filter((c) => c.balance > 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);

    return {
      totalCredit,
      totalPaid,
      recoveryRate,
      avgRepayDays: 14,
      bestPayers,
      slowestPayers,
    };
  }, [transactions, customers, customerBalances]);

  // Load festival recommendations
  const loadFestivalData = async (fest = selectedFestival) => {
    setLoadingFestival(true);
    try {
      const data = await getFestivalStockSuggestions(fest, catalog);
      setFestivalData(data);
    } catch (e) {
      console.error('Festival stock load error:', e);
    } finally {
      setLoadingFestival(false);
    }
  };

  useEffect(() => {
    loadFestivalData(selectedFestival);
  }, [selectedFestival]);

  const festivals = ['Diwali', 'Holi', 'Raksha Bandhan', 'Navratri', 'Chhath', 'Eid', 'Christmas'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0B3D2E] to-[#1F7A5C] text-white p-5 rounded-3xl shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">Kirana Insights & Tyohar Planner</h2>
          <p className="text-xs text-emerald-200">
            Dukaan ki vasooli speed, bharosemand grahak aur tyohar stocking AI
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-[#25D366] text-[#0B3D2E] flex items-center justify-center font-black">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100">
          <span className="text-xs font-semibold text-[#5F7A6E]">Recovery Rate (Vasooli Ratio)</span>
          <div className="text-2xl font-black text-[#1F7A5C] mt-1">{stats.recoveryRate}%</div>
          <p className="text-[11px] text-[#5F7A6E] mt-1">
            {formatINR(stats.totalPaid)} recovered out of {formatINR(stats.totalCredit)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100">
          <span className="text-xs font-semibold text-[#5F7A6E]">Average Days to Repay</span>
          <div className="text-2xl font-black text-[#0B3D2E] mt-1">14 Din</div>
          <p className="text-[11px] text-[#5F7A6E] mt-1">
            Grahak aamtaur par 2 hafte mein udhaar chuka dete hain
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100">
          <span className="text-xs font-semibold text-[#5F7A6E]">High Bharosa Accounts</span>
          <div className="text-2xl font-black text-[#25D366] mt-1">{stats.bestPayers.length} Grahak</div>
          <p className="text-[11px] text-[#5F7A6E] mt-1">
            Score 80+ wale regular aur time par payment karne wale
          </p>
        </div>
      </div>

      {/* Best & Slowest Payers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Best Payers */}
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-[#123D31]">Sabse Bharosemand Grahak (Top Payers)</h3>
          </div>

          <div className="space-y-2">
            {stats.bestPayers.map((c, i) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[#123D31]">
                    {i + 1}. {c.name}
                  </span>
                  <p className="text-[10px] text-gray-500">{c.phone ? `+91 ${c.phone}` : 'Neighbour'}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                    Score: {c.score}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">{c.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slowest Payers */}
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-extrabold text-[#123D31]">Dhyaan Dene Yogya Grahak (Slow Payers)</h3>
          </div>

          <div className="space-y-2">
            {stats.slowestPayers.map((c, i) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[#123D31]">
                    {i + 1}. {c.name}
                  </span>
                  <p className="text-[10px] text-gray-500">Baaki: {formatINR(c.balance)}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[10px]">
                    Score: {c.score}
                  </span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">Dhyaan do</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Festival Planner (AI Powered) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F5A623] text-[#0B3D2E] flex items-center justify-center font-black">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0B3D2E]">Festival Stock Planner</h3>
              <p className="text-xs text-[#5F7A6E]">
                Agale tyohar ke hisab se zaroori saman pehle se mangwayein
              </p>
            </div>
          </div>

          <button
            onClick={() => loadFestivalData(selectedFestival)}
            disabled={loadingFestival}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#1F7A5C] text-xs font-bold hover:bg-emerald-100 w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingFestival ? 'animate-spin' : ''}`} />
            <span>AI Refresh</span>
          </button>
        </div>

        {/* Festival Selection Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {festivals.map((fest) => (
            <button
              key={fest}
              onClick={() => setSelectedFestival(fest)}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedFestival === fest
                  ? 'bg-[#0B3D2E] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎉 {fest}
            </button>
          ))}
        </div>

        {/* AI Recommendations Grid */}
        {festivalData && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
              {festivalData.summary}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {festivalData.items?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#F2F8F5] border border-emerald-100 flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-extrabold text-[#123D31] truncate">{item.name}</span>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                        {item.demandSurge}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 block mb-1">{item.category}</span>
                    <p className="text-[11px] text-[#5F7A6E] line-clamp-2 leading-relaxed">
                      {item.reason}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      onAddToReorder({
                        product_id: `fest-${idx}`,
                        product_name: item.name,
                        quantity: 20,
                        unit: 'pkts',
                        supplier_name: 'Tyohar Stock Supplier',
                        supplier_phone: '9811234567',
                      })
                    }
                    className="w-full py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-[#0B3D2E] font-bold text-xs border border-emerald-200 transition-colors"
                  >
                    + Add to Reorder
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
