import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode as QrIcon, Copy, Check, Share2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { createUpiUri, createWhatsAppUrl } from '../../utils/whatsapp';

interface UpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone?: string;
  amount: number;
  shopName: string;
  upiId: string;
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  amount,
  shopName,
  upiId,
}) => {
  const [customAmount, setCustomAmount] = useState<number>(amount);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCustomAmount(amount);
  }, [amount]);

  useEffect(() => {
    if (!isOpen) return;

    const uri = createUpiUri(upiId, shopName, customAmount || amount, `Udhaar_${customerName}`);
    QRCode.toDataURL(uri, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0B3D2E',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [isOpen, upiId, shopName, customAmount, amount, customerName]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const uri = createUpiUri(upiId, shopName, customAmount || amount, 'Udhaar_Payment');
    const msg = `Namaste ${customerName} ji! ${shopName} ka hisab ₹${customAmount || amount} clear karne ke liye UPI QR link: ${uri}`;
    const url = createWhatsAppUrl(customerPhone || '', msg);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col text-center">
        {/* Header */}
        <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-[#25D366]" />
            <h3 className="font-bold text-sm">UPI Payment QR</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Body */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-[#5F7A6E]">Customer</p>
            <h4 className="text-base font-bold text-[#123D31]">{customerName}</h4>
          </div>

          {/* Amount input */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-bold text-[#0B3D2E]">₹</span>
            <input
              type="number"
              min="1"
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value) || 0)}
              className="w-32 text-center text-2xl font-black text-[#0B3D2E] border-b-2 border-[#25D366] focus:outline-none focus:border-[#0B3D2E] py-1"
            />
          </div>

          {/* Rendered QR Card */}
          <div className="bg-[#F2F8F5] p-4 rounded-2xl border border-emerald-100 inline-block mx-auto shadow-inner">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI QR Code" className="w-52 h-52 mx-auto rounded-lg shadow-xs" />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs text-gray-400">
                Generating QR Code...
              </div>
            )}
            <p className="text-[11px] font-bold text-[#1F7A5C] mt-2">
              Google Pay • PhonePe • Paytm • BHIM
            </p>
          </div>

          {/* UPI ID pill */}
          <div className="flex items-center justify-between bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 text-xs">
            <span className="font-mono text-gray-700 truncate">{upiId}</span>
            <button
              onClick={handleCopyUpi}
              className="text-[#1F7A5C] font-semibold flex items-center gap-1 hover:text-[#0B3D2E]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* WhatsApp share CTA */}
          {customerPhone && (
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0B3D2E] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Grahak ko WhatsApp par link bhejo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
