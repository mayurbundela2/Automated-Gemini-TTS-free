import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  AlertTriangle,
  Upload,
  Trash2,
  Plus,
  Image as ImageIcon,
  Film
} from 'lucide-react';
import { SequenceSegment } from '../../types';

interface SequenceRowProps {
  segment: SequenceSegment;
  index: number;
  onManualUpload: (paragraphId: number) => void;
  onDeleteAsset: (assetId: number) => void;
}

export const SequenceRow: React.FC<SequenceRowProps> = ({
  segment,
  index,
  onManualUpload,
  onDeleteAsset,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(segment.paragraph_id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.7 : 1,
  };

  const hasAssets = segment.assets && segment.assets.length > 0;

  const formatMs = (ms: number) => {
    const totalSecs = ms / 1000;
    const m = Math.floor(totalSecs / 60);
    const s = (totalSecs % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDragging
          ? 'bg-blue-950/80 border-blue-500 shadow-2xl scale-[1.01]'
          : hasAssets
          ? 'bg-[#0E1729] border-[#1F2E4A] hover:border-slate-700'
          : 'bg-[#14121F] border-amber-500/30 hover:border-amber-500/50'
      }`}
    >
      {/* Left: Drag Handle & Paragraph Info */}
      <div className="flex items-center space-x-3">
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white cursor-grab active:cursor-grabbing transition-all"
          title="Drag to Reorder Segment"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
              #{segment.paragraph_number}
            </span>
            <span className="text-xs font-bold text-white truncate max-w-[200px]">
              {segment.part_title}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 font-bold bg-black/40 px-2 py-0.5 rounded-md border border-slate-800 w-fit">
            {formatMs(segment.start_ms)} - {formatMs(segment.end_ms)} ({(segment.duration_ms / 1000).toFixed(1)}s)
          </div>
        </div>
      </div>

      {/* Center: Subtitle Transcript Preview */}
      <div className="flex-1 px-2 md:px-4 max-w-xl">
        <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed italic">
          "{segment.subtitle_text}"
        </p>
      </div>

      {/* Right: Assigned Asset Thumbnails & Actions */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        {hasAssets ? (
          <div className="flex items-center space-x-2">
            {segment.assets.map((asset) => (
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

                {/* Badges */}
                <span className="absolute bottom-1 right-1 px-1 text-[8px] font-mono font-bold bg-black/80 text-emerald-300 rounded">
                  {asset.asset_type === 'video' ? 'MP4' : 'IMG'}
                </span>

                {asset.matched_automatically && (
                  <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-emerald-400 shadow-sm" title="Auto-matched from assets folder" />
                )}

                {/* Delete button */}
                <button
                  onClick={() => onDeleteAsset(asset.id)}
                  className="absolute inset-0 bg-black/75 text-rose-400 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Remove Asset"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => onManualUpload(segment.paragraph_id)}
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
              <span>No Asset (Slate Card)</span>
            </div>

            <button
              onClick={() => onManualUpload(segment.paragraph_id)}
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
};
