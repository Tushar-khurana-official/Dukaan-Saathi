import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Mic,
  MessageSquare,
  Camera,
  Send,
  BarChart3,
  Sparkles,
  Play,
} from 'lucide-react';
import { NavTab } from './Navigation';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tab: NavTab) => void;
  onRunDemoStep: (stepIndex: number) => void;
}

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
  onRunDemoStep,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      number: '1',
      title: 'Voice Khata Entry',
      icon: Mic,
      targetTab: 'assistant' as NavTab,
      phrase: '"Sharma ji ko 500 udhaar, saman ka"',
      description:
        'Kirana shopkeeper taps the mic or types. The AI parses the customer name, amount (₹500), and note. User confirms "Haan, sahi hai" and ledger updates instantly with an Undo toast.',
      buttonLabel: 'Try Step 1: Voice Khata',
    },
    {
      number: '2',
      title: 'Balance Query & Hindi Parsing',
      icon: MessageSquare,
      targetTab: 'assistant' as NavTab,
      phrase: '"Sharma ji ka kitna baaki hai?"',
      description:
        'Ask in Hindi or Hinglish. AI looks up Sharma Ji in the ledger, checks recent payments, and replies with his exact pending balance and last purchase date.',
      buttonLabel: 'Try Step 2: Balance Query',
    },
    {
      number: '3',
      title: 'AI Shelf Scanner',
      icon: Camera,
      targetTab: 'stock' as NavTab,
      phrase: '"Snap shelf photo -> detect gaps"',
      description:
        'Upload or capture a grocery shelf. Visual AI flags out-of-stock items (Tata Salt) and low stock (Maggi, Fortune Oil) without pretending to count exact units. Compares with previous scan.',
      buttonLabel: 'Try Step 3: Scan Shelf',
    },
    {
      number: '4',
      title: 'WhatsApp UPI Reminder',
      icon: Send,
      targetTab: 'reminders' as NavTab,
      phrase: '"Polite reminder with UPI link"',
      description:
        'Pick an overdue customer. AI generates a respectful WhatsApp reminder with an embedded upi:// link and QR code. Opens real WhatsApp via wa.me link.',
      buttonLabel: 'Try Step 4: Send Reminder',
    },
    {
      number: '5',
      title: 'Dashboard & Impact Metrics',
      icon: BarChart3,
      targetTab: 'home' as NavTab,
      phrase: '"Total Udhaar + Today Recovery"',
      description:
        'Show real financial clarity: Total pending dues, 7-day cash flow charts, and the AI daily 3-line briefing with actionable advice.',
      buttonLabel: 'Try Step 5: View Dashboard',
    },
  ];

  const step = steps[currentStep];
  const Icon = step.icon;

  const handleExecute = () => {
    onNavigateToTab(step.targetTab);
    onRunDemoStep(currentStep);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0B3D2E] via-[#1F7A5C] to-[#0B3D2E] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] text-[#0B3D2E] flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-base">2-Minute Competition Demo Guide</h3>
              <p className="text-xs text-emerald-200">Step-by-step walkthrough for judges & pitches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-[#DDF3E7] px-5 py-3 flex items-center justify-between border-b border-emerald-100">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className="flex items-center gap-1.5 focus:outline-none"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  idx === currentStep
                    ? 'bg-[#0B3D2E] text-white ring-2 ring-[#25D366]'
                    : idx < currentStep
                    ? 'bg-[#25D366] text-[#0B3D2E]'
                    : 'bg-white text-emerald-800'
                }`}
              >
                {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : s.number}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-6 sm:w-10 h-0.5 ${
                    idx < currentStep ? 'bg-[#25D366]' : 'bg-emerald-200'
                  }`}
                />
              )}
            </button>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DDF3E7] text-[#0B3D2E] flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-[#1F7A5C]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#F5A623]">
                Step {currentStep + 1} of 5
              </span>
              <h4 className="text-lg font-extrabold text-[#123D31]">{step.title}</h4>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200">
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
              Sample Voice / Action Phrase:
            </p>
            <p className="text-sm font-bold text-[#0B3D2E] font-devanagari italic">
              {step.phrase}
            </p>
          </div>

          <p className="text-sm text-[#5F7A6E] leading-relaxed">
            {step.description}
          </p>

          {/* Action Trigger Button */}
          <button
            onClick={handleExecute}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#25D366] to-[#1F7A5C] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-98 transition-all"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{step.buttonLabel}</span>
          </button>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 disabled:opacity-30 disabled:pointer-events-none px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Pichla Step</span>
          </button>

          <button
            onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={currentStep === steps.length - 1}
            className="flex items-center gap-1 text-xs font-bold text-[#0B3D2E] disabled:opacity-30 disabled:pointer-events-none px-3 py-2 rounded-lg hover:bg-emerald-50"
          >
            <span>Agla Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
