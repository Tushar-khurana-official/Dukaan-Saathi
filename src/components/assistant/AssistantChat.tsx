import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Send,
  Camera,
  Check,
  CheckCheck,
  X,
  Edit2,
  CheckCircle2,
  Sparkles,
  StopCircle,
  Volume2,
  AlertTriangle,
  History,
  SquarePen,
  Trash2,
} from 'lucide-react';
import {
  AiParsedKhata,
  ChatMessage,
  Customer,
  Language,
  Product,
  ShelfScan,
  ShopProfile,
  TransactionType,
} from '../../types';
import type { NewCustomer, NewTransaction } from '../../hooks/useLedger';
import type { RangeSummary } from '../../lib/ledger';
import { formatPaise, parseRupeeInput, paiseToUpiAmount } from '../../lib/money';
import { formatTime } from '../../utils/formatters';
import { translations } from '../../utils/translations';
import { parseKhataMessage, analyzeShelfImage } from '../../services/api';
import { preparePhoto } from '../../lib/image';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { buildReceiptMessage, createWhatsAppUrl } from '../../lib/reminders';
import { statementUrl } from '../../lib/statement';
import { useChatHistory } from '../../hooks/useChatHistory';
import { formatRelativeDate } from '../../utils/formatters';

interface AssistantChatProps {
  profile: ShopProfile;
  language: Language;
  customers: Customer[];
  customerBalances: Map<string, { balance: number; lastTxDate?: string }>;
  todaySummary: RangeSummary;
  catalog: Product[];
  previousScanNotes?: string;
  onAddTransaction: (tx: NewTransaction) => unknown;
  onAddCustomer: (customer: NewCustomer) => Customer;
  onAddScan: (scan: Pick<ShelfScan, 'image_ref' | 'overall_notes' | 'quality_warning' | 'detected_items'>) => ShelfScan;
  externalVoiceTrigger?: boolean;
  onResetVoiceTrigger?: () => void;
}

/** Editable state of a "Sahi hai?" card. Nothing is saved until the owner confirms it. */
interface Draft {
  type: TransactionType;
  customerId: string; // '' = not chosen, '__new__' = create new customer
  newCustomerName: string;
  amountInput: string; // rupees as typed
  note: string;
}

const NEW_CUSTOMER = '__new__';

function draftFromParsed(p: AiParsedKhata): Draft {
  const type: TransactionType = p.intent === 'add_payment' ? 'payment' : p.intent === 'add_sale' ? 'sale' : 'credit';
  return {
    type,
    customerId: p.matched_customer_id ?? '',
    newCustomerName: p.matched_customer_id ? '' : p.customer_name,
    amountInput: p.amount_paise !== null ? paiseToUpiAmount(p.amount_paise) : '',
    note: p.items_note ?? '',
  };
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  profile,
  language,
  customers,
  customerBalances,
  todaySummary,
  catalog,
  previousScanNotes,
  onAddTransaction,
  onAddCustomer,
  onAddScan,
  externalVoiceTrigger,
  onResetVoiceTrigger,
}) => {
  const t = translations[language].assistant;

  const makeWelcome = useCallback(
    (): ChatMessage => ({
      id: `msg-welcome-${Date.now()}`,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      text:
        language === 'hindi'
          ? 'नमस्ते! मैं आपका दुकान साथी हूँ। बोलकर या लिखकर उधार, जमा या बिक्री बताइए। हर एंट्री आपकी पुष्टि के बाद ही सेव होगी।'
          : language === 'english'
            ? 'Hello! I am Dukaan Saathi. Speak or type a credit, payment or sale. Nothing is saved until you confirm it.'
            : 'Namaste! Main aapka Dukaan Saathi hoon. Boliye ya likhiye, jaise "Sharma ji ko 500 udhaar" ya "Sunita ji ne 300 diye". Har entry aapke "Sahi hai" ke baad hi save hogi.',
      status: 'read',
    }),
    [language],
  );
  // Chats live in browser storage, so they survive switching tabs and reloads; old chats are in the history panel.
  const { conversations, activeId, messages, drafts, setMessages, setDrafts, newChat, openChat, deleteChat } =
    useChatHistory<Draft>(makeWelcome);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isRecording, recordingDuration, audioLevels, speechTranscript, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording, isProcessing]);

  useEffect(() => {
    if (externalVoiceTrigger && !isRecording) {
      handleToggleRecording();
      onResetVoiceTrigger?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalVoiceTrigger]);

  const pushBot = (text: string, extra: Partial<ChatMessage> = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sender: 'bot', timestamp: new Date().toISOString(), text, status: 'read', ...extra },
    ]);
  };

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? null;
  /** Two customers with the same name are told apart by their note ("paras (near shop)"). */
  const customerLabel = (c: Customer) => {
    const twins = customers.filter((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()).length > 1;
    return twins && c.note ? `${c.name} (${c.note})` : c.name;
  };

  const handleParsedResponse = (parsed: AiParsedKhata, entrySource: 'voice' | 'text') => {
    if (parsed.intent === 'add_credit' || parsed.intent === 'add_payment' || parsed.intent === 'add_sale') {
      const id = `card-${Date.now()}`;
      setDrafts((prev) => ({ ...prev, [id]: draftFromParsed(parsed) }));
      setMessages((prev) => [
        ...prev,
        { id, sender: 'bot', timestamp: new Date().toISOString(), text: parsed.bot_reply_text, parsedKhata: parsed, entrySource, confirmed: false, status: 'read' },
      ]);
      // If the parser is unsure, open the card in edit mode straight away.
      if (parsed.needs_clarification) setEditingCardId(id);
      return;
    }

    if (parsed.intent === 'query_balance') {
      const name = customerName(parsed.matched_customer_id);
      if (name && parsed.matched_customer_id) {
        const bal = customerBalances.get(parsed.matched_customer_id)?.balance ?? 0;
        pushBot(
          language === 'english'
            ? `${name} owes ${formatPaise(bal)}.`
            : language === 'hindi'
              ? `${name} का कुल बाकी ${formatPaise(bal)} है।`
              : `${name} ka kul baaki ${formatPaise(bal)} hai.`,
        );
      } else {
        pushBot(parsed.clarification_question ?? parsed.bot_reply_text);
      }
      return;
    }

    if (parsed.intent === 'list_overdue') {
      const pending = customers
        .map((c) => ({ c, bal: customerBalances.get(c.id)?.balance ?? 0 }))
        .filter((x) => x.bal > 0)
        .sort((a, b) => b.bal - a.bal)
        .slice(0, 8);
      pushBot(
        pending.length
          ? `Udhaar baaki:\n${pending.map((x) => `• ${x.c.name}: ${formatPaise(x.bal)}`).join('\n')}`
          : 'Kisi ka udhaar baaki nahi hai. 🎉',
      );
      return;
    }

    if (parsed.intent === 'summary') {
      pushBot(
        `Aaj ka hisaab:\n• Bikri: ${formatPaise(todaySummary.sales_paise)}\n• Naya udhaar: ${formatPaise(todaySummary.credit_given_paise)}\n• Vasooli: ${formatPaise(todaySummary.recovered_paise)}`,
      );
      return;
    }

    pushBot(parsed.bot_reply_text);
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      try {
        setIsProcessing(true);
        const recording = await stopRecording();
        setMessages((prev) => [
          ...prev,
          {
            id: `usr-${Date.now()}`,
            sender: 'user',
            timestamp: new Date().toISOString(),
            audioBlobUrl: URL.createObjectURL(recording.blob),
            audioDuration: recording.duration,
            text: recording.transcript ? `🎤 "${recording.transcript}"` : '🎤 Voice note',
            status: 'sent',
          },
        ]);
        const parsed = await parseKhataMessage({
          audioBase64: recording.base64,
          audioMimeType: recording.mimeType,
          text: recording.transcript,
          customers,
          language,
        });
        handleParsedResponse(parsed, 'voice');
      } catch {
        pushBot('Awaaz record nahi ho payi. Dobara koshish karein ya type karein.');
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        setMicError(null);
        await startRecording();
      } catch {
        setMicError('Microphone ki permission nahi mili. Browser settings mein allow karein, ya type karein.');
      }
    }
  };

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isProcessing) return;
    setInputText('');
    setMessages((prev) => [...prev, { id: `usr-${Date.now()}`, sender: 'user', timestamp: new Date().toISOString(), text, status: 'sent' }]);
    setIsProcessing(true);
    try {
      handleParsedResponse(await parseKhataMessage({ text, customers, language }), 'text');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  /** Why the card cannot be saved yet (null = ready). */
  const draftProblem = (d: Draft): string | null => {
    const paise = parseRupeeInput(d.amountInput);
    if (paise === null || paise <= 0) return 'Rashi daaliye';
    if (d.type !== 'sale') {
      if (!d.customerId) return 'Grahak chuniye';
      if (d.customerId === NEW_CUSTOMER && !d.newCustomerName.trim()) return 'Naye grahak ka naam likhiye';
    }
    return null;
  };

  /** Owner tapped "Haan, sahi hai": the only place a voice/text entry is saved. */
  const handleConfirmSave = (msg: ChatMessage) => {
    const d = drafts[msg.id];
    if (!d || draftProblem(d)) return;
    const amount_paise = parseRupeeInput(d.amountInput)!;

    let customerId: string | null = null;
    let name = 'Counter';
    if (d.type !== 'sale') {
      if (d.customerId === NEW_CUSTOMER) {
        // No phone number is stored for customers created by voice, so no consent is needed yet.
        const created = onAddCustomer({ name: d.newCustomerName.trim(), phone: '', note: 'Voice entry se add kiya', consent_given_at: null });
        customerId = created.id;
        name = created.name;
      } else {
        customerId = d.customerId;
        name = customerName(customerId) ?? 'Grahak';
      }
    }

    onAddTransaction({
      customer_id: customerId,
      type: d.type,
      amount_paise,
      note: d.note.trim() || (d.type === 'credit' ? 'Udhaar saman' : d.type === 'payment' ? 'Payment jama' : 'Counter bikri'),
      source: msg.entrySource ?? 'text',
    });

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, confirmed: true } : m)));
    setEditingCardId(null);

    if (d.type === 'sale') {
      pushBot(`✅ ${formatPaise(amount_paise)} aaj ki bikri mein jod diya. Aaj ki kul bikri: ${formatPaise(todaySummary.sales_paise + amount_paise)}.`);
    } else {
      const before = customerId ? customerBalances.get(customerId)?.balance ?? 0 : 0;
      const after = d.type === 'credit' ? before + amount_paise : before - amount_paise;
      pushBot(
        `✅ ${name} ke khate mein ${formatPaise(amount_paise)} ${d.type === 'credit' ? 'udhaar likh diya' : 'jama ho gaya'}. Naya baaki: ${formatPaise(after)}.`,
        customerId ? { receipt: { customerId, type: d.type, amountPaise: amount_paise, balancePaise: after } } : {},
      );
    }
  };

  const handleCancelCard = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, cancelled: true } : m)));
    setEditingCardId(null);
  };

  const handleShelfPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessing(true);
    try {
      const photo = await preparePhoto(file);
      setMessages((prev) => [
        ...prev,
        { id: `usr-img-${Date.now()}`, sender: 'user', timestamp: new Date().toISOString(), imagePreviewUrl: photo.thumbnail, text: '📸 Shelf photo', status: 'sent' },
      ]);
      const analysis = await analyzeShelfImage({
        imageBase64: photo.upload.split(',')[1],
        imageMimeType: 'image/jpeg',
        catalog,
        previousScanSummary: previousScanNotes,
      });
      if (analysis.error) {
        pushBot(`⚠️ ${analysis.error}`);
        return;
      }
      if (analysis.products.length > 0) {
        onAddScan({
          image_ref: photo.thumbnail,
          overall_notes: analysis.overall_notes,
          quality_warning: analysis.image_quality_warning ?? null,
          detected_items: analysis.products,
        });
      }
      const flagged = analysis.products.filter((p) => p.status === 'out' || p.status === 'low');
      let reply = analysis.overall_notes || 'Photo check ho gayi.';
      if (analysis.image_quality_warning) reply = `⚠️ ${analysis.image_quality_warning}\n\n${reply}`;
      if (flagged.length) {
        reply += `\n\n*Khatam / kam stock:*\n${flagged.map((p) => `• ${p.name}: ${p.status === 'out' ? 'KHATAM' : 'KAM'}`).join('\n')}`;
        reply += '\n\nReorder list Stock tab mein banayein.';
      }
      pushBot(reply);
    } catch {
      pushBot('⚠️ Photo process nahi hui. Dobara koshish karein.');
    } finally {
      setIsProcessing(false);
    }
  };

  const sortedCustomerOptions = (p: AiParsedKhata) => {
    const suggested = p.candidate_customer_ids
      .map((id) => customers.find((c) => c.id === id))
      .filter((c): c is Customer => Boolean(c));
    const rest = customers.filter((c) => !p.candidate_customer_ids.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    return { suggested, rest };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-5.5rem)] max-w-4xl mx-auto bg-[#F2F8F5] rounded-3xl overflow-hidden shadow-xs border border-emerald-100 relative">
      <div className="bg-[#0B3D2E] text-white px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] text-[#0B3D2E] flex items-center justify-center font-black">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-tight">{t.title}</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#25D366]" />
              <span>WhatsApp-style simulation • voice, text & photo</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              newChat();
              setEditingCardId(null);
              setIsHistoryOpen(false);
            }}
            className="p-2 rounded-full hover:bg-white/10 text-emerald-100"
            title="Naya chat"
            aria-label="Naya chat"
          >
            <SquarePen className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsHistoryOpen((v) => !v)}
            className={`p-2 rounded-full hover:bg-white/10 text-emerald-100 ${isHistoryOpen ? 'bg-white/15' : ''}`}
            title="Purane chat"
            aria-label="Purane chat"
          >
            <History className="w-5 h-5" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-white/10 text-emerald-100" title="Shelf photo bhejein">
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleShelfPhotoUpload} />
      </div>

      {isHistoryOpen && (
        <div className="absolute inset-x-0 top-[64px] bottom-0 z-20 flex">
          <div className="w-full sm:w-80 bg-white border-r border-emerald-100 shadow-xl flex flex-col">
            <div className="p-3 border-b border-emerald-50 flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0B3D2E] uppercase tracking-wider">Purane chat</span>
              <button
                onClick={() => {
                  newChat();
                  setEditingCardId(null);
                  setIsHistoryOpen(false);
                }}
                className="text-xs font-bold text-[#1F7A5C] flex items-center gap-1 hover:underline"
              >
                <SquarePen className="w-3.5 h-3.5" /> Naya chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations
                .filter((c) => c.id === activeId || c.messages.some((m) => m.sender === 'user'))
                .map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer ${
                      c.id === activeId ? 'bg-[#DDF3E7]' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      openChat(c.id);
                      setEditingCardId(null);
                      setIsHistoryOpen(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#123D31] truncate">{c.title}</p>
                      <p className="text-[10px] text-[#5F7A6E]">
                        {formatRelativeDate(c.updated_at, language)} • {c.messages.filter((m) => m.sender === 'user').length} message
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Yeh chat delete karein? (Khate ki entries delete nahi hongi)')) deleteChat(c.id);
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Chat delete karein"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
            <p className="p-3 text-[10px] text-gray-400 border-t border-gray-100">
              Chat sirf is phone/browser mein save hote hain. Logout par mit jaate hain.
            </p>
          </div>
          <div className="flex-1 bg-black/20 hidden sm:block" onClick={() => setIsHistoryOpen(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[radial-gradient(#d6e8de_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const parsed = msg.parsedKhata;
          const draft = drafts[msg.id];
          const problem = draft ? draftProblem(draft) : null;
          const isEditing = editingCardId === msg.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-[88%] sm:max-w-[78%]`}>
              <div
                className={`p-3.5 rounded-2xl shadow-xs text-xs sm:text-sm leading-relaxed ${
                  isUser ? 'bg-[#DDF3E7] text-[#0B3D2E] rounded-tr-xs border border-emerald-200' : 'bg-white text-[#123D31] rounded-tl-xs border border-emerald-100'
                }`}
              >
                {msg.audioBlobUrl && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-white/60 border border-emerald-200">
                    <Volume2 className="w-4 h-4 text-[#1F7A5C]" />
                    <audio src={msg.audioBlobUrl} controls className="h-7 w-48 max-w-full" />
                  </div>
                )}
                {msg.imagePreviewUrl && (
                  <img src={msg.imagePreviewUrl} alt="Shelf photo" className="w-56 h-40 object-cover rounded-xl mb-2 border border-emerald-200" />
                )}
                {msg.text && <p className="whitespace-pre-line font-medium font-devanagari">{msg.text}</p>}

                {parsed && draft && !msg.confirmed && !msg.cancelled && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-[#F2F8F5] border-2 border-[#25D366]/40 text-xs text-[#123D31]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-[#0B3D2E] uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#25D366]" /> Sahi hai?
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${parsed.confidence >= 0.85 ? 'bg-[#0B3D2E] text-white' : 'bg-amber-200 text-amber-900'}`}>
                        {parsed.confidence >= 0.85 ? 'Pakka match' : 'Check karein'}
                      </span>
                    </div>
                    {parsed.transcript && (
                      <p className="text-[10px] text-[#5F7A6E] italic mb-2">Suna: "{parsed.transcript}"</p>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600">Type</label>
                          <select
                            value={draft.type}
                            onChange={(e) => updateDraft(msg.id, { type: e.target.value as TransactionType })}
                            className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs"
                          >
                            <option value="credit">Udhaar diya (+ baaki)</option>
                            <option value="payment">Jama / payment mila (− baaki)</option>
                            <option value="sale">Counter bikri (grahak nahi)</option>
                          </select>
                        </div>
                        {draft.type !== 'sale' && (
                          <div>
                            <label className="text-[10px] font-bold text-gray-600">Grahak</label>
                            {(() => {
                              const { suggested, rest } = sortedCustomerOptions(parsed);
                              return (
                                <select
                                  value={draft.customerId}
                                  onChange={(e) => updateDraft(msg.id, { customerId: e.target.value })}
                                  className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold"
                                >
                                  <option value="">— Grahak chuniye —</option>
                                  {suggested.length > 0 && (
                                    <optgroup label="Milte-julte naam">
                                      {suggested.map((c) => (
                                        <option key={c.id} value={c.id}>{customerLabel(c)}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="Sabhi grahak">
                                    {rest.map((c) => (
                                      <option key={c.id} value={c.id}>{customerLabel(c)}</option>
                                    ))}
                                  </optgroup>
                                  <option value={NEW_CUSTOMER}>+ Naya grahak banayein</option>
                                </select>
                              );
                            })()}
                            {draft.customerId === NEW_CUSTOMER && (
                              <input
                                type="text"
                                value={draft.newCustomerName}
                                onChange={(e) => updateDraft(msg.id, { newCustomerName: e.target.value })}
                                placeholder="Naye grahak ka naam"
                                className="w-full mt-1 p-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold"
                              />
                            )}
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-bold text-gray-600">Rashi (₹)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={draft.amountInput}
                            onChange={(e) => updateDraft(msg.id, { amountInput: e.target.value })}
                            className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-600">Saman / note</label>
                          <input
                            type="text"
                            value={draft.note}
                            onChange={(e) => updateDraft(msg.id, { note: e.target.value })}
                            className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs"
                          />
                        </div>
                        <button
                          onClick={() => setEditingCardId(null)}
                          disabled={Boolean(problem)}
                          className="w-full py-1.5 bg-[#0B3D2E] text-white font-bold rounded-lg text-xs disabled:opacity-40"
                        >
                          {problem ?? 'Badlav dekhein'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5 my-2">
                          {draft.type !== 'sale' && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[#5F7A6E]">Grahak:</span>
                              <span className="font-extrabold text-[#0B3D2E] text-right">
                                {draft.customerId === NEW_CUSTOMER
                                  ? `${draft.newCustomerName} (naya)`
                                  : customerName(draft.customerId) ?? <span className="text-rose-600">Chuna nahi gaya</span>}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-[#5F7A6E]">Rashi:</span>
                            <span className={`font-black text-sm ${draft.type === 'credit' ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {parseRupeeInput(draft.amountInput) !== null ? formatPaise(parseRupeeInput(draft.amountInput)) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#5F7A6E]">Type:</span>
                            <span className="font-bold">
                              {draft.type === 'payment' ? 'Jama (payment)' : draft.type === 'sale' ? 'Counter bikri' : 'Udhaar (credit)'}
                            </span>
                          </div>
                          {draft.note && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[#5F7A6E]">Saman:</span>
                              <span className="italic text-right">{draft.note}</span>
                            </div>
                          )}
                        </div>
                        {(() => {
                          const cust = draft.type === 'credit' ? customers.find((c) => c.id === draft.customerId) : undefined;
                          const amt = parseRupeeInput(draft.amountInput) ?? 0;
                          const bal = cust ? customerBalances.get(cust.id)?.balance ?? 0 : 0;
                          return cust?.credit_limit_paise && amt > 0 && bal + amt > cust.credit_limit_paise ? (
                            <p className="text-[11px] font-bold text-amber-800 mb-2">
                              ⚠️ Iske baad baaki {formatPaise(bal + amt)} hoga — aapki seema {formatPaise(cust.credit_limit_paise)} se zyada.
                            </p>
                          ) : null;
                        })()}
                        {problem && (
                          <p className="flex items-center gap-1 text-[11px] font-bold text-amber-800 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" /> {problem} — "Badlo" dabayein
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
                          <button
                            onClick={() => handleConfirmSave(msg)}
                            disabled={Boolean(problem)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-extrabold text-xs flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>{t.btnConfirm}</span>
                          </button>
                          <button
                            onClick={() => setEditingCardId(msg.id)}
                            className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 text-[#1F7A5C] font-bold text-xs flex items-center gap-1 border border-emerald-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{t.btnEdit}</span>
                          </button>
                          <button
                            onClick={() => handleCancelCard(msg.id)}
                            className="py-2 px-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs border border-rose-200"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {msg.confirmed && (
                  <div className="mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Khate mein save ho gaya
                  </div>
                )}
                {msg.receipt && (() => {
                  const r = msg.receipt;
                  const cust = customers.find((c) => c.id === r.customerId);
                  if (!cust?.receipts_opt_in || !cust.phone || !cust.consent_given_at) return null;
                  return (
                    <button
                      disabled={r.sent}
                      onClick={() => {
                        const text = buildReceiptMessage({
                          type: r.type,
                          amountPaise: r.amountPaise,
                          balancePaise: r.balancePaise,
                          shopName: profile.name,
                          language: profile.reminder_settings.language,
                          statementUrl: cust.statement_key ? statementUrl(window.location.origin, profile.id, cust.id, cust.statement_key) : null,
                        });
                        const url = createWhatsAppUrl(cust.phone, text);
                        if (url) window.open(url, '_blank', 'noopener');
                        setMessages((prev) => prev.map((m) => (m.id === msg.id && m.receipt ? { ...m, receipt: { ...m.receipt, sent: true } } : m)));
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-[#25D366] text-[#0B3D2E] text-[11px] font-bold disabled:opacity-50"
                    >
                      {r.sent ? 'Receipt WhatsApp mein khola ✓' : '🧾 Receipt bhejein (WhatsApp)'}
                    </button>
                  );
                })()}
                {msg.cancelled && (
                  <div className="mt-2 text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Cancel kiya — kuch save nahi hua
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-[#5F7A6E]">
                <span>{formatTime(msg.timestamp)}</span>
                {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl w-fit shadow-xs border border-emerald-100 text-xs text-[#1F7A5C] font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-[#25D366]" />
            <span>{t.processing}</span>
          </div>
        )}
        {micError && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2">{micError}</p>}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-2 bg-white border-t border-emerald-50 flex gap-1.5 overflow-x-auto no-scrollbar">
        {t.chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendText(chip)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#DDF3E7] hover:bg-[#c6ebd6] text-[#0B3D2E] text-xs font-semibold border border-emerald-200/80 shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>

      {isRecording && (
        <div className="absolute inset-0 bg-[#0B3D2E]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-white">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-[#25D366]/20 animate-ping absolute inset-0" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#25D366] to-[#1F7A5C] flex items-center justify-center shadow-2xl relative z-10">
              <Mic className="w-12 h-12 animate-pulse" />
            </div>
          </div>
          <h4 className="text-xl font-black mb-1">{t.listening}</h4>
          <p className="text-sm text-emerald-200 mb-4 font-mono font-bold">
            00:{recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration}
          </p>
          <div className="flex items-center gap-1.5 h-12 mb-6">
            {audioLevels.map((lvl, i) => (
              <div key={i} className="w-2 bg-[#25D366] rounded-full transition-all duration-75" style={{ height: `${Math.max(12, lvl)}%` }} />
            ))}
          </div>
          {speechTranscript && (
            <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-xs max-w-xs text-center mb-6">
              <span className="text-[#F5A623] font-bold block mb-1">Maine suna:</span>
              <p className="italic">"{speechTranscript}"</p>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button onClick={cancelRecording} className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold text-xs flex items-center gap-1.5">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={handleToggleRecording}
              className="px-6 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-black text-xs flex items-center gap-2 shadow-lg"
            >
              <StopCircle className="w-4 h-4" /> Ho gaya
            </button>
          </div>
        </div>
      )}

      <div className="p-2.5 bg-white border-t border-emerald-100 flex items-center gap-2">
        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl text-emerald-800 hover:bg-emerald-50" title="Shelf photo">
          <Camera className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          placeholder={t.placeholder}
          className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#F2F8F5] border border-emerald-200/80 focus:outline-none focus:ring-2 focus:ring-[#25D366] text-xs sm:text-sm text-[#123D31]"
        />
        {inputText.trim() ? (
          <button
            onClick={() => handleSendText()}
            disabled={isProcessing}
            className="w-10 h-10 rounded-full bg-[#25D366] text-[#0B3D2E] flex items-center justify-center hover:bg-[#20ba59]"
          >
            <Send className="w-4 h-4 fill-[#0B3D2E]" />
          </button>
        ) : (
          <button
            onClick={handleToggleRecording}
            className="w-10 h-10 rounded-full bg-[#0B3D2E] text-white flex items-center justify-center hover:bg-[#124b39]"
            title="Bolne ke liye dabayein"
          >
            <Mic className="w-5 h-5 text-[#25D366]" />
          </button>
        )}
      </div>
    </div>
  );
};
