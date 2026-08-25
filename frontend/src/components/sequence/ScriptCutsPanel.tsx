import React from 'react';
import { AlignLeft, Sparkles, CheckCircle2, AlertCircle, Film, Image as ImageIcon } from 'lucide-react';
import { TimelineCut, MediaAsset } from '../../types';
import { api } from '../../api';

interface ScriptCutsPanelProps {
  timelineCuts: TimelineCut[];
  mediaAssets: MediaAsset[];
  currentTime: number;
  onSelectCutTime: (startTime: number) => void;
  onAssignMedia: (cutIndex: number, mediaAssetId: number) => void;
}

export const ScriptCutsPanel: React.FC<ScriptCutsPanelProps> = ({
  timelineCuts,
  mediaAssets,
  currentTime,
  onSelectCutTime,
  onAssignMedia,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1527] border-l border-[#1F2E4A] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1F2E4A] bg-[#111A30] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <AlignLeft className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs text-white tracking-wide uppercase">Script & Cuts</h3>
            <span className="text-[10px] text-slate-400 font-mono">{timelineCuts.length} scenes</span>
          </div>
        </div>
      </div>

      {/* Cuts List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {timelineCuts.map((cut, idx) => {
          const isActive = currentTime >= cut.start_time && currentTime < cut.end_time;
          const assignedAsset = mediaAssets.find((a) => a.id === cut.media_asset_id);

          return (
            <div
              key={idx}
              onClick={() => onSelectCutTime(cut.start_time)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                isActive
                  ? 'bg-blue-900/25 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                  : 'bg-[#121B30] border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Top Row: Scene Number, Timecodes, Confidence */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    #{cut.scene_index}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">
                    {cut.part_title || `Scene ${cut.scene_index}`}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 font-bold bg-black/40 px-2 py-0.5 rounded-lg border border-slate-800">
                  {formatTime(cut.start_time)} - {formatTime(cut.end_time)} ({cut.duration}s)
                </div>
              </div>

              {/* Spoken Transcript Preview */}
              <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed">
                "{cut.transcript}"
              </p>

              {/* Assigned Media Preview & Selector */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  {assignedAsset ? (
                    <div className="w-8 h-8 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-slate-700">
                      {assignedAsset.file_type === 'video' ? (
                        <video src={api.getMediaFileUrl(assignedAsset.id)} className="w-full h-full object-cover" />
                      ) : (
                        <img src={api.getMediaFileUrl(assignedAsset.id)} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-500 border border-slate-700 flex-shrink-0">
                      <Film className="w-4 h-4" />
                    </div>
                  )}

                  <select
                    value={cut.media_asset_id || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val) onAssignMedia(idx, val);
                    }}
                    className="flex-1 bg-[#090E1A] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono font-medium focus:outline-none focus:border-blue-500 truncate"
                  >
                    <option value="">(Select visual media)</option>
                    {mediaAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.filename} ({asset.file_type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {cut.match_confidence ? (
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0 flex items-center space-x-1"
                    title={cut.match_reason}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{cut.match_confidence}%</span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
