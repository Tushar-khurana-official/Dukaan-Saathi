import React, { useEffect, useState } from 'react';
import { Undo2, CheckCircle2, X } from 'lucide-react';
import { Transaction } from '../../types';
import { formatINR } from '../../utils/formatters';

interface UndoToastProps {
  lastAction: {
    id: string;
    transaction: Transaction;
    timestamp: number;
  } | null;
  onUndo: () => void;
  onDismiss: () => void;
  customerName?: string;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  lastAction,
  onUndo,
  onDismiss,
  customerName = 'Customer',
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!lastAction) return;

    setProgress(100);
    const duration = 5000; // 5 seconds
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [lastAction, onDismiss]);

  if (!lastAction) return null;

  const { transaction } = lastAction;
  const isCredit = transaction.type === 'credit';

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-[#0B3D2E] text-white p-3.5 rounded-2xl shadow-xl border border-emerald-700/60 overflow-hidden relative">
        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-1 bg-[#25D366] transition-all ease-linear"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center flex-shrink-0 text-[#25D366]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-100 truncate">
                {isCredit ? 'Udhaar Entry Saved' : 'Payment Received'}
              </p>
              <p className="text-sm font-bold text-white truncate">
                {customerName}: {formatINR(transaction.amount)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] text-xs font-bold rounded-lg shadow-xs active:scale-95 transition-all"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={onDismiss}
              className="p-1 text-emerald-300 hover:text-white rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
