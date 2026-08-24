import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface GenerationProgressProps {
  currentParagraph: number;
  totalParagraphs: number;
  status: 'idle' | 'generating' | 'completed' | 'error';
  message?: string;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  currentParagraph,
  totalParagraphs,
  status,
  message,
}) => {
  if (status === 'idle') return null;

  const progressPercent = totalParagraphs > 0 ? Math.round((currentParagraph / totalParagraphs) * 100) : 0;

  return (
    <div className="bg-[#111C30] border border-blue-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between animate-fadeIn">
      <div className="flex items-center space-x-4">
        {status === 'generating' && (
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {status === 'completed' && (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
        {status === 'error' && (
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}

        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {status === 'generating' ? 'BATCH GENERATION IN PROGRESS' : status === 'completed' ? 'GENERATION COMPLETED' : 'GENERATION ERROR'}
            </span>
            <span className="text-xs font-mono text-blue-400 font-bold">
              ({currentParagraph}/{totalParagraphs})
            </span>
          </div>
          <p className="text-xs text-studio-textMuted mt-0.5">
            {message || (status === 'generating' ? `Generating narration audio for paragraph ${currentParagraph}...` : 'All ready paragraphs have been generated.')}
          </p>
        </div>
      </div>

      <div className="w-48 hidden sm:block">
        <div className="flex justify-between text-[10px] font-mono text-studio-textMuted mb-1">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-[#0B101B] h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
