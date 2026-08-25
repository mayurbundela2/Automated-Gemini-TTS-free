import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Sparkles,
  Film,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Project, Batch, SequenceSegment } from '../../types';
import { api } from '../../api';
import { SequenceRow } from './SequenceRow';

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = segments.findIndex((s) => String(s.paragraph_id) === active.id);
    const newIndex = segments.findIndex((s) => String(s.paragraph_id) === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newSegments = arrayMove(segments, oldIndex, newIndex);
    setSegments(newSegments);

    // Save updated sequence ordering
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
      alert('🎉 Final Video (Visuals + Tight Audio + Subtitles) Composed Successfully!');
    } catch (err: any) {
      alert(err.message || 'Compose failed');
    } finally {
      setComposing(false);
    }
  };

  const totalAssigned = segments.filter((s) => s.assets && s.assets.length > 0).length;
  const totalParagraphs = segments.length;
  const isFullyMatched = totalAssigned === totalParagraphs && totalParagraphs > 0;

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

      {/* Horizontal Timeline Ruler */}
      {tightDurationMs > 0 && (
        <div className="h-10 bg-[#0A1020] border-b border-[#1F2E4A] px-6 flex items-center overflow-x-auto flex-shrink-0">
          <div className="w-full h-5 bg-[#121D38] rounded-lg relative overflow-hidden flex shadow-inner">
            {segments.map((seg, idx) => {
              const widthPct = (seg.duration_ms / tightDurationMs) * 100;
              const hasAsset = seg.assets && seg.assets.length > 0;
              return (
                <div
                  key={idx}
                  style={{ width: `${widthPct}%` }}
                  className={`h-full border-r border-[#1F2E4A] flex items-center justify-center px-1 overflow-hidden transition-all ${
                    hasAsset ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/40 text-amber-300'
                  }`}
                  title={`#${seg.paragraph_number}: ${seg.part_title} (${(seg.duration_ms / 1000).toFixed(1)}s)`}
                >
                  <span className="text-[9px] font-mono font-bold truncate">#{seg.paragraph_number}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Drag-and-Drop Sortable List */}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={segments.map((s) => String(s.paragraph_id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 max-w-6xl mx-auto">
                {segments.map((seg, idx) => (
                  <SequenceRow
                    key={seg.paragraph_id}
                    segment={seg}
                    index={idx}
                    onManualUpload={handleManualUpload}
                    onDeleteAsset={handleDeleteAsset}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};
