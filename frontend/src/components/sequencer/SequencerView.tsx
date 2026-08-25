import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Upload,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FolderOpen,
  Trash2,
  MoveUp,
  MoveDown,
  Play,
  Pause,
  Subtitles,
  Plus
} from 'lucide-react';
import { Project, Batch, SequenceSegment, SceneAsset } from '../../types';
import { api } from '../../api';

interface SequencerViewProps {
  project: Project;
  batch: Batch;
  onBack: () => void;
}

export const SequencerView: React.FC<SequencerViewProps> = ({
  project,
  batch,
  onBack,
}) => {
  const [segments, setSegments] = useState<SequenceSegment[]>([]);
  const [tightDurationMs, setTightDurationMs] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [autoMatching, setAutoMatching] = useState(false);
  const [composing, setComposing] = useState(false);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [composedVideoUrl, setComposedVideoUrl] = useState<string | null>(null);
  const [uploadingForParaId, setUploadingForParaId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSequence();
  }, [batch.id]);

  const loadSequence = async () => {
    setLoading(true);
    try {
      const data = await api.getBatchVisualSequence(batch.id);
      setSegments(data.segments || []);
      setTightDurationMs(data.tight_duration_ms || 0);
    } catch (err: any) {
      console.error('Failed to load sequence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await api.autoMatchBatchAssets(batch.id);
      if (res.sequence) {
        setSegments(res.sequence.segments || []);
        setTightDurationMs(res.sequence.tight_duration_ms || 0);
      }
      alert(
        `⚡ Auto-Match Complete!\nScanned: ${res.scanned_files} files\nMatched: ${res.matched_assets_count} assets paired with paragraph scenes.`
      );
    } catch (err: any) {
      alert(err.message || 'Auto-match failed');
    } finally {
      setAutoMatching(false);
    }
  };

  const handleManualUpload = (paraId: number) => {
    setUploadingForParaId(paraId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadingForParaId) return;
    const file = e.target.files[0];
    try {
      await api.uploadParagraphAsset(batch.id, uploadingForParaId, file);
      await loadSequence();
    } catch (err: any) {
      alert(err.message || 'Failed to upload asset');
    } finally {
      setUploadingForParaId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    try {
      await api.deleteSceneAsset(batch.id, assetId);
      await loadSequence();
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    }
  };

  const handleMoveSegment = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= segments.length) return;

    const newSegments = [...segments];
    const temp = newSegments[index];
    newSegments[index] = newSegments[targetIndex];
    newSegments[targetIndex] = temp;
    setSegments(newSegments);

    // Save updated sequence order
    const flatAssets: any[] = [];
    newSegments.forEach((seg, sIdx) => {
      seg.assets.forEach((ast, aIdx) => {
        flatAssets.push({
          id: ast.id,
          paragraph_id: seg.paragraph_id,
          sequence_index: sIdx,
          order_index: aIdx,
        });
      });
    });

    try {
      await api.updateBatchSequenceOrder(batch.id, flatAssets);
    } catch (err: any) {
      console.error('Failed to save reorder:', err);
    }
  };

  const handleComposeVideo = async () => {
    setComposing(true);
    setComposedVideoUrl(null);
    try {
      const res = await api.composeFinalVideo(batch.id, burnSubtitles);
      setComposedVideoUrl(api.getComposedVideoUrl(batch.id));
      alert('🎉 Final Video (Visuals + Tight Narration + Subtitles) Composed Successfully!');
    } catch (err: any) {
      alert(err.message || 'Compose failed');
    } finally {
      setComposing(false);
    }
  };

  const totalAssigned = segments.filter((s) => s.assets && s.assets.length > 0).length;
  const totalParagraphs = segments.length;
  const isFullyMatched = totalAssigned === totalParagraphs && totalParagraphs > 0;

  const formatMs = (ms: number) => {
    const totalSecs = ms / 1000;
    const m = Math.floor(totalSecs / 60);
    const s = (totalSecs % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050811] text-white flex flex-col overflow-hidden select-none animate-fadeIn">
      {/* Hidden File Input for Manual Asset Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Top Header & Actions Bar */}
      <header className="h-16 bg-[#090E1A] border-b border-[#1F2E4A] px-6 flex items-center justify-between shadow-xl flex-shrink-0">
        {/* Left: Back & Project Info */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO BATCH</span>
          </button>

          <div className="h-5 w-px bg-slate-700/80" />

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-extrabold text-white tracking-wide">
                {project.name} &bull; Batch {batch.batch_number.toString().padStart(2, '0')}
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Visual Sequencer
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Tight Narration: <strong>{(tightDurationMs / 1000).toFixed(1)}s</strong> &bull; {totalParagraphs} Paragraph Scenes
            </p>
          </div>
        </div>

        {/* Center: Match Summary Badge */}
        <div className="hidden md:flex items-center space-x-2">
          {isFullyMatched ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All {totalParagraphs}/{totalParagraphs} Segments Paired</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalAssigned}/{totalParagraphs} Segments Paired ({totalParagraphs - totalAssigned} Missing)</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAutoMatch}
            disabled={autoMatching}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
            title="Scans outputs/<Project>/Batch_XX/assets/ and auto-matches files by Paragraph_XX_Part_Y name"
          >
            <Sparkles className={`w-3.5 h-3.5 ${autoMatching ? 'animate-spin' : ''}`} />
            <span>{autoMatching ? 'AUTO-MATCHING...' : 'AUTO-MATCH FROM ASSETS FOLDER'}</span>
          </button>

          <label className="flex items-center space-x-1.5 text-xs text-slate-300 font-mono cursor-pointer select-none bg-[#111A30] px-3 py-2 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={burnSubtitles}
              onChange={(e) => setBurnSubtitles(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Burn Subtitles</span>
          </label>

          <button
            onClick={handleComposeVideo}
            disabled={composing}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all active:scale-95"
          >
            <Film className={`w-4 h-4 ${composing ? 'animate-spin' : ''}`} />
            <span>{composing ? 'COMPOSING FINAL VIDEO...' : 'COMPOSE FINAL VIDEO'}</span>
          </button>

          {composedVideoUrl && (
            <a
              href={`${api.getComposedVideoUrl(batch.id, true)}&t=${Date.now()}`}
              download
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all animate-bounce"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD FINAL MP4</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {loading ? (
          <div className="text-center py-24 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading tight-timeline paragraph sequence...</p>
          </div>
        ) : segments.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 space-y-3">
            <Film className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Narration Segments Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Please generate the batch narration audio first before visual sequencing.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-6xl mx-auto">
            {segments.map((seg, idx) => {
              const hasAssets = seg.assets && seg.assets.length > 0;

              return (
                <div
                  key={seg.paragraph_id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    hasAssets
                      ? 'bg-[#0E1729] border-[#1F2E4A] hover:border-slate-700'
                      : 'bg-[#14121F] border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  {/* Left: Move Handles & Sequence Number */}
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => handleMoveSegment(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-white"
                        title="Move Up"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveSegment(idx, 'down')}
                        disabled={idx === segments.length - 1}
                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-white"
                        title="Move Down"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          #{seg.paragraph_number}
                        </span>
                        <span className="text-xs font-bold text-white truncate max-w-[200px]">
                          {seg.part_title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 font-bold bg-black/40 px-2 py-0.5 rounded-md border border-slate-800 w-fit">
                        {formatMs(seg.start_ms)} - {formatMs(seg.end_ms)} ({(seg.duration_ms / 1000).toFixed(1)}s)
                      </div>
                    </div>
                  </div>

                  {/* Center: Subtitle Transcript Preview */}
                  <div className="flex-1 px-2 md:px-4 max-w-xl">
                    <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed italic">
                      "{seg.subtitle_text}"
                    </p>
                  </div>

                  {/* Right: Assigned Asset Thumbnails & Actions */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {hasAssets ? (
                      <div className="flex items-center space-x-2">
                        {seg.assets.map((asset) => (
                          <div
                            key={asset.id}
                            className="relative group w-20 h-14 rounded-xl overflow-hidden bg-black border border-slate-700 shadow-md flex-shrink-0"
                          >
                            {asset.asset_type === 'video' ? (
                              <video
                                src={`/api/scene-assets/${asset.id}/file`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={`/api/scene-assets/${asset.id}/file`}
                                alt={asset.filename}
                                className="w-full h-full object-cover"
                              />
                            )}

                            {/* Badge */}
                            <span className="absolute bottom-1 right-1 px-1 text-[8px] font-mono font-bold bg-black/80 text-emerald-300 rounded">
                              {asset.asset_type === 'video' ? 'MP4' : 'IMG'}
                            </span>

                            {/* Delete overlay */}
                            <button
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="absolute inset-0 bg-black/75 text-rose-400 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              title="Remove Asset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => handleManualUpload(seg.paragraph_id)}
                          className="w-8 h-14 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 text-slate-500 hover:text-blue-400 flex items-center justify-center transition-all bg-black/20"
                          title="Add another visual asset for this segment"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>No Asset Assigned (Soft-Fail Slate)</span>
                        </div>

                        <button
                          onClick={() => handleManualUpload(seg.paragraph_id)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all shadow"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-400" />
                          <span>UPLOAD ASSET</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
