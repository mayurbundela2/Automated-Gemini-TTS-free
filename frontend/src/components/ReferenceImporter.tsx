import React, { useState } from 'react';
import { FileDown, Sparkles, Check, X, AlertTriangle, ArrowRight, Eye } from 'lucide-react';
import { api } from '../api';

interface ReferenceImporterProps {
  batchId: number;
  defaultVoice?: string;
  onImportSuccess: () => void;
  onClose: () => void;
}

export const ReferenceImporter: React.FC<ReferenceImporterProps> = ({
  batchId,
  defaultVoice = 'Algenib',
  onImportSuccess,
  onClose,
}) => {
  const [step, setStep] = useState<'paste' | 'preview'>('paste');
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleReference = `Here is the breakdown for Batch 1...

### Part 1: COLD OPEN — The Riddle

Playground Setup:

- Scene: "A dimly lit room with an investigative board in the background, papers and red strings everywhere."
- Sample Context: "Gripping cold open hook, serious mystery tone."
- Audio Profile: "Deep, investigative, and authoritative Indian documentary YouTuber."
- Style: Newscaster
- Pace: Natural
- Accent: Neutral
- Voice: Algenib

Formatted Script to Copy-Paste:

[serious] [mysterious]

Ek sawaal...

[thoughtful] [curious]

Pichle baarah hazaar saalon mein insaan ne aisi kaunsi cheez khoji hai jo pehle aam thi aur aaj illegal hai?

### Part 2: THE ANCIENT ROOTS

Playground Setup:

- Scene: "Ancient Harappan civilization ruins and cave paintings."
- Sample Context: "Historical narration with awe and depth."
- Audio Profile: "Historical scholar, rich tone."
- Style: Conversational
- Pace: Slow
- Accent: Neutral
- Voice: Aoede

Formatted Script to Copy-Paste:

[reflective] [authoritative]

Himalaya ki vaadiyon se lekar Atharvaveda ke pannon tak, yeh paudha har jagah maujood tha.`;

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Please paste your script breakdown reference first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.parseReference(batchId, rawText, defaultVoice);
      setParsedData(res.paragraphs);
      setStep('preview');
    } catch (e: any) {
      setError(e.message || 'Failed to parse reference.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.importReference(batchId, rawText, defaultVoice);
      onImportSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setRawText(sampleReference);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#101827] border border-[#20304C] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-studio-cardBorder flex items-center justify-between bg-[#152037]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">IMPORT AI STUDIO REFERENCE</h3>
              <p className="text-xs text-studio-textMuted">
                {step === 'paste' ? 'Step 1: Paste markdown or structured script' : 'Step 2: Inspect parsed paragraphs before importing'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'paste' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-studio-textLight">
                  Paste Batch Reference / Breakdown:
                </span>
                <button
                  type="button"
                  onClick={loadSample}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Load 4-Paragraph Sample
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={14}
                className="w-full bg-[#0B101B] border border-studio-cardBorder focus:border-blue-500 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none resize-none leading-relaxed"
                placeholder="Paste AI Studio breakdown here (Scene, Sample Context, Audio Profile, Style, Pace, Voice, Formatted Script to Copy-Paste)..."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-300">
                <span className="font-semibold">
                  Detected {parsedData.length} Paragraph(s) ready for import
                </span>
                <button
                  onClick={() => setStep('paste')}
                  className="text-blue-400 hover:text-blue-200 font-medium underline"
                >
                  &larr; Back to Paste
                </button>
              </div>

              {/* Parsed Preview Table */}
              <div className="space-y-3">
                {parsedData.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0B101B] border border-studio-cardBorder rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-mono text-xs font-bold">
                          {item.part_number || `Part ${item.paragraph_number}`}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          Voice: <span className="text-blue-300">{item.voice}</span>
                        </span>
                        <span className="text-xs text-studio-textMuted font-mono">
                          ({item.style} &bull; {item.pace})
                        </span>
                      </div>

                      <div className="text-xs font-mono text-studio-textMuted">
                        {item.word_count} words | {item.character_count} chars
                      </div>
                    </div>

                    {item.scene && (
                      <p className="text-[11px] text-studio-textMuted truncate">
                        <strong className="text-slate-400 font-medium">Scene:</strong> {item.scene}
                      </p>
                    )}

                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 line-clamp-3">
                      {item.transcript}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-studio-cardBorder bg-[#152037] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>

          {step === 'paste' ? (
            <button
              onClick={handleParse}
              disabled={loading || !rawText.trim()}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
            >
              <span>{loading ? 'Parsing...' : 'PARSE REFERENCE'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Importing...' : 'CONFIRM & IMPORT INTO BATCH'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
