import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode as QrIcon, Copy, Check, AlertTriangle } from 'lucide-react';
import { formatPaise, paiseToUpiAmount, parseRupeeInput } from '../../lib/money';
import { createUpiUri, isValidUpiId } from '../../lib/reminders';

interface UpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  amountPaise: number;
  shopName: string;
  upiId: string;
}

/** QR shown on the owner's phone at the counter. Payment happens in the customer's UPI app, not here. */
export const UpiQrModal: React.FC<UpiQrModalProps> = ({ isOpen, onClose, customerName, amountPaise, shopName, upiId }) => {
  const [amountInput, setAmountInput] = useState(paiseToUpiAmount(amountPaise));
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const upiOk = isValidUpiId(upiId);
  const paise = parseRupeeInput(amountInput);

  useEffect(() => setAmountInput(paiseToUpiAmount(amountPaise)), [amountPaise, isOpen]);

  useEffect(() => {
    if (!isOpen || !upiOk || !paise || paise <= 0) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(createUpiUri(upiId, shopName, paise), { width: 280, margin: 2, color: { dark: '#0B3D2E', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [isOpen, upiId, shopName, paise, upiOk]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col text-center">
        <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-[#25D366]" />
            <h3 className="font-bold text-sm">UPI QR</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-[#5F7A6E]">Grahak</p>
            <h4 className="text-base font-bold text-[#123D31]">{customerName}</h4>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-bold text-[#0B3D2E]">₹</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-32 text-center text-2xl font-black text-[#0B3D2E] border-b-2 border-[#25D366] focus:outline-none py-1"
            />
          </div>

          {!upiOk ? (
            <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Settings mein sahi UPI ID daaliye (jaise naam@okaxis).
            </p>
          ) : (
            <div className="bg-[#F2F8F5] p-4 rounded-2xl border border-emerald-100 inline-block mx-auto">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`UPI QR for ${paise ? formatPaise(paise) : ''}`} className="w-52 h-52 mx-auto rounded-lg" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-xs text-gray-400">Sahi rashi daaliye</div>
              )}
              <p className="text-[11px] font-bold text-[#1F7A5C] mt-2">Kisi bhi UPI app se scan karein</p>
            </div>
          )}

          <div className="flex items-center justify-between bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 text-xs">
            <span className="font-mono text-gray-700 truncate">{upiId || '—'}</span>
            <button onClick={handleCopyUpi} className="text-[#1F7A5C] font-semibold flex items-center gap-1">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            Paisa aane ke baad Khata mein "Jama Karein" se entry karein. App khud payment check nahi karta.
          </p>
        </div>
      </div>
    </div>
  );
};
