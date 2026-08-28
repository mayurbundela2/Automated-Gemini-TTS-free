import React, { useState, useMemo } from 'react';
import { 
  X, CheckCircle2, AlertCircle, Search, Copy, Check, Sparkles, 
  FileText, ArrowRight, ShieldCheck, AlertTriangle, Layers, ListFilter,
  PlusCircle, Zap, CornerDownRight, ArrowDownRight
} from 'lucide-react';

interface ScriptWordCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  paragraphs: Array<{
    id?: number;
    paragraph_number?: number;
    part_number?: string;
    transcript?: string;
    scene?: string;
    [key: string]: any;
  }>;
  onUpdateParagraph?: (index: number, updatedTranscript: string) => void | Promise<void>;
  onUpdateAllParagraphs?: (updatedParagraphs: any[]) => void | Promise<void>;
}

export function cleanSpokenText(transcript?: string): string {
  if (!transcript) return '';
  // Strip emotion tags like [serious] [probing] [reflective] and leading quotes
  return transcript
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^>+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function findBestMatchingPart(
  sentenceIndex: number,
  totalSentences: number,
  sentenceText: string,
  paragraphs: any[],
  allSentences: string[]
): number {
  if (paragraphs.length === 0) return 0;
  
  // Check preceding sentences in original
  for (let prevIdx = sentenceIndex - 1; prevIdx >= 0; prevIdx--) {
    const prevWords = allSentences[prevIdx].split(/\s+/).map(normalizeWord).filter(Boolean);
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const pWords = cleanSpokenText(paragraphs[pIdx].transcript).split(/\s+/).map(normalizeWord).filter(Boolean);
      const pWordSet = new Set(pWords);
      const matches = prevWords.filter((w) => pWordSet.has(w)).length;
      if (matches >= 2) {
        return pIdx;
      }
    }
  }

  // Check next sentences in original
  for (let nextIdx = sentenceIndex + 1; nextIdx < allSentences.length; nextIdx++) {
    const nextWords = allSentences[nextIdx].split(/\s+/).map(normalizeWord).filter(Boolean);
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const pWords = cleanSpokenText(paragraphs[pIdx].transcript).split(/\s+/).map(normalizeWord).filter(Boolean);
      const pWordSet = new Set(pWords);
      const matches = nextWords.filter((w) => pWordSet.has(w)).length;
      if (matches >= 2) {
        return pIdx;
      }
    }
  }

  // Fallback by linear ratio
  const ratio = sentenceIndex / Math.max(1, totalSentences);
  return Math.min(paragraphs.length - 1, Math.floor(ratio * paragraphs.length));
}

export const ScriptWordCheckerModal: React.FC<ScriptWordCheckerModalProps> = ({
  isOpen,
  onClose,
  paragraphs,
  onUpdateParagraph,
  onUpdateAllParagraphs,
}) => {
  const [originalScript, setOriginalScript] = useState('');
  const [localParagraphs, setLocalParagraphs] = useState<any[]>(paragraphs);
  const [copiedClean, setCopiedClean] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'missing' | 'parts'>('diff');
  const [missingSearch, setMissingSearch] = useState('');
  const [selectedTargetParts, setSelectedTargetParts] = useState<{ [sentenceIdx: number]: number }>({});
  const [fillFeedback, setFillFeedback] = useState<string | null>(null);

  // Sync with prop updates
  React.useEffect(() => {
    setLocalParagraphs(paragraphs);
  }, [paragraphs]);

  // Combine all clean spoken voiceover text across parsed paragraphs
  const combinedCleanSpoken = useMemo(() => {
    return localParagraphs.map((p) => cleanSpokenText(p.transcript)).filter(Boolean).join('\n\n');
  }, [localParagraphs]);

  // Combine full spoken transcript with emotion tags
  const combinedFullSpoken = useMemo(() => {
    return localParagraphs.map((p) => p.transcript || '').filter(Boolean).join('\n\n');
  }, [localParagraphs]);

  // Perform word-by-word and sentence-by-sentence diff match
  const analysis = useMemo(() => {
    if (!originalScript.trim()) {
      return {
        totalOriginalWords: 0,
        matchedCount: 0,
        missingWordsCount: 0,
        missingWords: [] as string[],
        matchPercentage: 100,
        analyzedTokens: [] as Array<{
          text: string;
          norm?: string;
          isSpace?: boolean;
          isPunctuation?: boolean;
          status: 'matched' | 'missing' | 'space';
        }>,
        totalSpokenWords: combinedCleanSpoken ? combinedCleanSpoken.split(/\s+/).filter(Boolean).length : 0,
        missingSentences: [] as Array<{
          sentenceIndex: number;
          text: string;
          totalWords: number;
          matchedWords: number;
          matchRatio: number;
          status: 'missing' | 'partial';
          suggestedPartIndex: number;
        }>,
      };
    }

    const originalTokens = originalScript.split(/(\s+)/); // Preserves spaces and newlines
    const spokenTokens = combinedCleanSpoken.split(/\s+/).map(normalizeWord).filter(Boolean);

    const spokenWordSet = new Set(spokenTokens);
    const spokenWordCounts = new Map<string, number>();
    for (const w of spokenTokens) {
      spokenWordCounts.set(w, (spokenWordCounts.get(w) || 0) + 1);
    }

    const remainingCounts = new Map<string, number>(spokenWordCounts);

    let totalOriginalWords = 0;
    let matchedCount = 0;
    const missingWords: string[] = [];
    const analyzedTokens: Array<{
      text: string;
      norm?: string;
      isSpace?: boolean;
      isPunctuation?: boolean;
      status: 'matched' | 'missing' | 'space';
    }> = [];

    for (const token of originalTokens) {
      if (/^\s+$/.test(token) || token === '') {
        analyzedTokens.push({ text: token, isSpace: true, status: 'space' });
        continue;
      }

      const norm = normalizeWord(token);
      if (!norm) {
        // Pure punctuation
        analyzedTokens.push({ text: token, isPunctuation: true, status: 'matched' });
        continue;
      }

      totalOriginalWords++;
      const count = remainingCounts.get(norm) || 0;
      if (count > 0) {
        remainingCounts.set(norm, count - 1);
        matchedCount++;
        analyzedTokens.push({ text: token, norm, status: 'matched' });
      } else {
        missingWords.push(token);
        analyzedTokens.push({ text: token, norm, status: 'missing' });
      }
    }

    // Sentence-level breakdown
    const rawSentences = originalScript
      .split(/(?<=[.!?।\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);

    const missingSentences = rawSentences
      .map((sentence, sIdx) => {
        const sWords = sentence.split(/\s+/).map(normalizeWord).filter(Boolean);
        if (sWords.length === 0) return null;

        let matchedInSentence = 0;
        for (const w of sWords) {
          if (spokenWordSet.has(w)) {
            matchedInSentence++;
          }
        }
        const ratio = matchedInSentence / sWords.length;
        if (ratio < 0.7) {
          const suggestedPart = findBestMatchingPart(
            sIdx,
            rawSentences.length,
            sentence,
            localParagraphs,
            rawSentences
          );
          return {
            sentenceIndex: sIdx + 1,
            text: sentence,
            totalWords: sWords.length,
            matchedWords: matchedInSentence,
            matchRatio: Math.round(ratio * 100),
            status: (ratio === 0 ? 'missing' : 'partial') as 'missing' | 'partial',
            suggestedPartIndex: suggestedPart,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{
        sentenceIndex: number;
        text: string;
        totalWords: number;
        matchedWords: number;
        matchRatio: number;
        status: 'missing' | 'partial';
        suggestedPartIndex: number;
      }>;

    const matchPercentage =
      totalOriginalWords > 0 ? Math.round((matchedCount / totalOriginalWords) * 100) : 100;

    return {
      totalOriginalWords,
      matchedCount,
      missingWordsCount: missingWords.length,
      missingWords,
      matchPercentage,
      analyzedTokens,
      totalSpokenWords: spokenTokens.length,
      missingSentences,
    };
  }, [originalScript, combinedCleanSpoken, localParagraphs]);

  if (!isOpen) return null;

  const handleCopyClean = () => {
    navigator.clipboard.writeText(combinedCleanSpoken);
    setCopiedClean(true);
    setTimeout(() => setCopiedClean(false), 2000);
  };

  const handleCopyFull = () => {
    navigator.clipboard.writeText(combinedFullSpoken);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  // 1-Click Auto Fill a single missing sentence into chosen part
  const handleFillSingleSentence = async (
    sentence: { sentenceIndex: number; text: string; suggestedPartIndex: number },
    targetIdxOverride?: number
  ) => {
    const targetIdx =
      targetIdxOverride !== undefined
        ? targetIdxOverride
        : selectedTargetParts[sentence.sentenceIndex] !== undefined
        ? selectedTargetParts[sentence.sentenceIndex]
        : sentence.suggestedPartIndex;

    if (targetIdx < 0 || targetIdx >= localParagraphs.length) {
      alert('Please select a valid Part to insert this text into.');
      return;
    }

    const updated = [...localParagraphs];
    const targetParagraph = { ...updated[targetIdx] };
    const currentTranscript = targetParagraph.transcript || '';
    const updatedTranscript = currentTranscript
      ? `${currentTranscript.trim()}\n\n${sentence.text.trim()}`
      : sentence.text.trim();

    targetParagraph.transcript = updatedTranscript;
    updated[targetIdx] = targetParagraph;
    setLocalParagraphs(updated);

    if (onUpdateParagraph) {
      await onUpdateParagraph(targetIdx, updatedTranscript);
    }

    const partName = targetParagraph.part_number || `Part ${targetIdx + 1}`;
    setFillFeedback(`✓ Inserted missing sentence into ${partName}! Match is now re-calculated.`);
    setTimeout(() => setFillFeedback(null), 3000);
  };

  // 1-Click Auto-Fill ALL missing sentences into their smart-matched parts!
  const handleAutoFillAll = async () => {
    if (analysis.missingSentences.length === 0) return;

    // Clone paragraphs
    const updatedParas = localParagraphs.map((p) => ({ ...p }));
    const insertedLog: string[] = [];

    for (const s of analysis.missingSentences) {
      const targetIdx =
        selectedTargetParts[s.sentenceIndex] !== undefined
          ? selectedTargetParts[s.sentenceIndex]
          : s.suggestedPartIndex;

      if (targetIdx >= 0 && targetIdx < updatedParas.length) {
        const cur = updatedParas[targetIdx].transcript || '';
        updatedParas[targetIdx].transcript = cur ? `${cur.trim()}\n\n${s.text.trim()}` : s.text.trim();
        const pName = updatedParas[targetIdx].part_number || `Part ${targetIdx + 1}`;
        if (!insertedLog.includes(pName)) insertedLog.push(pName);
      }
    }

    setLocalParagraphs(updatedParas);

    if (onUpdateAllParagraphs) {
      await onUpdateAllParagraphs(updatedParas);
    } else if (onUpdateParagraph) {
      for (let i = 0; i < updatedParas.length; i++) {
        if (updatedParas[i].transcript !== localParagraphs[i].transcript) {
          await onUpdateParagraph(i, updatedParas[i].transcript);
        }
      }
    }

    setFillFeedback(`✓ Auto-filled ${analysis.missingSentences.length} missing sentences into ${insertedLog.join(', ')}! Match updated.`);
    setTimeout(() => setFillFeedback(null), 4000);
  };

  const filteredMissingSentences = analysis.missingSentences.filter((s) =>
    s.text.toLowerCase().includes(missingSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-[#131F37] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-xs sm:text-sm text-white tracking-wide">
                  SCRIPT WORD-TO-WORD VERIFIER & AUTO-FILLER
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold border border-blue-500/30">
                  {paragraphs.length} PARTS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Paste your master script to scan for missing words and 1-click auto-fill them into paragraphs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Feedback Toast */}
        {fillFeedback && (
          <div className="px-5 py-2 bg-emerald-900/60 border-b border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{fillFeedback}</span>
          </div>
        )}

        {/* Status Metrics Bar */}
        <div className="px-5 py-2.5 bg-[#0B1120] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
            {originalScript.trim() ? (
              <>
                <div
                  className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-lg font-bold border ${
                    analysis.missingWordsCount === 0
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {analysis.missingWordsCount === 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{analysis.matchPercentage}% MATCH</span>
                </div>

                <div className="text-slate-300 text-[11px]">
                  Original: <strong className="text-white">{analysis.totalOriginalWords}</strong> words
                </div>
                <div className="text-slate-500">&bull;</div>
                <div className="text-slate-300 text-[11px]">
                  Voiceovers: <strong className="text-blue-300">{analysis.totalSpokenWords}</strong> words
                </div>
                <div className="text-slate-500">&bull;</div>
                <div className={`text-[11px] ${analysis.missingWordsCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}`}>
                  Missing:{' '}
                  <strong>
                    {analysis.missingWordsCount === 0 ? '0 words (100% Complete)' : `${analysis.missingWordsCount} words`}
                  </strong>
                </div>
              </>
            ) : (
              <div className="text-slate-400 text-xs flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                <span>Paste your raw master script below to scan word-for-word.</span>
              </div>
            )}
          </div>

          {/* Quick Copy & Auto Fill Buttons */}
          <div className="flex items-center space-x-2">
            {originalScript.trim() && analysis.missingSentences.length > 0 && (
              <button
                onClick={handleAutoFillAll}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                title="Automatically insert all missing sentences into their matching parts"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-yellow-300" />
                <span>AUTO-FILL ALL MISSING ({analysis.missingSentences.length})</span>
              </button>
            )}

            <button
              onClick={handleCopyClean}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
              title="Copy all spoken dialogue with emotion tags stripped"
            >
              {copiedClean ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedClean ? 'COPIED!' : 'COPY CLEAN'}</span>
            </button>

            <button
              onClick={handleCopyFull}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold border border-indigo-500/40 transition-all"
              title="Copy full narration with [emotion] tags"
            >
              {copiedFull ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedFull ? 'COPIED!' : 'COPY FULL'}</span>
            </button>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="px-5 pt-2 bg-[#0B1120] border-b border-slate-800 flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'diff'
                ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1. Word-by-Word Diff View</span>
          </button>

          <button
            onClick={() => setActiveTab('missing')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'missing'
                ? 'border-rose-500 text-rose-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              2. Missing Sentences & 1-Click Fill ({analysis.missingSentences.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('parts')}
            className={`px-3 py-1.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'parts'
                ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Paragraph Parts ({paragraphs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: Diff View */}
          {activeTab === 'diff' && (
            <div className="space-y-4">
              {originalScript.trim() && analysis.missingWordsCount > 0 && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>{analysis.missingWordsCount} words missing &bull; {analysis.missingSentences.length} sentences missing</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('missing')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors flex items-center space-x-1"
                    >
                      <span>1-Click Auto Fill Missing &rarr;</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
                    {Array.from(new Set(analysis.missingWords)).slice(0, 40).map((w, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-mono font-bold"
                      >
                        {w}
                      </span>
                    ))}
                    {new Set(analysis.missingWords).size > 40 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{new Set(analysis.missingWords).size - 40} more...
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Original Script Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Original Master Script (Paste Here):</span>
                    </label>
                    {originalScript && (
                      <button
                        onClick={() => setOriginalScript('')}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <textarea
                    value={originalScript}
                    onChange={(e) => setOriginalScript(e.target.value)}
                    rows={10}
                    className="w-full bg-[#080D1A] border border-slate-800 focus:border-blue-500 rounded-2xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none resize-none leading-relaxed"
                    placeholder="Paste your raw, complete master script here to compare word-for-word..."
                  />
                </div>

                {/* Right: Word-by-Word Diff */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Word-by-Word Diff Scanner:</span>
                    </label>
                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold">&bull; Matched</span>
                      <span className="text-rose-400 font-bold">&bull; Missing (Red)</span>
                    </div>
                  </div>

                  <div className="w-full bg-[#080D1A] border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-200 leading-relaxed overflow-y-auto max-h-[250px] min-h-[180px]">
                    {!originalScript.trim() ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-500 space-y-1">
                        <Search className="w-6 h-6 text-slate-600" />
                        <p className="text-xs">Paste your original script on the left to see live red highlights.</p>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {analysis.analyzedTokens.map((t, idx) => {
                          if (t.isSpace) {
                            return <span key={idx}>{t.text}</span>;
                          }
                          if (t.status === 'missing') {
                            return (
                              <span
                                key={idx}
                                className="bg-rose-500/25 text-rose-300 border border-rose-500/50 rounded px-1 py-0.5 font-bold shadow-sm inline-block my-0.5"
                                title="Missing from parsed voiceover paragraphs!"
                              >
                                {t.text}
                              </span>
                            );
                          }
                          return (
                            <span key={idx} className="text-emerald-300">
                              {t.text}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Missing Sentences & 1-Click Auto Fill */}
          {activeTab === 'missing' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Missing or Skipped Sentences ({analysis.missingSentences.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Click <strong>Auto-Fill Into Part</strong> to automatically insert the missing sentence right where it was omitted!
                  </p>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  {analysis.missingSentences.length > 0 && (
                    <button
                      onClick={handleAutoFillAll}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current text-yellow-300" />
                      <span>AUTO-FILL ALL ({analysis.missingSentences.length})</span>
                    </button>
                  )}

                  <input
                    type="text"
                    value={missingSearch}
                    onChange={(e) => setMissingSearch(e.target.value)}
                    placeholder="Search missing text..."
                    className="w-40 bg-[#080D1A] border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {!originalScript.trim() ? (
                <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                  Please paste your master script in Tab 1 (Word-by-Word Diff View) first.
                </div>
              ) : filteredMissingSentences.length === 0 ? (
                <div className="text-center py-12 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p>100% Complete! All sentences from your original script are present in the voiceover parts!</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                  {filteredMissingSentences.map((s, idx) => {
                    const currentSelectedPart =
                      selectedTargetParts[s.sentenceIndex] !== undefined
                        ? selectedTargetParts[s.sentenceIndex]
                        : s.suggestedPartIndex;

                    return (
                      <div
                        key={idx}
                        className="bg-[#0B1120] border border-rose-500/30 hover:border-rose-500/50 p-3.5 rounded-2xl space-y-2 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/30">
                            Sentence #{s.sentenceIndex} &bull; {s.totalWords} words ({s.matchRatio}% match)
                          </span>

                          {/* Target Part Selector & Auto Fill Action */}
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center space-x-1 text-xs text-slate-400">
                              <span className="text-[11px]">Target:</span>
                              <select
                                value={currentSelectedPart}
                                onChange={(e) => {
                                  setSelectedTargetParts({
                                    ...selectedTargetParts,
                                    [s.sentenceIndex]: parseInt(e.target.value, 10),
                                  });
                                }}
                                className="bg-[#080D1A] border border-slate-700 rounded-lg px-2 py-1 text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500"
                              >
                                {paragraphs.map((p, pIdx) => (
                                  <option key={pIdx} value={pIdx}>
                                    {p.part_number || `Part ${p.paragraph_number || pIdx + 1}`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleFillSingleSentence(s, currentSelectedPart)}
                              className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                              title="1-Click Fill this missing sentence into the selected part"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>AUTO-FILL INTO PART</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(s.text);
                                alert('Sentence copied to clipboard!');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 border border-slate-700"
                              title="Copy Sentence Text"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Sentence Text */}
                        <p className="text-xs font-mono text-rose-200 leading-relaxed bg-[#080D1A] p-2.5 rounded-xl border border-slate-900">
                          {s.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Paragraph Parts Review */}
          {activeTab === 'parts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Parsed Voiceover Breakdown ({paragraphs.length} Parts Active)
                </h4>
                <span className="text-[11px] font-mono text-slate-400">
                  {analysis.totalSpokenWords} total spoken words
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto">
                {paragraphs.map((p, idx) => {
                  const cleanWords = cleanSpokenText(p.transcript);
                  const wordCount = cleanWords ? cleanWords.split(/\s+/).filter(Boolean).length : 0;
                  return (
                    <div
                      key={idx}
                      className="bg-[#0B1120] border border-slate-800/90 rounded-2xl p-3 space-y-2 hover:border-slate-700 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/20">
                            {p.part_number || `Part ${p.paragraph_number || idx + 1}`}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {wordCount} words
                          </span>
                        </div>

                        {p.scene && (
                          <p className="text-[10px] text-slate-400 line-clamp-1">
                            <strong className="text-slate-300 font-medium">Scene:</strong> {p.scene}
                          </p>
                        )}

                        <div className="bg-[#080D1A] p-2 rounded-xl border border-slate-900 text-xs font-mono text-slate-300 line-clamp-4 leading-relaxed">
                          {p.transcript || <span className="text-slate-600 italic">No dialogue</span>}
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cleanSpokenText(p.transcript));
                            alert(`Part ${idx + 1} clean spoken text copied!`);
                          }}
                          className="text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Clean Part</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#131F37] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Close Checker
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyClean}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all"
            >
              <span>{copiedClean ? 'COPIED CLEAN!' : 'COPY CLEAN SPOKEN SCRIPT'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
