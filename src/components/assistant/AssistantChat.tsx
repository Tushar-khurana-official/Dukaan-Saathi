import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Send,
  Camera,
  Check,
  CheckCheck,
  X,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  StopCircle,
  Volume2,
} from 'lucide-react';
import {
  AiParsedKhata,
  ChatMessage,
  Customer,
  Language,
  Product,
  ShopProfile,
  Transaction,
} from '../../types';
import { formatINR, formatTime } from '../../utils/formatters';
import { translations } from '../../utils/translations';
import { parseKhataMessage, analyzeShelfImage } from '../../services/api';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface AssistantChatProps {
  profile: ShopProfile;
  language: Language;
  customers: Customer[];
  customerBalances: Map<string, { balance: number; lastTxDate?: string }>;
  catalog: Product[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => Transaction;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'created_at'>) => Customer;
  onOpenShelfScan: () => void;
  externalVoiceTrigger?: boolean;
  onResetVoiceTrigger?: () => void;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  profile,
  language,
  customers,
  customerBalances,
  catalog,
  onAddTransaction,
  onAddCustomer,
  onOpenShelfScan,
  externalVoiceTrigger,
  onResetVoiceTrigger,
}) => {
  const t = translations[language].assistant;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      text:
        language === 'hindi'
          ? 'नमस्ते! मैं आपका दुकान साथी हूँ। आप बोलकर या लिखकर नया उधार, भुगतान या बकाया पूछ सकते हैं।'
          : 'Namaste! Main aapka Dukaan Saathi hoon. Boliye ya type karein: jaise "Sharma ji ko 500 udhaar, saman ka" ya "Gupta ji ne 300 diye".',
      status: 'read',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Editable confirmation card state
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editType, setEditType] = useState<'credit' | 'payment'>('credit');
  const [editNote, setEditNote] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recorder Hook
  const {
    isRecording,
    recordingDuration,
    audioLevels,
    speechTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording, isProcessing]);

  // Handle external voice trigger (from mobile nav or desktop CTA)
  useEffect(() => {
    if (externalVoiceTrigger && !isRecording) {
      handleToggleRecording();
      if (onResetVoiceTrigger) onResetVoiceTrigger();
    }
  }, [externalVoiceTrigger]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      try {
        setIsProcessing(true);
        const recording = await stopRecording();

        // Add user voice note bubble
        const userMsgId = `usr-${Date.now()}`;
        const audioUrl = URL.createObjectURL(recording.blob);
        setMessages((prev) => [
          ...prev,
          {
            id: userMsgId,
            sender: 'user',
            timestamp: new Date().toISOString(),
            audioBlobUrl: audioUrl,
            audioDuration: recording.duration,
            text: speechTranscript ? `🎤 "${speechTranscript}"` : '🎤 Voice Note',
            status: 'sent',
          },
        ]);

        // Call Gemini server parse-khata
        const parsed = await parseKhataMessage({
          audioBase64: recording.base64,
          audioMimeType: recording.mimeType,
          text: speechTranscript,
          customers,
          language,
        });

        handleParsedResponse(parsed);
      } catch (err) {
        console.error('Audio capture error:', err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error('Mic access denied:', err);
      }
    }
  };

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setInputText('');

    // Add user text message
    const userMsgId = `usr-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        timestamp: new Date().toISOString(),
        text,
        status: 'sent',
      },
    ]);

    setIsProcessing(true);

    try {
      // Check for quick balance queries directly
      const lower = text.toLowerCase();
      if (lower.includes('baaki') || lower.includes('kitna') || lower.includes('balance')) {
        const foundCust = customers.find((c) =>
          lower.includes(c.name.toLowerCase().split(' ')[0])
        );
        if (foundCust) {
          const bal = customerBalances.get(foundCust.id)?.balance || 0;
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              sender: 'bot',
              timestamp: new Date().toISOString(),
              text: `${foundCust.name} ka kul baaki hisaab ${formatINR(bal)} hai.`,
              status: 'read',
            },
          ]);
          setIsProcessing(false);
          return;
        }
      }

      // Parse with Gemini
      const parsed = await parseKhataMessage({
        text,
        customers,
        language,
      });

      handleParsedResponse(parsed);
    } catch (e) {
      console.error('Parse text error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParsedResponse = (parsed: AiParsedKhata) => {
    // If intent requires confirmation (add_credit or add_payment)
    if (parsed.intent === 'add_credit' || parsed.intent === 'add_payment') {
      const cardMsgId = `bot-card-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: cardMsgId,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          text: parsed.bot_reply_text,
          parsedKhata: parsed,
          confirmed: false,
          status: 'read',
        },
      ]);
      // Initialize edit form
      setEditCustomerName(parsed.customer_name);
      setEditAmount(parsed.amount || 0);
      setEditType(parsed.intent === 'add_credit' ? 'credit' : 'payment');
      setEditNote(parsed.items_note || '');
    } else {
      // Information or query intent
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          text: parsed.bot_reply_text,
          status: 'read',
        },
      ]);
    }
  };

  // User clicks "Haan, Sahi Hai" on confirmation card
  const handleConfirmSave = (msgId: string, parsed: AiParsedKhata) => {
    let customerId = parsed.matched_customer_id;
    let customerName = parsed.customer_name;

    // Check if customer exists or create new
    if (!customerId) {
      const match = customers.find(
        (c) => c.name.toLowerCase() === parsed.customer_name.toLowerCase()
      );
      if (match) {
        customerId = match.id;
      } else {
        const newCust = onAddCustomer({
          name: parsed.customer_name || 'Grahak',
          phone: '',
          note: 'Voice entry se add kiya gaya',
        });
        customerId = newCust.id;
        customerName = newCust.name;
      }
    }

    const txType = parsed.intent === 'add_payment' ? 'payment' : 'credit';
    const amount = parsed.amount || 0;

    // Add to ledger!
    onAddTransaction({
      customer_id: customerId,
      type: txType,
      amount,
      note: parsed.items_note || (txType === 'credit' ? 'Udhaar Saman' : 'Payment Jama'),
      source: 'voice',
    });

    // Mark card as confirmed
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, confirmed: true } : m
      )
    );

    // Compute updated balance
    const currentInfo = customerBalances.get(customerId) || { balance: 0 };
    const newBalance =
      txType === 'credit' ? currentInfo.balance + amount : currentInfo.balance - amount;

    // Send confirmation bot message
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-conf-${Date.now()}`,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          text: `✅ ${customerName} ke khate mein ${formatINR(amount)} ${
            txType === 'credit' ? 'udhaar jod diya' : 'jama ho gaya'
          }. Naya baaki: ${formatINR(newBalance)}.`,
          status: 'read',
        },
      ]);
    }, 300);
  };

  // User edits details on confirmation card
  const handleSaveEditedCard = (msgId: string) => {
    const updatedParsed: AiParsedKhata = {
      transcript: editCustomerName,
      intent: editType === 'credit' ? 'add_credit' : 'add_payment',
      customer_name: editCustomerName,
      matched_customer_id: null,
      amount: editAmount,
      items_note: editNote,
      confidence: 1.0,
      needs_clarification: false,
      clarification_question: null,
      bot_reply_text: `Updated entry for ${editCustomerName}: ${formatINR(editAmount)}`,
    };

    setEditingCardId(null);
    handleConfirmSave(msgId, updatedParsed);
  };

  const handleCancelCard = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setEditingCardId(null);
  };

  // Camera Shelf Image Upload in Chat
  const handleShelfPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];

      // Add image message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-img-${Date.now()}`,
          sender: 'user',
          timestamp: new Date().toISOString(),
          imagePreviewUrl: dataUrl,
          text: '📸 Shelf Photo',
          status: 'sent',
        },
      ]);

      setIsProcessing(true);

      try {
        const analysis = await analyzeShelfImage({
          imageBase64: base64,
          imageMimeType: file.type,
          catalog,
        });

        const lowOrOut = analysis.products.filter(
          (p: any) => p.status === 'out' || p.status === 'low'
        );

        let replyText = analysis.overall_notes;
        if (lowOrOut.length > 0) {
          replyText += `\n\n*Low ya Out of Stock SKUs:*\n` +
            lowOrOut.map((p: any) => `• *${p.name}*: ${p.status.toUpperCase()} (${p.note})`).join('\n');
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-shelf-${Date.now()}`,
            sender: 'bot',
            timestamp: new Date().toISOString(),
            text: replyText,
            status: 'read',
          },
        ]);
      } catch (err) {
        console.error('Shelf photo parse failed:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-5.5rem)] max-w-4xl mx-auto bg-[#F2F8F5] rounded-3xl overflow-hidden shadow-xs border border-emerald-100 relative">
      {/* WhatsApp Header bar */}
      <div className="bg-[#0B3D2E] text-white px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] text-[#0B3D2E] flex items-center justify-center font-black">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-tight">{t.title}</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
              <span>Online • Voice, Hindi & Photo enabled</span>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-white/10 text-emerald-100"
            title="Attach Shelf Photo"
          >
            <Camera className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleShelfPhotoUpload}
          />
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[radial-gradient(#d6e8de_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Date separator */}
        <div className="flex justify-center my-1">
          <span className="bg-[#DDF3E7] text-[#0B3D2E] text-[10px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wider">
            Aaj Ka Hisaab
          </span>
        </div>

        {/* Chat Bubbles */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[78%] ${
                isUser ? 'ml-auto' : 'mr-auto'
              }`}
            >
              {/* Main message bubble */}
              <div
                className={`p-3.5 rounded-2xl shadow-xs text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#DDF3E7] text-[#0B3D2E] rounded-tr-xs border border-emerald-200'
                    : 'bg-white text-[#123D31] rounded-tl-xs border border-emerald-100'
                }`}
              >
                {/* Audio voice note player representation */}
                {msg.audioBlobUrl && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-white/60 border border-emerald-200">
                    <Volume2 className="w-4 h-4 text-[#1F7A5C]" />
                    <audio src={msg.audioBlobUrl} controls className="h-7 w-48 max-w-full" />
                  </div>
                )}

                {/* Attached Photo */}
                {msg.imagePreviewUrl && (
                  <img
                    src={msg.imagePreviewUrl}
                    alt="Shelf capture"
                    className="w-56 h-40 object-cover rounded-xl mb-2 border border-emerald-200 shadow-xs"
                  />
                )}

                {/* Text Content */}
                {msg.text && (
                  <p className="whitespace-pre-line font-medium font-devanagari">{msg.text}</p>
                )}

                {/* Confirmation Card (Sahi Hai? / Badlo / Cancel) */}
                {msg.parsedKhata && !msg.confirmed && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-[#F2F8F5] border-2 border-[#25D366]/40 text-xs text-[#123D31]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-[#0B3D2E] uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#25D366]" />
                        <span>Sahi Hai? (Verify Entry)</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0B3D2E] text-white">
                        {Math.round(msg.parsedKhata.confidence * 100)}% match
                      </span>
                    </div>

                    {editingCardId === msg.id ? (
                      /* Editing Form */
                      <div className="space-y-2 mt-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600">Grahak Naam</label>
                          <input
                            type="text"
                            value={editCustomerName}
                            onChange={(e) => setEditCustomerName(e.target.value)}
                            className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-600">Rashi (₹)</label>
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(Number(e.target.value) || 0)}
                              className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-600">Type</label>
                            <select
                              value={editType}
                              onChange={(e) => setEditType(e.target.value as any)}
                              className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs"
                            >
                              <option value="credit">Udhaar (+)</option>
                              <option value="payment">Jama (-)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-600">Items / Note</label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full p-1.5 rounded-lg border border-emerald-200 bg-white text-xs"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleSaveEditedCard(msg.id)}
                            className="flex-1 py-1.5 bg-[#25D366] text-[#0B3D2E] font-bold rounded-lg text-xs"
                          >
                            Save Updates
                          </button>
                          <button
                            onClick={() => setEditingCardId(null)}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Confirmation Details */
                      <>
                        <div className="space-y-1.5 my-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#5F7A6E]">Customer:</span>
                            <span className="font-extrabold text-[#0B3D2E]">
                              {msg.parsedKhata.customer_name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#5F7A6E]">Rashi:</span>
                            <span
                              className={`font-black text-sm ${
                                msg.parsedKhata.intent === 'add_payment'
                                  ? 'text-emerald-700'
                                  : 'text-rose-600'
                              }`}
                            >
                              {formatINR(msg.parsedKhata.amount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#5F7A6E]">Type:</span>
                            <span className="font-bold text-[#123D31]">
                              {msg.parsedKhata.intent === 'add_payment'
                                ? 'Payment (Jama)'
                                : 'Udhaar (Credit)'}
                            </span>
                          </div>
                          {msg.parsedKhata.items_note && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[#5F7A6E]">Saman:</span>
                              <span className="font-medium text-[#123D31] italic">
                                {msg.parsedKhata.items_note}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
                          <button
                            onClick={() => handleConfirmSave(msg.id, msg.parsedKhata!)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-extrabold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>{t.btnConfirm}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingCardId(msg.id);
                              setEditCustomerName(msg.parsedKhata!.customer_name);
                              setEditAmount(msg.parsedKhata!.amount || 0);
                              setEditType(
                                msg.parsedKhata!.intent === 'add_payment' ? 'payment' : 'credit'
                              );
                              setEditNote(msg.parsedKhata!.items_note || '');
                            }}
                            className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 text-[#1F7A5C] font-bold text-xs flex items-center justify-center gap-1 border border-emerald-200 active:scale-95 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{t.btnEdit}</span>
                          </button>
                          <button
                            onClick={() => handleCancelCard(msg.id)}
                            className="py-2 px-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs border border-rose-200 active:scale-95 transition-all"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Confirmed Badge */}
                {msg.confirmed && (
                  <div className="mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ledger mein save ho chuka hai</span>
                  </div>
                )}
              </div>

              {/* Timestamp & double ticks */}
              <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-[#5F7A6E]">
                <span>{formatTime(msg.timestamp)}</span>
                {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl w-fit shadow-xs border border-emerald-100 text-xs text-[#1F7A5C] font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-[#25D366]" />
            <span>{t.processing}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      <div className="px-3 py-2 bg-white border-t border-emerald-50 flex gap-1.5 overflow-x-auto no-scrollbar">
        {t.chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendText(chip)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#DDF3E7] hover:bg-[#c6ebd6] text-[#0B3D2E] text-xs font-semibold border border-emerald-200/80 shrink-0 transition-transform active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Active Voice Recording Modal Overlay */}
      {isRecording && (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-[#0B3D2E]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-white animate-in fade-in">
          {/* Animated pulsing mic ring */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-[#25D366]/20 animate-ping absolute inset-0" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#25D366] to-[#1F7A5C] flex items-center justify-center text-white shadow-2xl relative z-10">
              <Mic className="w-12 h-12 animate-pulse" />
            </div>
          </div>

          <h4 className="text-xl font-black mb-1">{t.listening}</h4>
          <p className="text-sm text-emerald-200 mb-4 font-mono font-bold">
            00:{recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration}
          </p>

          {/* Live Waveform Bars */}
          <div className="flex items-center gap-1.5 h-12 mb-6">
            {audioLevels.map((lvl, i) => (
              <div
                key={i}
                className="w-2 bg-[#25D366] rounded-full transition-all duration-75"
                style={{ height: `${Math.max(12, lvl)}%` }}
              />
            ))}
          </div>

          {/* Live Transcript Preview if Web Speech API available */}
          {speechTranscript && (
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-xs text-white max-w-xs text-center mb-6">
              <span className="text-[#F5A623] font-bold block mb-1">Maine suna:</span>
              <p className="italic">"{speechTranscript}"</p>
            </div>
          )}

          {/* Controls: Cancel / Finish */}
          <div className="flex items-center gap-4">
            <button
              onClick={cancelRecording}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            <button
              onClick={handleToggleRecording}
              className="px-6 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-black text-xs flex items-center gap-2 shadow-lg"
            >
              <StopCircle className="w-4 h-4" />
              <span>Done (Hisab Nikalo)</span>
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-2.5 bg-white border-t border-emerald-100 flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl text-emerald-800 hover:bg-emerald-50 transition-colors"
          title="Attach Shelf Photo"
        >
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
            className="w-10 h-10 rounded-full bg-[#25D366] text-[#0B3D2E] flex items-center justify-center hover:bg-[#20ba59] active:scale-95 transition-all shadow-xs"
          >
            <Send className="w-4 h-4 fill-[#0B3D2E]" />
          </button>
        ) : (
          <button
            onClick={handleToggleRecording}
            className="w-10 h-10 rounded-full bg-[#0B3D2E] text-white flex items-center justify-center hover:bg-[#124b39] active:scale-95 transition-all shadow-xs"
            title="Press to speak"
          >
            <Mic className="w-5 h-5 text-[#25D366]" />
          </button>
        )}
      </div>
    </div>
  );
};
