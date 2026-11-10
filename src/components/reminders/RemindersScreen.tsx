import React, { useState, useMemo } from 'react';
import {
  BellRing,
  Send,
  Sparkles,
  QrCode,
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  ExternalLink,
  History,
  ShieldCheck,
} from 'lucide-react';
import { Customer, Language, ReminderLog, ReminderTone, ShopProfile } from '../../types';
import { formatRelativeDate } from '../../utils/formatters';
import { formatPaise } from '../../lib/money';
import { buildReminderMessage, createWhatsAppShareUrl, createWhatsAppUrl, isValidUpiId } from '../../lib/reminders';
import { translations } from '../../utils/translations';

interface RemindersScreenProps {
  profile: ShopProfile;
  language: Language;
  customers: Customer[];
  customerBalances: Map<string, { balance: number; lastTxDate?: string }>;
  reminders: ReminderLog[];
  onUpdateProfile: (p: ShopProfile) => void;
  onLogReminderOpened: (log: Pick<ReminderLog, 'customer_id' | 'text' | 'amount_paise' | 'tone'>) => void;
  onOpenUpiQr: (customerName: string, amountPaise: number) => void;
}

export const RemindersScreen: React.FC<RemindersScreenProps> = ({
  profile,
  language,
  customers,
  customerBalances,
  reminders,
  onUpdateProfile,
  onLogReminderOpened,
  onOpenUpiQr,
}) => {
  const t = translations[language].reminders;

  // Overdue customers list (balance > 0)
  const pendingCustomers = useMemo(() => {
    return customers
      .map((c) => {
        const info = customerBalances.get(c.id);
        const balance = info?.balance || 0;
        const diffMs = info?.lastTxDate ? Date.now() - new Date(info.lastTxDate).getTime() : 0;
        const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          ...c,
          balance,
          daysOverdue,
          lastTxDate: info?.lastTxDate,
        };
      })
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [customers, customerBalances]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    pendingCustomers[0]?.id || ''
  );
  const tone = profile.reminder_settings.default_tone;
  const msgLanguage = profile.reminder_settings.language;
  const setTone = (t: ReminderTone) =>
    onUpdateProfile({ ...profile, reminder_settings: { ...profile.reminder_settings, default_tone: t } });
  const setMsgLanguage = (l: Language) =>
    onUpdateProfile({ ...profile, reminder_settings: { ...profile.reminder_settings, language: l } });
  const upiOk = isValidUpiId(profile.upi_id);

  // Bulk Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  const activeCustomer = pendingCustomers.find((c) => c.id === selectedCustomerId) || pendingCustomers[0];

  // Message contains only the amount, the shop name and the UPI link (DPDP rule in the spec).
  const messageFor = (amountPaise: number) =>
    buildReminderMessage({ amountPaise, shopName: profile.name, upiId: profile.upi_id, language: msgLanguage, tone });
  const reminderMessage = activeCustomer ? messageFor(activeCustomer.balance) : '';

  /** Number saved with consent: WhatsApp opens straight in the customer's chat. */
  const hasNumber = (cust?: (typeof pendingCustomers)[number]) => Boolean(cust && cust.phone && cust.consent_given_at);
  /** Without a saved number WhatsApp still opens with the message; the owner picks the contact there. */
  const canSend = (cust?: (typeof pendingCustomers)[number]) => Boolean(cust && upiOk);

  /** Opens WhatsApp with the message prefilled. The owner presses send inside WhatsApp. */
  const handleOpenWhatsApp = (cust = activeCustomer) => {
    if (!cust || !canSend(cust)) return;
    const text = messageFor(cust.balance);
    const url = (hasNumber(cust) && createWhatsAppUrl(cust.phone, text)) || createWhatsAppShareUrl(text);
    onLogReminderOpened({ customer_id: cust.id, text, amount_paise: cust.balance, tone });
    window.open(url, '_blank', 'noopener');
  };

  // Bulk queue: one customer at a time, each opened by the owner.
  const startBulkQueue = () => {
    const overdueIds = pendingCustomers.filter((c) => c.daysOverdue >= 7 && canSend(c)).map((c) => c.id);
    setBulkQueue(overdueIds);
    setCurrentQueueIndex(0);
    if (overdueIds.length > 0) {
      setSelectedCustomerId(overdueIds[0]);
    }
  };

  const handleBulkNext = () => {
    if (activeCustomer) {
      handleOpenWhatsApp(activeCustomer);
    }
    if (currentQueueIndex < bulkQueue.length - 1) {
      const nextIdx = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIdx);
      setSelectedCustomerId(bulkQueue[nextIdx]);
    } else {
      setBulkQueue([]);
      setCurrentQueueIndex(0);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 lg:pb-12 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0B3D2E] to-[#1F7A5C] text-white p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BellRing className="w-5 h-5 text-[#25D366]" />
            <h2 className="text-xl font-black tracking-tight">{t.title}</h2>
          </div>
          <p className="text-xs text-emerald-200">
            {t.subtitle} • WhatsApp khulta hai, bhejna aap dabate hain. Kuch apne-aap nahi jaata.
          </p>
        </div>

        {/* Start Bulk Reminders */}
        {pendingCustomers.filter((c) => c.daysOverdue >= 7 && canSend(c)).length > 1 && (
          <button
            onClick={startBulkQueue}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] font-extrabold text-xs shadow-xs active:scale-95 transition-all w-fit"
          >
            <Users className="w-4 h-4" />
            <span>Ek-ek karke reminder ({pendingCustomers.filter((c) => c.daysOverdue >= 7 && canSend(c)).length} grahak)</span>
          </button>
        )}
      </div>

      {/* Bulk Queue In-Progress Banner */}
      {bulkQueue.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-900 block">
              Bulk Queue Chal Raha Hai: Step {currentQueueIndex + 1} of {bulkQueue.length}
            </span>
            <p className="text-[11px] text-amber-700">
              Grahak: <span className="font-bold">{activeCustomer?.name}</span> ({formatPaise(activeCustomer?.balance)})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkNext}
              className="px-3.5 py-1.5 rounded-xl bg-[#25D366] text-[#0B3D2E] text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <span>WhatsApp kholo & agla</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBulkQueue([])}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Pane View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Pane: Customer Selector List (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-3xl shadow-xs border border-emerald-100 flex flex-col h-[520px]">
          <h3 className="text-xs font-bold text-[#123D31] uppercase tracking-wider mb-3 px-1">
            Udhaar Baaki Grahak ({pendingCustomers.length})
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {pendingCustomers.map((cust) => {
              const isSelected = cust.id === activeCustomer?.id;
              const isOverdue = cust.daysOverdue >= 30;

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#DDF3E7] border-emerald-400 shadow-xs ring-1 ring-emerald-300'
                      : 'bg-gray-50/60 border-gray-100 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-extrabold text-[#123D31] truncate">{cust.name}</h4>
                    <p className="text-[10px] text-[#5F7A6E]">
                      {cust.daysOverdue} din pehle • {hasNumber(cust) ? 'Seedha chat khulegi' : 'WhatsApp mein contact chunein'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-black block ${
                        isOverdue ? 'text-rose-600' : 'text-amber-700'
                      }`}
                    >
                      {formatPaise(cust.balance)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isOverdue ? '30d+ Overdue' : `${cust.daysOverdue} din`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Message Customizer & Live Preview (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-3xl shadow-xs border border-emerald-100 flex flex-col justify-between space-y-4">
          {activeCustomer ? (
            <>
              {/* Tone Selector */}
              <div>
                <label className="text-xs font-bold text-[#123D31] block mb-2">
                  Reminder Ki Boli (Tone Selector):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTone('polite')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      tone === 'polite'
                        ? 'bg-[#0B3D2E] text-white border-[#0B3D2E] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.tonePolite}
                  </button>
                  <button
                    onClick={() => setTone('friendly')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      tone === 'friendly'
                        ? 'bg-[#1F7A5C] text-white border-[#1F7A5C] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.toneFriendly}
                  </button>
                  <button
                    onClick={() => setTone('firm')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      tone === 'firm'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.toneFirm}
                  </button>
                </div>
              </div>

              {/* Message language (per-shop setting) */}
              <div>
                <label className="text-xs font-bold text-[#123D31] block mb-2">Message ki bhasha:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['hinglish', 'hindi', 'english'] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setMsgLanguage(l)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold border ${
                        msgLanguage === l ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {l === 'hinglish' ? 'Hinglish' : l === 'hindi' ? 'हिंदी' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Preview Box (WhatsApp Style) */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#5F7A6E]">WhatsApp message preview</span>
                  <span className="text-[10px] text-[#5F7A6E] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Sirf rashi, dukaan ka naam aur UPI link
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#E5DDD5]/50 border border-emerald-100 flex-1 relative min-h-[160px] flex items-center">
                  <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-sm text-xs sm:text-sm text-[#123D31] max-w-[90%] leading-relaxed font-devanagari relative">
                    <p className="whitespace-pre-line">{reminderMessage}</p>
                    <span className="text-[10px] text-gray-400 block text-right mt-1.5">
                      {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {!upiOk && (
                  <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Settings mein sahi UPI ID daaliye (jaise naam@okaxis), tabhi reminder bhej sakte hain.
                  </p>
                )}
                {upiOk && !hasNumber(activeCustomer) && (
                  <p className="text-[11px] text-[#5F7A6E] bg-gray-50 border border-gray-200 rounded-lg p-2">
                    Is grahak ka number save nahi hai: WhatsApp khulega aur aap contact khud chunenge. Seedha chat ke liye
                    Khata mein grahak ki sehmati se "+ Number jodein".
                  </p>
                )}
                <button
                  onClick={() => handleOpenWhatsApp(activeCustomer)}
                  disabled={!canSend(activeCustomer)}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 fill-[#0B3D2E]" />
                  <span>{hasNumber(activeCustomer) ? t.btnSendWhatsApp : `${t.btnSendWhatsApp} (contact chunein)`}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </button>

                <button
                  onClick={() => onOpenUpiQr(activeCustomer.name, activeCustomer.balance)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-emerald-50 text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Dukaan Par UPI QR Dikhayein</span>
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-center p-8 text-gray-400 text-xs">
              Koi bhi pending grahak select karein.
            </div>
          )}
        </div>
      </div>

      {/* Reminder History Log */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-emerald-100">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-[#1F7A5C]" />
          <h3 className="text-sm font-extrabold text-[#123D31]">{t.reminderHistory}</h3>
        </div>

        <div className="space-y-2">
          {reminders.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-bold text-[#123D31]">
                  {customers.find((c) => c.id === log.customer_id)?.name ?? 'Grahak'}
                </span>
                <span className="text-gray-400 text-[10px] ml-2">
                  ({formatRelativeDate(log.link_opened_at, language)})
                </span>
                <p className="text-[11px] text-gray-500 truncate max-w-sm mt-0.5">"{log.text.substring(0, 50)}..."</p>
              </div>

              <div className="text-right">
                <span className="font-bold text-rose-600 block">{formatPaise(log.amount_paise)}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  WhatsApp khola
                </span>
              </div>
            </div>
          ))}

          {reminders.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-4">
              Abhi tak koi reminder nahi khola gaya.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
