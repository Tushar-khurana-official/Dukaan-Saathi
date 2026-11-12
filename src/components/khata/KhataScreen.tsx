import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  UserPlus,
  Phone,
  Calendar,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  QrCode,
  Edit,
  Trash2,
  X,
  Info,
  ShieldCheck,
  CheckCircle2,
  Mic,
  FileText,
  Camera,
  Plus,
  Download,
} from 'lucide-react';
import { Customer, Language, ReminderLog, ShopProfile, Transaction } from '../../types';
import type { NewCustomer, NewTransaction } from '../../hooks/useLedger';
import { calculateBharosaScore, formatRelativeDate, getOverdueSeverity } from '../../utils/formatters';
import { formatPaise, parseRupeeInput } from '../../lib/money';
import { buildReminderMessage, createWhatsAppShareUrl, createWhatsAppUrl } from '../../lib/reminders';
import { translations } from '../../utils/translations';

interface KhataScreenProps {
  profile: ShopProfile;
  language: Language;
  customers: Customer[];
  transactions: Transaction[];
  customerBalances: Map<string, { balance: number; lastTxDate?: string }>;
  onAddTransaction: (tx: NewTransaction) => Transaction;
  onAddCustomer: (cust: NewCustomer) => Customer;
  onUpdateCustomer: (id: string, updates: Partial<Pick<Customer, 'name' | 'note'>>) => void;
  onRecordConsent: (id: string, phone: string) => void;
  onWithdrawConsent: (id: string) => void;
  onDeleteCustomer: (id: string) => void;
  onExportCustomer: (id: string) => object | null;
  onLogReminderOpened: (log: Pick<ReminderLog, 'customer_id' | 'text' | 'amount_paise' | 'tone'>) => void;
  onOpenUpiQr: (customerName: string, amountPaise: number) => void;
}

/** Shown wherever a phone number is collected (DPDP purpose notice). */
const CONSENT_TEXT =
  'Grahak ne apna mobile number save karne ki sehmati di hai. Number sirf udhaar ke hisaab aur payment reminder ke liye use hoga.';

export const KhataScreen: React.FC<KhataScreenProps> = ({
  profile,
  language,
  customers,
  transactions,
  customerBalances,
  onAddTransaction,
  onAddCustomer,
  onUpdateCustomer,
  onRecordConsent,
  onWithdrawConsent,
  onDeleteCustomer,
  onExportCustomer,
  onLogReminderOpened,
  onOpenUpiQr,
}) => {
  const t = translations[language].khata;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'highest' | 'settled'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txType, setTxType] = useState<'credit' | 'payment'>('credit');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');

  // New customer form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustNote, setNewCustNote] = useState('');
  const [newCustConsent, setNewCustConsent] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  /** Same name already in the khata? (two "Paras" make voice matching ambiguous) */
  const duplicateOf = (name: string, exceptId?: string) =>
    customers.find((c) => c.id !== exceptId && c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const [formError, setFormError] = useState<string | null>(null);

  // Record consent for an existing customer
  const [consentPhone, setConsentPhone] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [isConsentFormOpen, setIsConsentFormOpen] = useState(false);

  // Filter & search logic
  const filteredCustomers = useMemo(() => {
    let list = customers.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);
      return matchSearch;
    });

    if (filterType === 'overdue') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((c) => {
        const info = customerBalances.get(c.id);
        if (!info || info.balance <= 0 || !info.lastTxDate) return false;
        return new Date(info.lastTxDate).getTime() < thirtyDaysAgo;
      });
    } else if (filterType === 'highest') {
      list = [...list].sort((a, b) => {
        const balA = customerBalances.get(a.id)?.balance || 0;
        const balB = customerBalances.get(b.id)?.balance || 0;
        return balB - balA;
      });
    } else if (filterType === 'settled') {
      list = list.filter((c) => {
        const bal = customerBalances.get(c.id)?.balance || 0;
        return bal <= 0;
      });
    }

    return list;
  }, [customers, searchQuery, filterType, customerBalances]);

  // Handle manual transaction submission
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = parseRupeeInput(txAmount);
    if (!selectedCustomer || amountPaise === null || amountPaise <= 0) {
      setFormError('Sahi rashi daaliye (jaise 500 ya 99.50)');
      return;
    }
    setFormError(null);

    onAddTransaction({
      customer_id: selectedCustomer.id,
      type: txType,
      amount_paise: amountPaise,
      note: txNote.trim() || (txType === 'credit' ? 'Udhaar Saman' : 'Payment Jama'),
      source: 'manual',
    });

    setTxAmount('');
    setTxNote('');
    setIsAddTxOpen(false);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    if (duplicateOf(newCustName) && !confirm(`"${newCustName.trim()}" naam ka grahak pehle se hai. Phir bhi naya banayein? (Pehchan ke liye naam ke saath gali/kaam likhein, jaise "Paras (Gali 2)")`)) return;
    const phone = newCustPhone.replace(/\D/g, '');
    if (phone && !/^[6-9]\d{9}$/.test(phone.slice(-10))) {
      setFormError('10 digit ka mobile number daaliye');
      return;
    }
    if (phone && !newCustConsent) {
      setFormError('Number save karne se pehle grahak ki sehmati zaroori hai. Sehmati nahi hai to number khali chhodein.');
      return;
    }
    setFormError(null);

    const created = onAddCustomer({
      name: newCustName.trim(),
      phone,
      note: newCustNote.trim() || 'General customer',
      consent_given_at: phone && newCustConsent ? new Date().toISOString() : null,
    });

    setNewCustName('');
    setNewCustPhone('');
    setNewCustNote('');
    setNewCustConsent(false);
    setIsAddCustomerOpen(false);
    setSelectedCustomer(created);
  };

  const handleRecordConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const phone = consentPhone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone.slice(-10))) {
      setFormError('10 digit ka mobile number daaliye');
      return;
    }
    if (!consentChecked) {
      setFormError('Grahak ki sehmati tick karein');
      return;
    }
    setFormError(null);
    onRecordConsent(selectedCustomer.id, phone);
    setSelectedCustomer({ ...selectedCustomer, phone: phone.slice(-10), consent_given_at: new Date().toISOString() });
    setConsentPhone('');
    setConsentChecked(false);
    setIsConsentFormOpen(false);
  };

  const handleExportCustomer = () => {
    if (!selectedCustomer) return;
    const data = onExportCustomer(selectedCustomer.id);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `grahak-data-${selectedCustomer.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsAppReminder = () => {
    if (!selectedCustomer || selectedBalance <= 0) return;
    const text = buildReminderMessage({
      amountPaise: selectedBalance,
      shopName: profile.name,
      upiId: profile.upi_id,
      language: profile.reminder_settings.language,
      tone: profile.reminder_settings.default_tone,
    });
    const url =
      (selectedCustomer.phone && selectedCustomer.consent_given_at && createWhatsAppUrl(selectedCustomer.phone, text)) ||
      createWhatsAppShareUrl(text);
    onLogReminderOpened({
      customer_id: selectedCustomer.id,
      text,
      amount_paise: selectedBalance,
      tone: profile.reminder_settings.default_tone,
    });
    window.open(url, '_blank', 'noopener');
  };

  // Selected customer info
  const selectedInfo = selectedCustomer ? customerBalances.get(selectedCustomer.id) : null;
  const selectedBalance = selectedInfo?.balance || 0;
  const selectedTxHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return transactions
      .filter((t) => t.customer_id === selectedCustomer.id)
      .sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at));
  }, [selectedCustomer, transactions]);

  const bharosa = useMemo(() => {
    return calculateBharosaScore(selectedTxHistory);
  }, [selectedTxHistory]);

  const overdue = useMemo(() => {
    return getOverdueSeverity(selectedInfo?.lastTxDate, selectedBalance);
  }, [selectedInfo, selectedBalance]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Search & Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#0B3D2E] tracking-tight">{t.title}</h2>
          <p className="text-xs text-[#5F7A6E]">
            {customers.length} Grahak registered • Udhaar aur vasooli ledger
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3D2E] hover:bg-[#124b39] text-white text-xs font-bold shadow-xs active:scale-95 transition-all w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.addCustomerBtn}</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-emerald-100 text-xs sm:text-sm text-[#123D31] focus:outline-none focus:ring-2 focus:ring-[#25D366] shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
            filterType === 'all'
              ? 'bg-[#0B3D2E] text-white shadow-xs'
              : 'bg-white text-gray-600 border border-emerald-100 hover:bg-emerald-50'
          }`}
        >
          {t.filterAll} ({customers.length})
        </button>
        <button
          onClick={() => setFilterType('overdue')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
            filterType === 'overdue'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          {t.filterOverdue}
        </button>
        <button
          onClick={() => setFilterType('highest')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
            filterType === 'highest'
              ? 'bg-[#F5A623] text-[#0B3D2E] shadow-xs'
              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          {t.filterHighest}
        </button>
        <button
          onClick={() => setFilterType('settled')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
            filterType === 'settled'
              ? 'bg-[#1F7A5C] text-white shadow-xs'
              : 'bg-white text-emerald-800 border border-emerald-100 hover:bg-emerald-50'
          }`}
        >
          {t.filterSettled}
        </button>
      </div>

      {/* Customers List Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCustomers.map((cust) => {
          const info = customerBalances.get(cust.id);
          const balance = info?.balance || 0;
          const severity = getOverdueSeverity(info?.lastTxDate, balance);

          return (
            <div
              key={cust.id}
              onClick={() => setSelectedCustomer(cust)}
              className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-xs ${
                      cust.avatar_color || 'bg-emerald-700'
                    }`}
                  >
                    {cust.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-[#123D31] truncate">{cust.name}</h4>
                    <p className="text-[11px] text-[#5F7A6E] truncate">
                      {cust.note || 'Regular grahak'}
                    </p>
                  </div>
                </div>

                {/* Overdue severity badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    severity.color === 'red'
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : severity.color === 'amber'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {severity.label}
                </span>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-emerald-50 text-xs">
                <div>
                  <span className="text-[10px] text-[#5F7A6E] block">Baaki Rashi:</span>
                  <span
                    className={`text-base font-black ${
                      balance > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatPaise(balance)}
                  </span>
                </div>

                <span className="text-[10px] text-gray-400">
                  {info?.lastTxDate ? formatRelativeDate(info.lastTxDate, language) : 'Puraana'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="p-8 bg-white rounded-3xl text-center border border-emerald-100 space-y-2">
          <p className="text-sm font-bold text-[#123D31]">Koi grahak nahi mila</p>
          <p className="text-xs text-[#5F7A6E]">Filter badal kar ya naam search karke dekhein.</p>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-[#0B3D2E] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base ${
                    selectedCustomer.avatar_color || 'bg-emerald-700'
                  }`}
                >
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  {isEditingCustomer ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!editName.trim()) return;
                        if (duplicateOf(editName, selectedCustomer.id) && !confirm('Is naam ka grahak pehle se hai. Phir bhi save karein?')) return;
                        onUpdateCustomer(selectedCustomer.id, { name: editName.trim(), note: editNote.trim() });
                        setSelectedCustomer({ ...selectedCustomer, name: editName.trim(), note: editNote.trim() });
                        setIsEditingCustomer(false);
                      }}
                      className="space-y-1.5"
                    >
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 rounded-lg text-[#123D31] text-sm font-bold" />
                      <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Pata / note" className="w-full px-2 py-1 rounded-lg text-[#123D31] text-xs" />
                      <div className="flex gap-1.5">
                        <button type="submit" className="px-3 py-1 rounded-lg bg-[#25D366] text-[#0B3D2E] text-xs font-bold">Save</button>
                        <button type="button" onClick={() => setIsEditingCustomer(false)} className="px-3 py-1 rounded-lg bg-white/15 text-xs font-bold">Cancel</button>
                      </div>
                    </form>
                  ) : (
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    {selectedCustomer.name}
                    <button
                      onClick={() => {
                        setEditName(selectedCustomer.name);
                        setEditNote(selectedCustomer.note);
                        setIsEditingCustomer(true);
                      }}
                      className="p-1 rounded hover:bg-white/15"
                      title="Naam / note badlein"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  )}
                  <p className="text-xs text-emerald-200">
                    {selectedCustomer.phone && selectedCustomer.consent_given_at
                      ? `+91 ${selectedCustomer.phone} • sehmati ${new Date(selectedCustomer.consent_given_at).toLocaleDateString('en-IN')}`
                      : 'Phone number save nahi hai'}
                  </p>
                </div>
              </div>
              <button
                aria-label="Band karein"
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsEditingCustomer(false);
                  setIsConsentFormOpen(false);
                  setFormError(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Hero Balance Card */}
              <div className="p-4 rounded-2xl bg-[#F2F8F5] border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#5F7A6E]">Kul Baaki Hisab</span>
                  <div className="text-2xl font-black text-rose-600 tracking-tight">
                    {formatPaise(selectedBalance)}
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">
                    Last active:{' '}
                    {selectedInfo?.lastTxDate
                      ? formatRelativeDate(selectedInfo.lastTxDate, language)
                      : 'N/A'}
                  </span>
                </div>

                {/* Bharosa Score Badge */}
                <div className="text-right">
                  <div className="group relative inline-block">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${bharosa.color}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{bharosa.badge}</span>
                      <Info className="w-3 h-3 ml-0.5 opacity-60" />
                    </span>
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute right-0 bottom-full mb-1.5 w-48 p-2 rounded-xl bg-gray-900 text-white text-[10px] shadow-lg leading-normal z-20">
                      {t.trustTooltip}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Score: {bharosa.score}/100</p>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setTxType('credit');
                    setIsAddTxOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+ Udhaar Dein</span>
                </button>

                <button
                  onClick={() => {
                    setTxType('payment');
                    setIsAddTxOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Jama Karein</span>
                </button>

                <button
                  onClick={() => onOpenUpiQr(selectedCustomer.name, selectedBalance)}
                  disabled={selectedBalance <= 0}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-50 text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200 disabled:opacity-40"
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI QR</span>
                </button>

                <button
                  onClick={handleWhatsAppReminder}
                  disabled={selectedBalance <= 0}
                  title={selectedCustomer.phone ? 'WhatsApp mein reminder kholein' : 'WhatsApp khulega, contact aap chunenge'}
                  className="py-2.5 px-3 rounded-xl bg-[#1F7A5C] hover:bg-[#19654c] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
              </div>

              {/* Phone & consent (DPDP) */}
              <div className="p-3 rounded-2xl border border-emerald-100 bg-white text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#123D31] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1F7A5C]" /> Phone aur sehmati
                  </span>
                  {selectedCustomer.consent_given_at ? (
                    <button
                      onClick={() => {
                        if (confirm('Grahak ne sehmati wapas li? Phone number delete ho jayega, udhaar ka hisaab rahega.')) {
                          onWithdrawConsent(selectedCustomer.id);
                          setSelectedCustomer({ ...selectedCustomer, phone: '', consent_given_at: null });
                        }
                      }}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Sehmati wapas / number hatao
                    </button>
                  ) : (
                    !isConsentFormOpen && (
                      <button onClick={() => setIsConsentFormOpen(true)} className="text-[#1F7A5C] font-bold hover:underline">
                        + Number jodein
                      </button>
                    )
                  )}
                </div>
                {!selectedCustomer.consent_given_at && !isConsentFormOpen && (
                  <p className="text-[11px] text-gray-500">WhatsApp reminder ke liye grahak ki sehmati se number save karein.</p>
                )}
                {isConsentFormOpen && (
                  <form onSubmit={handleRecordConsent} className="space-y-2">
                    <input
                      type="tel"
                      value={consentPhone}
                      onChange={(e) => setConsentPhone(e.target.value)}
                      placeholder="10 digit mobile number"
                      className="w-full p-2 rounded-lg border border-emerald-200"
                    />
                    <label className="flex items-start gap-2 text-[11px] text-gray-700">
                      <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="mt-0.5" />
                      <span>{CONSENT_TEXT}</span>
                    </label>
                    {formError && <p className="text-[11px] text-rose-600 font-bold">{formError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 py-1.5 rounded-lg bg-[#0B3D2E] text-white font-bold">Save</button>
                      <button type="button" onClick={() => setIsConsentFormOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 font-bold">Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Transactions Timeline */}
              <div>
                <h4 className="text-xs font-bold text-[#123D31] uppercase tracking-wider mb-2.5">
                  {t.transactionsTimeline} ({selectedTxHistory.length})
                </h4>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedTxHistory.map((tx) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isCredit ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-[#123D31]">{tx.note || 'Saman'}</p>
                            <p className="text-[10px] text-gray-400">
                              {formatRelativeDate(tx.confirmed_at, language)} • {tx.source}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`font-black text-sm ${
                            isCredit ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatPaise(tx.amount_paise)}
                        </span>
                      </div>
                    );
                  })}

                  {selectedTxHistory.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      {t.emptyTransactions}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Delete / Manage */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs">
              <button onClick={handleExportCustomer} className="text-[#1F7A5C] hover:underline font-bold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                <span>Grahak ka data export</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`${selectedCustomer.name} ka saara data (khata, reminders, phone) hamesha ke liye delete karein? Yeh wapas nahi hoga.`)) {
                    onDeleteCustomer(selectedCustomer.id);
                    setSelectedCustomer(null);
                  }
                }}
                className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Data delete karein</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Modal */}
      {isAddTxOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveTransaction}
            className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border border-emerald-100 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0B3D2E]">
                {txType === 'credit' ? 'Naya Udhaar Jodein (+)' : 'Payment Jama Karein (-)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTxOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5F7A6E]">
              Grahak: <span className="font-bold text-[#123D31]">{selectedCustomer.name}</span>
            </p>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Rashi (₹)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="₹ 500"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-lg font-black text-[#0B3D2E] focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Saman / Note</label>
              <input
                type="text"
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder="e.g. Atta, Doodh, Cheeni"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            {formError && <p className="text-xs text-rose-600 font-bold">{formError}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold text-xs"
              >
                Save Karein
              </button>
              <button
                type="button"
                onClick={() => setIsAddTxOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveCustomer}
            className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border border-emerald-100 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0B3D2E]">Naya Grahak Register Karein</h3>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Grahak Ka Naam</label>
              <input
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. Rakesh Sharma (Gali 4)"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                autoFocus
              />
              {newCustName.trim() && duplicateOf(newCustName) && (
                <p className="text-[11px] font-bold text-amber-700 mt-1">
                  Is naam ka grahak pehle se hai. Pehchan ke liye gali/kaam jodein, jaise "{newCustName.trim()} (Gali 2)".
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Mobile Number (WhatsApp)</label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="Optional — sirf grahak ki sehmati se"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
              {newCustPhone.trim() && (
                <label className="flex items-start gap-2 mt-2 text-[11px] text-gray-700">
                  <input type="checkbox" checked={newCustConsent} onChange={(e) => setNewCustConsent(e.target.checked)} className="mt-0.5" />
                  <span>{CONSENT_TEXT}</span>
                </label>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Pata ya Note</label>
              <input
                type="text"
                value={newCustNote}
                onChange={(e) => setNewCustNote(e.target.value)}
                placeholder="e.g. House No. 12, Teacher"
                className="w-full p-2.5 rounded-xl border border-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            {formError && <p className="text-xs text-rose-600 font-bold">{formError}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white font-bold text-xs"
              >
                Register Karein
              </button>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
