import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Play, Sparkles, FileDown, FolderOpen, 
  CheckCircle, AlertTriangle, Layers, RefreshCw, Trash2,
  Zap, Scissors, Film, Video, Download, FileText, Clock, Eye, X, Copy, Check
} from 'lucide-react';
import { Project, Batch, VoiceItem } from '../types';
import { ParagraphCard } from '../components/ParagraphCard';
import { ReferenceImporter } from '../components/ReferenceImporter';
import { GenerationProgress } from '../components/GenerationProgress';
import { api } from '../api';

interface BatchPageProps {
  project: Project;
  onBack: () => void;
}

export const BatchPage: React.FC<BatchPageProps> = ({ project, onBack }) => {
  const roundTwo = (n: number) => Math.round(n * 100) / 100;
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  
  // Batch generation status
  const [generatingAll, setGeneratingAll] = useState(false);
  const [progressState, setProgressState] = useState<{
    status: 'idle' | 'generating' | 'completed' | 'error';
    current: number;
    total: number;
    message?: string;
  }>({ status: 'idle', current: 0, total: 0 });

  const fetchBatches = async () => {
    try {
      const data = await api.getBatches(project.id);
      setBatches(data);
      if (data.length > 0) {
        if (!selectedBatchId || !data.find(b => b.id === selectedBatchId)) {
          setSelectedBatchId(data[0].id);
        }
      } else {
        setSelectedBatchId(null);
        setCurrentBatch(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCurrentBatch = async () => {
    if (!selectedBatchId) return;
    try {
      const data = await api.getBatch(selectedBatchId);
      setCurrentBatch(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVoices = async () => {
    try {
      const data = await api.getVoices();
      setVoices(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchVoices();
  }, [project.id]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchCurrentBatch().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [selectedBatchId]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const b = await api.createBatch(project.id, newBatchName || `Batch ${batches.length + 1}`);
      setShowNewBatchModal(false);
      setNewBatchName('');
      await fetchBatches();
      setSelectedBatchId(b.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBatch = async (batchId: number) => {
    if (confirm('Are you sure you want to delete this batch and its generated audios?')) {
      await api.deleteBatch(batchId);
      await fetchBatches();
    }
  };

  const handleGenerateAllReady = async () => {
    if (!currentBatch) return;
    
    // Filter ready paragraphs
    const readyParas = currentBatch.paragraphs.filter(
      (p) => p.limit_status !== 'OVER_LIMIT' && p.transcript && p.transcript.trim()
    );

    if (readyParas.length === 0) {
      alert('No valid READY paragraphs found. Please split any OVER LIMIT paragraphs first.');
      return;
    }

    setGeneratingAll(true);
    setProgressState({
      status: 'generating',
      current: 1,
      total: readyParas.length,
      message: `Generating Paragraph 1/${readyParas.length}...`,
    });

    try {
      for (let i = 0; i < readyParas.length; i++) {
        const para = readyParas[i];
        setProgressState({
          status: 'generating',
          current: i + 1,
          total: readyParas.length,
          message: `Generating Paragraph ${i + 1}/${readyParas.length} (Part ${para.paragraph_number})...`,
        });

        await api.generateParagraph(para.id);
        await fetchCurrentBatch();
      }

      setProgressState({
        status: 'completed',
        current: readyParas.length,
        total: readyParas.length,
        message: `Successfully generated all ${readyParas.length} ready paragraphs!`,
      });
    } catch (e: any) {
      setProgressState({
        status: 'error',
        current: progressState.current,
        total: readyParas.length,
        message: e.message || 'Generation error occurred during batch processing',
      });
    } finally {
      setGeneratingAll(false);
      fetchCurrentBatch();
    }
  };

  const [tightening, setTightening] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [audioCacheKey, setAudioCacheKey] = useState<number>(Date.now());
  const [silenceThreshold, setSilenceThreshold] = useState<number>(0.18);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [subtitleModalType, setSubtitleModalType] = useState<'master' | 'tight'>('master');
  const [wordTimestamps, setWordTimestamps] = useState<any>(null);
  const [loadingTimestamps, setLoadingTimestamps] = useState(false);
  const [copiedWords, setCopiedWords] = useState(false);

  const handleCombineBatchAudio = async () => {
    if (!selectedBatchId) return;
    try {
      await api.combineBatchAudio(selectedBatchId);
      setAudioCacheKey(Date.now());
      await fetchCurrentBatch();
    } catch (e: any) {
      alert(e.message || 'Failed to combine batch audio');
    }
  };

  const handleTightenBatchAudio = async () => {
    if (!selectedBatchId) return;
    setTightening(true);
    try {
      await api.tightenBatchAudio(selectedBatchId, silenceThreshold);
      setAudioCacheKey(Date.now());
      await fetchCurrentBatch();
    } catch (e: any) {
      alert(e.message || 'Failed to trim pauses');
    } finally {
      setTightening(false);
    }
  };

  const handleRebuildAll = async () => {
    if (!selectedBatchId) return;
    setRebuilding(true);
    try {
      await api.rebuildAllBatchAudio(selectedBatchId, silenceThreshold);
      setAudioCacheKey(Date.now());
      await fetchCurrentBatch();
    } catch (e: any) {
      alert(e.message || 'Failed to rebuild narration');
    } finally {
      setRebuilding(false);
    }
  };

  const handleViewTimestamps = async (type: 'master' | 'tight') => {
    if (!selectedBatchId) return;
    setSubtitleModalType(type);
    setShowSubtitleModal(true);
    setLoadingTimestamps(true);
    try {
      const data = await api.getBatchWordTimestamps(selectedBatchId, type);
      setWordTimestamps(data);
    } catch (e: any) {
      alert(e.message || 'Failed to fetch timestamps');
    } finally {
      setLoadingTimestamps(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const res = await api.getSettings();
      await api.openFolder(res.output_folder);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Project Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-studio-cardBorder">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-mono text-blue-400 font-bold">PROJECT WORKSPACE</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {project.name}
            </h1>
          </div>
        </div>

        {/* Batch Selector and Add Batch Button */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {batches.length > 0 && (
            <div className="flex items-center space-x-2 bg-studio-card p-1 rounded-xl border border-studio-cardBorder">
              <span className="text-xs text-studio-textMuted px-2 font-mono">Batch:</span>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="bg-[#152037] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.paragraphs.length} paras)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowNewBatchModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>NEW BATCH</span>
          </button>

          <button
            onClick={handleOpenFolder}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            title="Open local outputs directory in Finder / File Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>OUTPUT FOLDER</span>
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-16 bg-studio-card/30 border border-dashed border-studio-cardBorder rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Batches Created Yet</h3>
            <p className="text-xs text-studio-textMuted max-w-sm mx-auto">
              Create "Batch 01" to paste your AI Studio reference script and begin voiceover generation.
            </p>
          </div>
          <button
            onClick={() => setShowNewBatchModal(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Batch 01</span>
          </button>
        </div>
      ) : currentBatch ? (
        <div className="space-y-6">
          {/* Batch Status Bar & Action Banner */}
          <div className="bg-[#121B2D] border border-studio-cardBorder rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-3">
                <h2 className="text-base font-bold text-white">{currentBatch.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                  {currentBatch.status}
                </span>
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-studio-textMuted">
                <span>Total Paras: <strong className="text-white">{currentBatch.paragraphs.length}</strong></span>
                <span>&bull;</span>
                <span>Words: <strong className="text-white">{currentBatch.total_words}</strong></span>
                <span>&bull;</span>
                <span className="text-emerald-400">Ready: <strong>{currentBatch.ready_count}</strong></span>
                {currentBatch.over_limit_count > 0 && (
                  <>
                    <span>&bull;</span>
                    <span className="text-rose-400 font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 inline" />
                      <span>Over Limit: {currentBatch.over_limit_count}</span>
                    </span>
                  </>
                )}
                <span>&bull;</span>
                <span className="text-blue-400">Completed: <strong>{currentBatch.completed_count}</strong></span>
              </div>
            </div>

            {/* Main Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all shadow"
              >
                <FileDown className="w-4 h-4 text-blue-400" />
                <span>IMPORT SCRIPT REFERENCE</span>
              </button>

              {currentBatch.completed_count > 1 && (
                <button
                  onClick={handleRebuildAll}
                  disabled={rebuilding}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                  title="Rebuilds both Full Batch Narration and No-Pause Timeline MP4 using current paragraph audios"
                >
                  {rebuilding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>REBUILDING NARRATION...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>REBUILD FULL NARRATION & MP4</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleGenerateAllReady}
                disabled={generatingAll || currentBatch.ready_count === 0}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                title="Sequentially generates all READY paragraphs in this batch"
              >
                {generatingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>GENERATING BATCH...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>GENERATE ALL READY ({currentBatch.ready_count})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sequential Progress Bar (if generating) */}
          <GenerationProgress
            currentParagraph={progressState.current}
            totalParagraphs={progressState.total}
            status={progressState.status}
            message={progressState.message}
          />

          {/* Combined Full Batch Audio Player Card */}
          {currentBatch.combined_audio && (
            <div className="space-y-4">
              {/* Master Combined Audio */}
              <div className="bg-gradient-to-r from-[#111E36] to-[#16233F] border-2 border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-sm text-white tracking-wide">
                          FULL BATCH NARRATION (ALL PARTS JOINED)
                        </h3>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30 font-bold">
                          Master Audio
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">
                        Original Duration: <strong>{currentBatch.combined_audio.duration}s</strong> &bull; Complete sequential voiceover of all {currentBatch.completed_count} parts
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleRebuildAll}
                      disabled={rebuilding}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold border border-indigo-500/50 shadow transition-all active:scale-95"
                      title="Rebuild narration if you updated or re-generated any paragraph audio"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
                      <span>REBUILD ALL</span>
                    </button>

                    <select
                      value={silenceThreshold}
                      onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                      className="bg-slate-900/90 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 font-bold shadow"
                      title="Select pause trimming aggressiveness"
                    >
                      <option value={0.12}>🔥 Ultra-Tight (0.12s)</option>
                      <option value={0.18}>⚡ Clean & Punchy (0.18s)</option>
                      <option value={0.28}>🌿 Natural (0.28s)</option>
                    </select>

                    <button
                      onClick={handleTightenBatchAudio}
                      disabled={tightening}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-orange-500/20 transition-all active:scale-95"
                      title="Automatically trim dead pauses/silences and generate a fast, punchy narration track + 1080p MP4 timeline video"
                    >
                      {tightening ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>TRIMMING PAUSES...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>TRIM PAUSES & CREATE MP4</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`${api.getBatchAudioUrl(currentBatch.id, 'wav', true)}&t=${audioCacheKey}`}
                      download
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                      title="Download Combined Master WAV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>FULL WAV</span>
                    </a>

                    {currentBatch.combined_audio.mp3_path && (
                      <a
                        href={`${api.getBatchAudioUrl(currentBatch.id, 'mp3', true)}&t=${audioCacheKey}`}
                        download
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow transition-all"
                        title="Download Combined 320k MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>FULL MP3</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Combined Audio Element */}
                <audio
                  key={`combined-${audioCacheKey}`}
                  controls
                  className="w-full h-10 rounded-xl accent-indigo-500"
                  src={`${api.getBatchAudioUrl(currentBatch.id, 'wav')}?t=${audioCacheKey}`}
                />
                {/* Master Subtitle & Timestamp Actions */}
                <div className="pt-2 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-xs text-indigo-300 font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-semibold">Subtitles & Timestamps:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleViewTimestamps('master')}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 text-xs font-semibold transition-all"
                      title="Inspect word-by-word timestamps"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>VIEW WORD TIMESTAMPS</span>
                    </button>

                    <a
                      href={api.getBatchSubtitlesUrl(currentBatch.id, 'srt', 'master', true)}
                      download
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                      title="Download SubRip .SRT (Premiere, CapCut, DaVinci)"
                    >
                      <Download className="w-3 h-3" />
                      <span>.SRT</span>
                    </a>

                    <a
                      href={api.getBatchSubtitlesUrl(currentBatch.id, 'vtt', 'master', true)}
                      download
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                      title="Download WebVTT .VTT"
                    >
                      <Download className="w-3 h-3" />
                      <span>.VTT</span>
                    </a>

                    <a
                      href={api.getBatchSubtitlesUrl(currentBatch.id, 'json', 'master', true)}
                      download
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                      title="Download Word-by-Word JSON Timestamps"
                    >
                      <Download className="w-3 h-3" />
                      <span>WORDS (.JSON)</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* No-Pause Fast Narration Track + Timeline MP4 Card */}
              {currentBatch.tight_audio && (
                <div className="bg-gradient-to-r from-[#0E1F24] to-[#122A26] border-2 border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                        <Zap className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-sm text-white tracking-wide">
                            NO-PAUSE NARRATION (AUTO-TRIMMED & TIMELINE MP4)
                          </h3>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-bold">
                            Fast / Punchy Edit
                          </span>
                        </div>
                        <p className="text-xs text-emerald-300/80 font-mono mt-0.5">
                          Duration: <strong>{currentBatch.tight_audio.duration}s</strong> (saved {roundTwo((currentBatch.combined_audio.duration || 0) - currentBatch.tight_audio.duration)}s of pauses) &bull; Ready for Premiere, CapCut & DaVinci
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentBatch.tight_audio.mp4_path && (
                        <a
                          href={`${api.getBatchTightAudioUrl(currentBatch.id, 'mp4', true)}&t=${audioCacheKey}`}
                          download
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                          title="Download 1080p MP4 Timeline Video (Drop directly onto video editing timeline)"
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>DOWNLOAD TIMELINE MP4 (1080p)</span>
                        </a>
                      )}

                      <a
                        href={`${api.getBatchTightAudioUrl(currentBatch.id, 'wav', true)}&t=${audioCacheKey}`}
                        download
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow transition-all"
                        title="Download No-Pause Master WAV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>NO-PAUSE WAV</span>
                      </a>

                      {currentBatch.tight_audio.mp3_path && (
                        <a
                          href={`${api.getBatchTightAudioUrl(currentBatch.id, 'mp3', true)}&t=${audioCacheKey}`}
                          download
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow transition-all"
                          title="Download No-Pause 320k MP3"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>NO-PAUSE MP3</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Tight Audio Element */}
                  <audio
                    key={`tight-${audioCacheKey}`}
                    controls
                    className="w-full h-10 rounded-xl accent-emerald-500"
                    src={`${api.getBatchTightAudioUrl(currentBatch.id, 'wav')}?t=${audioCacheKey}`}
                  />

                  {/* Tight Subtitle & Timestamp Actions */}
                  <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-xs text-emerald-300 font-mono">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-semibold">No-Pause Subtitles & Timestamps:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleViewTimestamps('tight')}
                        className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition-all"
                        title="Inspect word-by-word timestamps for tight audio"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW NO-PAUSE TIMESTAMPS</span>
                      </button>

                      <a
                        href={api.getBatchSubtitlesUrl(currentBatch.id, 'srt', 'tight', true)}
                        download
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                        title="Download Aligned .SRT Subtitles for Tight Audio"
                      >
                        <Download className="w-3 h-3" />
                        <span>NO-PAUSE .SRT</span>
                      </a>

                      <a
                        href={api.getBatchSubtitlesUrl(currentBatch.id, 'vtt', 'tight', true)}
                        download
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                        title="Download Aligned .VTT Subtitles for Tight Audio"
                      >
                        <Download className="w-3 h-3" />
                        <span>NO-PAUSE .VTT</span>
                      </a>

                      <a
                        href={api.getBatchSubtitlesUrl(currentBatch.id, 'json', 'tight', true)}
                        download
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                        title="Download No-Pause Word-by-Word JSON Timestamps"
                      >
                        <Download className="w-3 h-3" />
                        <span>WORDS (.JSON)</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paragraphs List */}
          {currentBatch.paragraphs.length === 0 ? (
            <div className="text-center py-12 bg-studio-card/20 border border-dashed border-studio-cardBorder rounded-2xl space-y-3">
              <p className="text-xs text-studio-textMuted">
                This batch has no paragraphs yet. Paste your AI Studio script breakdown to populate.
              </p>
              <button
                onClick={() => setShowImporter(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
              >
                <FileDown className="w-4 h-4" />
                <span>Import Script Reference</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {currentBatch.paragraphs.map((p) => (
                <ParagraphCard
                  key={p.id}
                  paragraph={p}
                  voices={voices}
                  onUpdated={fetchCurrentBatch}
                  onDeleted={() => fetchCurrentBatch()}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Reference Importer Modal */}
      {showImporter && selectedBatchId && (
        <ReferenceImporter
          batchId={selectedBatchId}
          onImportSuccess={fetchCurrentBatch}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* New Batch Modal */}
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111A2C] border border-[#233554] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <form onSubmit={handleCreateBatch}>
              <div className="px-6 py-4 border-b border-studio-cardBorder bg-[#152037]">
                <h3 className="font-bold text-sm text-white">CREATE NEW BATCH</h3>
                <p className="text-xs text-studio-textMuted">Batch {batches.length + 1} for {project.name}</p>
              </div>

              <div className="p-6 space-y-3">
                <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                  Batch Name
                </label>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder={`Batch ${batches.length + 1 < 10 ? '0' : ''}${batches.length + 1}`}
                  className="w-full bg-studio-bg border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  autoFocus
                />
              </div>

              <div className="px-6 py-4 border-t border-studio-cardBorder bg-[#152037] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  CREATE BATCH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subtitle & Word-Level Timestamps Inspector Modal */}
      {showSubtitleModal && currentBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0F172A] border border-[#233554] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-[#141E33] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white tracking-wide uppercase">
                    Word-Level Timestamps ({subtitleModalType === 'tight' ? 'No-Pause Narration' : 'Master Narration'})
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {currentBatch.name} &bull; {wordTimestamps?.total_words || 0} words &bull; {wordTimestamps?.total_duration || 0}s duration
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSubtitleModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingTimestamps ? (
                <div className="py-16 text-center text-slate-400 font-mono space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
                  <p className="text-xs">Loading word-level timestamps...</p>
                </div>
              ) : wordTimestamps && wordTimestamps.words && wordTimestamps.words.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
                    <span>Click copy to export words or use direct download buttons below</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(wordTimestamps, null, 2));
                        setCopiedWords(true);
                        setTimeout(() => setCopiedWords(false), 2000);
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
                    >
                      {copiedWords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWords ? 'Copied JSON!' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  {/* Word Grid Table */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {wordTimestamps.words.map((w: any, i: number) => (
                      <div
                        key={i}
                        className="bg-[#152037] border border-slate-800/80 hover:border-blue-500/50 rounded-xl p-2.5 flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="text-[10px] font-mono text-slate-500 w-5">#{w.index}</span>
                          <span className="text-xs font-bold text-white group-hover:text-blue-300 truncate">{w.word}</span>
                        </div>
                        <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex-shrink-0 ml-2">
                          {w.start}s &rarr; {w.end}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 font-mono text-xs">
                  No word timestamps generated yet. Click 'Rebuild Full Narration' to generate.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-[#141E33] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Downloads:</span>
                <a
                  href={api.getBatchSubtitlesUrl(currentBatch.id, 'srt', subtitleModalType, true)}
                  download
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-all"
                >
                  Download .SRT
                </a>
                <a
                  href={api.getBatchSubtitlesUrl(currentBatch.id, 'vtt', subtitleModalType, true)}
                  download
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
                >
                  Download .VTT
                </a>
                <a
                  href={api.getBatchSubtitlesUrl(currentBatch.id, 'json', subtitleModalType, true)}
                  download
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
                >
                  Download Words (.JSON)
                </a>
              </div>

              <button
                onClick={() => setShowSubtitleModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
