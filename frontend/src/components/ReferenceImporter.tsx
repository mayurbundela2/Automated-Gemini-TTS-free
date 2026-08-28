import React, { useState } from 'react';
import { FileDown, Sparkles, Check, X, AlertTriangle, ArrowRight, Eye, Lightbulb, Copy, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { PromptHelpModal, AI_DIRECTOR_PROMPT } from './PromptHelpModal';
import { ScriptWordCheckerModal } from './ScriptWordCheckerModal';

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
  const [showPromptHelp, setShowPromptHelp] = useState(false);
  const [showWordChecker, setShowWordChecker] = useState(false);

  const sampleReference = `Part 1: HOOK [0:00–0:11]
Playground Setup:
- Scene: "A dramatic silhouette of Lord Shiva in meditation with rising smoke, shattering common myths."
- Sample Context: "The narrator asks a bold, provocative question to instantly stop the viewer from scrolling."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Newscaster | Pace: Rapid Fire | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[serious] [probing]
Kya Shiva ne... sach mein bhang piya tha?

[authoritative] [mysterious]
Sirf ek myth nahi hai... iske peechhe ek teen hazaar saal purani... real kahani hai!

Part 2: SETUP & CONTEXT [0:11–0:26]
Playground Setup:
- Scene: "Ancient Ayurvedic texts and mountain herbs glowing with mystical light."
- Sample Context: "Explaining the mythological context with authoritative depth."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Serious | Pace: Natural | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[authoritative] [epic]
Puranon ke anusaar... jab Samudra Manthan ke dauraan Halahala vish nikla...

[intense] [dramatic]
Toh sansaar ko bachane ke liye... Lord Shiva ne use apne gale mein dharan kar liya!

Part 3: THE TWIST [0:26–0:42]
Playground Setup:
- Scene: "Close up of ancient medicinal formulations and cooling herbs."
- Sample Context: "Revealing the biological and medical truth."
- Audio Profile: "Deep, bold, and mysterious Indian documentary YouTuber."
- Style: Conversational | Pace: Rapid Fire | Accent: Neutral | Voice: Algenib

Formatted Script to Copy-Paste:
[amazed] [punchy]
Aur us agni jaise vish ki jalan ko shant karne ke liye...

[authoritative] [revelation]
Ayurveda ke anusaar cannabis ko ek cooling medicinal herb ki tarah use kiya gaya tha!`;

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
      await api.importReference(batchId, rawText, defaultVoice, parsedData);
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
    <>
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

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowPromptHelp(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all"
              >
                <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI DIRECTOR PROMPT</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowPromptHelp(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium flex items-center space-x-1"
                    >
                      <span>How to generate script?</span>
                    </button>
                    <button
                      type="button"
                      onClick={loadSample}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      Load Shiva Reference Sample
                    </button>
                  </div>
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
              {/* Verification & Metrics Top Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/30 border border-blue-500/30 p-3.5 rounded-2xl">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>{parsedData.length} PARTS DETECTED</span>
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {parsedData.reduce((acc, p) => acc + (p.word_count || 0), 0)} Total Spoken Words
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Verify that all words from your original script are present below before importing.
                  </p>
                </div>

                <div className="flex flex-wrap items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowWordChecker(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                    title="Open word-to-word script checker to scan against master script"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>CHECK SCRIPT WORDS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fullMerged = parsedData.map((p) => p.transcript).join('\n\n');
                      navigator.clipboard.writeText(fullMerged);
                      alert('Full spoken script copied to clipboard!');
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                    title="Copy full merged spoken script to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY FULL SCRIPT</span>
                  </button>

                  <button
                    onClick={() => setStep('paste')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    &larr; Re-paste
                  </button>
                </div>
              </div>

              {/* Parsed Preview Cards with Editable Transcripts */}
              <div className="space-y-3">
                {parsedData.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0B101B] border border-studio-cardBorder rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/20">
                          {item.part_number || `Part ${item.paragraph_number}`}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          Voice: <span className="text-blue-300">{item.voice}</span>
                        </span>
                        <span className="text-xs text-studio-textMuted font-mono">
                          ({item.style} &bull; {item.pace})
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                          {item.word_count || (item.transcript ? item.transcript.replace(/\[.*?\]/g, '').trim().split(/\s+/).filter(Boolean).length : 0)} words
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.transcript);
                            alert(`Part ${idx + 1} transcript copied!`);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700"
                          title="Copy this part's transcript"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {item.scene && (
                      <p className="text-[11px] text-studio-textMuted">
                        <strong className="text-slate-400 font-medium">Scene:</strong> {item.scene}
                      </p>
                    )}

                    {/* Editable Spoken Transcript Box */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-studio-textMuted font-mono">
                        <span>Spoken Transcript (Editable)</span>
                        <span>Inline emotion tags like [serious] are preserved</span>
                      </div>
                      <textarea
                        value={item.transcript}
                        onChange={(e) => {
                          const updated = [...parsedData];
                          updated[idx].transcript = e.target.value;
                          const cleanWords = e.target.value.replace(/\[.*?\]/g, '').trim();
                          updated[idx].word_count = cleanWords ? cleanWords.split(/\s+/).filter(Boolean).length : 0;
                          updated[idx].character_count = e.target.value.length;
                          setParsedData(updated);
                        }}
                        rows={3}
                        className="w-full bg-[#080D1A] border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none resize-y leading-relaxed"
                        placeholder="Spoken words..."
                      />
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

    {/* Word-to-Word Script Checker Modal */}
    <ScriptWordCheckerModal
      isOpen={showWordChecker}
      onClose={() => setShowWordChecker(false)}
      paragraphs={parsedData}
      onUpdateParagraph={(index, updatedTranscript) => {
        const updated = [...parsedData];
        updated[index].transcript = updatedTranscript;
        const cleanWords = updatedTranscript.replace(/\[.*?\]/g, '').trim();
        updated[index].word_count = cleanWords ? cleanWords.split(/\s+/).filter(Boolean).length : 0;
        updated[index].character_count = updatedTranscript.length;
        setParsedData(updated);
      }}
      onUpdateAllParagraphs={(updatedParas) => {
        const updated = updatedParas.map((p) => {
          const cleanWords = (p.transcript || '').replace(/\[.*?\]/g, '').trim();
          return {
            ...p,
            word_count: cleanWords ? cleanWords.split(/\s+/).filter(Boolean).length : 0,
            character_count: (p.transcript || '').length,
          };
        });
        setParsedData(updated);
      }}
    />

    {/* AI Director Prompt Guide Modal */}
    <PromptHelpModal isOpen={showPromptHelp} onClose={() => setShowPromptHelp(false)} />
    </>
  );
};
