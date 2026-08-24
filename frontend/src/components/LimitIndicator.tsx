import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { LimitMetrics } from '../types';

interface LimitIndicatorProps {
  metrics?: LimitMetrics;
  words: number;
  characters: number;
  maxWords?: number;
  maxCharacters?: number;
}

export const LimitIndicator: React.FC<LimitIndicatorProps> = ({
  metrics,
  words,
  characters,
  maxWords = 500,
  maxCharacters = 3000,
}) => {
  const effectiveMaxWords = metrics?.max_words || maxWords;
  const effectiveMaxChars = metrics?.max_characters || maxCharacters;
  const status = metrics?.status || (words > effectiveMaxWords || characters > effectiveMaxChars ? 'OVER_LIMIT' : (words > effectiveMaxWords * 0.8 || characters > effectiveMaxChars * 0.8 ? 'NEAR_LIMIT' : 'SAFE'));

  const wordPercent = Math.min(100, Math.round((words / effectiveMaxWords) * 100));
  const charPercent = Math.min(100, Math.round((characters / effectiveMaxChars) * 100));
  const maxPercent = Math.max(wordPercent, charPercent);

  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let barColor = 'bg-emerald-500';
  let Icon = ShieldCheck;

  if (status === 'NEAR_LIMIT') {
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    barColor = 'bg-amber-500';
    Icon = AlertTriangle;
  } else if (status === 'OVER_LIMIT') {
    badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    barColor = 'bg-rose-500 animate-pulse';
    Icon = XCircle;
  }

  return (
    <div className="flex flex-col space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3 text-studio-textMuted font-mono">
          <span>Words: <strong className="text-white font-semibold">{words}</strong>/{effectiveMaxWords}</span>
          <span className="text-studio-cardBorder">|</span>
          <span>Chars: <strong className="text-white font-semibold">{characters}</strong>/{effectiveMaxChars}</span>
        </div>

        <div className={`px-2 py-0.5 rounded-full border text-[11px] font-bold tracking-wider flex items-center space-x-1 uppercase ${badgeColor}`}>
          <Icon className="w-3 h-3" />
          <span>{status.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${barColor}`} 
          style={{ width: `${Math.max(4, maxPercent)}%` }} 
        />
      </div>
    </div>
  );
};
