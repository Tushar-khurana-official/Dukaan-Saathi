import React from 'react';
import { Sparkles, Globe, PlayCircle, Store } from 'lucide-react';
import { Language, ShopProfile } from '../../types';

interface HeaderProps {
  profile: ShopProfile;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenDemoGuide: () => void;
  isAiDemoMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  language,
  onLanguageChange,
  onOpenDemoGuide,
  isAiDemoMode = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0B3D2E] text-white shadow-md border-b border-emerald-900/50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand & Shop Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-[#1F7A5C] flex items-center justify-center shadow-inner flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white truncate">
                {profile.name || 'Dukaan Saathi'}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 flex-shrink-0">
                Kirana
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 truncate">
              {profile.owner ? `${profile.owner} • ` : ''}Bolo. Photo kheencho. Paisa pao.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Demo Guide Stepper Button */}
          <button
            onClick={onOpenDemoGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5A623] hover:bg-[#e09315] text-[#0B3D2E] font-semibold text-xs transition-transform active:scale-95 shadow-sm"
            title="Start 2-minute competition walkthrough"
          >
            <PlayCircle className="w-4 h-4 fill-[#0B3D2E] text-[#F5A623]" />
            <span className="hidden sm:inline">Demo Guide</span>
            <span className="sm:hidden">Demo</span>
          </button>

          {/* Language Toggle */}
          <div className="flex items-center bg-emerald-950/70 p-0.5 rounded-lg border border-emerald-800 text-xs">
            <Globe className="w-3.5 h-3.5 text-emerald-400 ml-1.5 mr-0.5" />
            <button
              onClick={() => onLanguageChange('hinglish')}
              className={`px-2 py-1 rounded-md transition-colors ${
                language === 'hinglish'
                  ? 'bg-[#25D366] text-[#0B3D2E] font-bold shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Hinglish
            </button>
            <button
              onClick={() => onLanguageChange('hindi')}
              className={`px-2 py-1 rounded-md transition-colors ${
                language === 'hindi'
                  ? 'bg-[#25D366] text-[#0B3D2E] font-bold shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              हिंदी
            </button>
            <button
              onClick={() => onLanguageChange('english')}
              className={`px-2 py-1 rounded-md transition-colors ${
                language === 'english'
                  ? 'bg-[#25D366] text-[#0B3D2E] font-bold shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
