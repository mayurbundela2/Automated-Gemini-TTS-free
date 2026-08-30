import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Layers,
  ListFilter,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Paragraph } from '../types';
import { ScriptCheckerService, ScriptComparisonResult } from '../services/scriptChecker';

interface ScriptWordCheckerModalProps {
  paragraphs: Paragraph[];
  batchNumber: number;
  projectName: string;
  onClose: () => void;
  onJumpToParagraph?: (paragraphId: number) => void;
}

export const ScriptWordCheckerModal: React.FC<ScriptWordCheckerModalProps> = ({
  paragraphs,
  batchNumber,
  projectName,
  onClose,
  onJumpToParagraph,
}) => {
  const storageKey = `script_checker_ref_${projectName}_batch_${batchNumber}`;

  const [referenceScript, setReferenceScript] = useState<string>(() => {
    return localStorage.getItem(storageKey) || '';
  });
  const [stripTags, setStripTags] = useState<boolean>(true);
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'flow' | 'side' | 'paragraphs' | 'missing'>('flow');
  const [copied, setCopied] = useState<boolean>(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState<boolean>(false);

  // Auto save reference script to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, referenceScript);
  }, [referenceScript, storageKey]);

  // Aggregate current batch paragraphs spoken text
  const aggregatedBatchText = useMemo(() => {
    return paragraphs
      .sort((a, b) => a.paragraph_number - b.paragraph_number)
      .map((p) => p.transcript)
      .join(' ');
  }, [paragraphs]);

  // Run sequence comparison
  const comparisonResult: ScriptComparisonResult | null = useMemo(() => {
    if (!referenceScript.trim()) return null;
    return ScriptCheckerService.compareScripts(referenceScript, paragraphs, {
      stripTags,
      caseSensitive,
    });
  }, [referenceScript, paragraphs, stripTags, caseSensitive]);

  const handleCopyMissing = () => {
    if (!comparisonResult) return;
    const report = [
      `=== SCRIPT WORD AUDIT REPORT ===`,
      `Project: ${projectName} (Batch ${batchNumber})`,
      `Match Score: ${comparisonResult.matchPercentage}%`,
      `Original Words: ${comparisonResult.originalTotalWords}`,
      `Batch Transcripts Words: ${comparisonResult.batchTotalWords}`,
      `Missing Words Count: ${comparisonResult.missingWordsCount}`,
      `Extra Words Count: ${comparisonResult.addedWordsCount}`,
      '',
      `--- MISSING WORDS LIST ---`,
      comparisonResult.missingWordsList.length > 0
        ? comparisonResult.missingWordsList.join(', ')
        : 'None! All words are present in sequence.',
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearReference = () => {
    setReferenceScript('');
    localStorage.removeItem(storageKey);
  };

  const handleUseBatchAsReference = () => {
    setReferenceScript(aggregatedBatchText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-[#0B1322] border border-[#1E293B] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#0F172A]/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                  SCRIPT WORD SEQUENCE CHECKER
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-semibold">
                  Batch {batchNumber}
                </span>
              </div>
              <p className="text-xs text-studio-textMuted truncate">
                Verify that all script words exist in the spoken transcript in exact sequence (missing words highlighted in red)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {/* Top Master Reference Input Section */}
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>MASTER REFERENCE SCRIPT (ORIGINAL TEXT)</span>
              </label>

              <div className="flex items-center space-x-2 text-[11px]">
                <button
                  onClick={handleUseBatchAsReference}
                  className="text-blue-400 hover:text-blue-300 transition-colors underline flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Load Current Paragraphs</span>
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={handleClearReference}
                  className="text-slate-400 hover:text-rose-400 transition-colors flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <textarea
              value={referenceScript}
              onChange={(e) => setReferenceScript(e.target.value)}
              rows={4}
              placeholder="Paste your original complete script here to compare with the paragraph transcripts below..."
              className="w-full bg-[#080D1A] border border-slate-700/80 focus:border-blue-500 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
            />

            {/* Options Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 pt-1">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={stripTags}
                    onChange={(e) => setStripTags(e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-500 rounded"
                  />
                  <span>Ignore emotion cues (e.g. <code className="text-amber-300">[serious]</code>)</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-500 rounded"
                  />
                  <span>Case-sensitive</span>
                </label>
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                {paragraphs.length} Paragraph Cards ({aggregatedBatchText.split(/\s+/).filter(Boolean).length} words total in batch)
              </div>
            </div>
          </div>

          {/* Results Section */}
          {comparisonResult ? (
            <div className="space-y-4">
              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-[#0D1527] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Match Score
                  </span>
                  <span
                    className={`text-lg font-black font-mono mt-0.5 block ${
                      comparisonResult.matchPercentage === 100
                        ? 'text-emerald-400'
                        : comparisonResult.matchPercentage >= 95
                        ? 'text-blue-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {comparisonResult.matchPercentage}%
                  </span>
                </div>

                <div className="bg-[#0D1527] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Original Words
                  </span>
                  <span className="text-lg font-black font-mono text-slate-200 mt-0.5 block">
                    {comparisonResult.originalTotalWords}
                  </span>
                </div>

                <div className="bg-[#0D1527] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Batch Words
                  </span>
                  <span className="text-lg font-black font-mono text-slate-200 mt-0.5 block">
                    {comparisonResult.batchTotalWords}
                  </span>
                </div>

                <div
                  className={`border rounded-xl p-3 text-center ${
                    comparisonResult.missingWordsCount > 0
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                      : 'bg-[#0D1527] border-slate-800/80 text-emerald-400'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold block tracking-wider">
                    Missing in Batch
                  </span>
                  <span className="text-lg font-black font-mono mt-0.5 block">
                    {comparisonResult.missingWordsCount > 0 ? `🔴 ${comparisonResult.missingWordsCount}` : '0 ✅'}
                  </span>
                </div>

                <div className="bg-[#0D1527] border border-slate-800/80 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Extra / Added
                  </span>
                  <span className="text-lg font-black font-mono text-blue-300 mt-0.5 block">
                    {comparisonResult.addedWordsCount > 0 ? `+${comparisonResult.addedWordsCount}` : '0'}
                  </span>
                </div>
              </div>

              {/* Missing Alert Banner if any */}
              {comparisonResult.missingWordsCount > 0 ? (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-rose-200">
                  <div className="flex items-center space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <div>
                      <strong className="font-bold text-white block">
                        {comparisonResult.missingWordsCount} word{comparisonResult.missingWordsCount > 1 ? 's are' : ' is'} missing in the paragraph transcripts!
                      </strong>
                      <span>Missing words from your original script are highlighted below in bright red badges.</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMissing}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center space-x-1.5 flex-shrink-0 shadow transition-all active:scale-95"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Report'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex items-center space-x-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <strong className="font-bold text-white block">Perfect 100% Sequence Match!</strong>
                    <span>All words from your original script are present in sequence across the batch paragraphs.</span>
                  </div>
                </div>
              )}

              {/* View Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('flow')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'flow'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Word Sequence Flow
                  </button>

                  <button
                    onClick={() => setActiveTab('paragraphs')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                      activeTab === 'paragraphs'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Per-Paragraph Audit ({paragraphs.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('missing')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                      activeTab === 'missing'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Missing Words List ({comparisonResult.missingWordsCount})</span>
                  </button>
                </div>

                {activeTab === 'flow' && (
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                      <span>Matched</span>
                    </span>
                    <span className="flex items-center space-x-1 text-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      <span>Missing (RED)</span>
                    </span>
                    <span className="flex items-center space-x-1 text-blue-300">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      <span>Added in Para</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Tab 1: Word Sequence Flow */}
              {activeTab === 'flow' && (
                <div className="bg-[#080D1A] border border-slate-800 rounded-xl p-4 max-h-[380px] overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed">
                  <div className="flex flex-wrap gap-1.5">
                    {comparisonResult.diffTokens.map((tok, idx) => {
                      if (tok.type === 'missing') {
                        return (
                          <span
                            key={idx}
                            className="bg-rose-500/25 border border-rose-500/50 text-rose-200 px-1.5 py-0.5 rounded font-bold inline-flex items-center space-x-1 shadow-sm"
                            title="MISSING WORD: Present in master script, but missing from paragraph transcripts"
                          >
                            <span>{tok.text}</span>
                            <span className="text-[9px] uppercase tracking-wider text-rose-400 font-sans">
                              [MISSING]
                            </span>
                          </span>
                        );
                      }

                      if (tok.type === 'added') {
                        return (
                          <span
                            key={idx}
                            className="bg-blue-500/15 border border-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded inline-flex items-center space-x-1"
                            title={`ADDED IN PARAGRAPH ${tok.paragraphNumber || ''}`}
                          >
                            <span>{tok.text}</span>
                            <span className="text-[9px] text-blue-400 font-sans">
                              (P{tok.paragraphNumber})
                            </span>
                          </span>
                        );
                      }

                      return (
                        <span key={idx} className="text-slate-300 hover:text-white transition-colors">
                          {tok.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Per-Paragraph Breakdown */}
              {activeTab === 'paragraphs' && (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                  {comparisonResult.paragraphAudits.map((pAudit) => (
                    <div
                      key={pAudit.paragraphId}
                      className="bg-[#0D1527] border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-xs font-mono font-bold">
                            Para {pAudit.paragraphNumber}
                          </span>
                          {pAudit.partTitle && (
                            <span className="text-xs text-slate-400 truncate">
                              {pAudit.partTitle}
                            </span>
                          )}
                          <span className="text-[11px] text-studio-textMuted font-mono">
                            ({pAudit.wordCount} words)
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-300 line-clamp-2">
                          {pAudit.transcript}
                        </p>
                      </div>

                      <div className="flex items-center space-x-3 flex-shrink-0 self-end sm:self-auto">
                        <div className="text-right text-xs font-mono">
                          <span className="text-emerald-400 block font-bold">
                            {pAudit.matchedCount} matched
                          </span>
                          {pAudit.addedCount > 0 && (
                            <span className="text-blue-400 text-[10px] block">
                              +{pAudit.addedCount} added
                            </span>
                          )}
                        </div>

                        {onJumpToParagraph && (
                          <button
                            onClick={() => {
                              onClose();
                              onJumpToParagraph(pAudit.paragraphId);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold transition-colors flex items-center space-x-1"
                            title="Jump to this paragraph card"
                          >
                            <span>Go to Card</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Missing Words List */}
              {activeTab === 'missing' && (
                <div className="bg-[#080D1A] border border-slate-800 rounded-xl p-4 max-h-[380px] overflow-y-auto custom-scrollbar space-y-3">
                  {comparisonResult.missingWordsList.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-300">
                          {comparisonResult.missingWordsList.length} Missing Word(s) in Order:
                        </span>
                        <button
                          onClick={handleCopyMissing}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy List</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {comparisonResult.missingWordsList.map((word, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-500/20 border border-rose-500/40 text-rose-200 px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                          >
                            {idx + 1}. {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="text-sm font-semibold text-white">No Missing Words!</p>
                      <p className="text-xs text-slate-400">All words in your master script are accounted for in sequence.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-3 bg-[#080D1A] border border-slate-800/80 rounded-xl">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">
                Paste your original Master Script in the box above
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The checker will immediately tokenize, align, and compare every word sequence-wise across all {paragraphs.length} batch paragraphs, highlighting any missing or skipped words in red.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#0F172A]/70 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="text-xs text-studio-textMuted">
            {comparisonResult
              ? `Word Match: ${comparisonResult.matchedWordsCount} / ${comparisonResult.originalTotalWords} (${comparisonResult.matchPercentage}%)`
              : 'Waiting for master script input...'}
          </div>

          <div className="flex items-center space-x-2">
            {comparisonResult && (
              <button
                onClick={handleCopyMissing}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center space-x-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{copied ? 'Copied Report' : 'Copy Audit Report'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow active:scale-95"
            >
              Close Checker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
