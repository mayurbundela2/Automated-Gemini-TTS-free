import React, { useState } from 'react';
import { Scissors, X, Check, Merge, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { Paragraph } from '../types';

interface SplitModalProps {
  paragraph: Paragraph;
  onClose: () => void;
  onSplitSuccess: () => void;
}

export const SplitModal: React.FC<SplitModalProps> = ({
  paragraph,
  onClose,
  onSplitSuccess,
}) => {
  const [mode, setMode] = useState<'auto' | 'manual'>('manual');
  const [partA, setPartA] = useState('');
  const [partB, setPartB] = useState('');
  const [partC, setPartC] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize split parts on mount
  React.useEffect(() => {
    const text = paragraph.transcript.trim();
    // Default split near midpoint on sentence boundary
    const sentences = text.split(/(?<=[.!?।])\s+/);
    if (sentences.length > 1) {
      const mid = Math.ceil(sentences.length / 2);
      setPartA(sentences.slice(0, mid).join(' '));
      setPartB(sentences.slice(mid).join(' '));
    } else {
      const words = text.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      setPartA(words.slice(0, mid).join(' '));
      setPartB(words.slice(mid).join(' '));
    }
  }, [paragraph]);

  const handleAutoSplit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.autoSplitParagraph(paragraph.id);
      onSplitSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Auto split failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSave = async () => {
    if (!partA.trim() || !partB.trim()) {
      setError('Both Part A and Part B must have transcript content.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.manualSplitParagraph(paragraph.id, partA, partB, partC.trim() ? partC : undefined);
      onSplitSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Manual split failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const countWords = (t: string) => t.trim() ? t.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111A2C] border border-[#233554] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-studio-cardBorder flex items-center justify-between bg-[#152037]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                SPLIT PARAGRAPH {paragraph.paragraph_number} {paragraph.part_number ? `(${paragraph.part_number})` : ''}
              </h3>
              <p className="text-xs text-studio-textMuted">Divide oversized script into sequential parts</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex items-center space-x-2 bg-studio-bg p-1 rounded-xl border border-studio-cardBorder w-fit">
            <button
              onClick={() => setMode('manual')}
              className={`px-3.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                mode === 'manual' ? 'bg-blue-600 text-white' : 'text-studio-textMuted hover:text-white'
              }`}
            >
              Manual Split Editor
            </button>
            <button
              onClick={() => setMode('auto')}
              className={`px-3.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                mode === 'auto' ? 'bg-blue-600 text-white' : 'text-studio-textMuted hover:text-white'
              }`}
            >
              Automatic Split
            </button>
          </div>

          {mode === 'auto' ? (
            <div className="bg-studio-bg/60 border border-studio-cardBorder p-5 rounded-xl space-y-4">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">Smart Boundary-Aware Split</h4>
                  <p className="text-xs text-studio-textMuted leading-relaxed">
                    Automatically divides text on natural paragraph breaks, sentence punctuation (<code className="text-blue-300 font-mono">. ! ? ।</code>), and preserves all inline audio tags (<code className="text-amber-300 font-mono">[serious]</code>).
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#0B101B] rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-40 overflow-y-auto">
                <span className="text-studio-textMuted block text-[10px] mb-1">CURRENT SCRIPT:</span>
                {paragraph.transcript}
              </div>

              <button
                onClick={handleAutoSplit}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Splitting...' : 'EXECUTE AUTOMATIC SPLIT'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Part A */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-blue-400">PART A (Sequential 1)</span>
                  <span className="text-studio-textMuted">
                    {countWords(partA)} words | {partA.length} chars
                  </span>
                </div>
                <textarea
                  value={partA}
                  onChange={(e) => setPartA(e.target.value)}
                  rows={4}
                  className="w-full bg-studio-bg border border-studio-cardBorder focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 focus:outline-none font-mono resize-none leading-relaxed"
                  placeholder="Paste Part A transcript here..."
                />
              </div>

              {/* Part B */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-blue-400">PART B (Sequential 2)</span>
                  <span className="text-studio-textMuted">
                    {countWords(partB)} words | {partB.length} chars
                  </span>
                </div>
                <textarea
                  value={partB}
                  onChange={(e) => setPartB(e.target.value)}
                  rows={4}
                  className="w-full bg-studio-bg border border-studio-cardBorder focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 focus:outline-none font-mono resize-none leading-relaxed"
                  placeholder="Paste Part B transcript here..."
                />
              </div>

              {/* Optional Part C */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-400">PART C (Optional 3)</span>
                  <span className="text-studio-textMuted">
                    {countWords(partC)} words | {partC.length} chars
                  </span>
                </div>
                <textarea
                  value={partC}
                  onChange={(e) => setPartC(e.target.value)}
                  rows={3}
                  className="w-full bg-studio-bg border border-studio-cardBorder focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 focus:outline-none font-mono resize-none leading-relaxed"
                  placeholder="Optional Part C transcript if splitting into 3 parts..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 border-t border-studio-cardBorder bg-[#152037] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>

          {mode === 'manual' && (
            <button
              onClick={handleManualSave}
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'SAVE SPLIT'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
