import React from 'react';
import { AlignLeft, Sparkles, Lock, Unlock, Film, Image as ImageIcon, Sliders, Scissors } from 'lucide-react';
import { TimelineCut, MediaAsset } from '../../types';
import { api } from '../../api';

interface ScriptCutsPanelProps {
  timelineCuts: TimelineCut[];
  mediaAssets: MediaAsset[];
  currentTime: number;
  onSelectCutTime: (startTime: number) => void;
  onAssignMedia: (cutIndex: number, mediaAssetId: number) => void;
  onToggleLock: (cutIndex: number) => void;
  onChangeMotion: (cutIndex: number, motionType: any) => void;
  onChangeSourceTrim: (cutIndex: number, sourceStart: number, sourceEnd: number) => void;
}

export const ScriptCutsPanel: React.FC<ScriptCutsPanelProps> = ({
  timelineCuts,
  mediaAssets,
  currentTime,
  onSelectCutTime,
  onAssignMedia,
  onToggleLock,
  onChangeMotion,
  onChangeSourceTrim,
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
            <h3 className="font-extrabold text-xs text-white tracking-wide uppercase">Script & Scene Cuts</h3>
            <span className="text-[10px] text-slate-400 font-mono">{timelineCuts.length} scenes</span>
          </div>
        </div>
      </div>

      {/* Cuts List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {timelineCuts.map((cut, idx) => {
          const cutStart = cut.timeline_start ?? (cut as any).start_time ?? 0;
          const cutEnd = cut.timeline_end ?? (cut as any).end_time ?? cutStart + cut.duration;
          const isActive = currentTime >= cutStart && currentTime < cutEnd;
          const assignedAsset = mediaAssets.find((a) => a.id === cut.media_asset_id);
          const motionType = cut.motion?.type || (cut as any).motion_effect || 'zoom_in';

          return (
            <div
              key={idx}
              onClick={() => onSelectCutTime(cutStart)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                cut.locked
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                  : isActive
                  ? 'bg-blue-900/25 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                  : 'bg-[#121B30] border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Top Row: Scene Number, Timecodes, Lock Button */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    #{cut.scene_index}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    {cut.part_title || `Scene ${cut.scene_index}`}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <div className="text-[11px] font-mono text-slate-400 font-bold bg-black/40 px-2 py-0.5 rounded-lg border border-slate-800">
                    {formatTime(cutStart)} - {formatTime(cutEnd)} ({cut.duration}s)
                  </div>

                  {/* Lock Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(idx);
                    }}
                    className={`p-1 rounded-lg border transition-all ${
                      cut.locked
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'text-slate-500 hover:text-slate-300 border-transparent hover:bg-slate-800'
                    }`}
                    title={cut.locked ? 'Locked: Auto-align will not overwrite this cut' : 'Unlocked: Click to lock approved visual'}
                  >
                    {cut.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Spoken Transcript Preview */}
              <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed">
                "{cut.transcript}"
              </p>

              {/* Assigned Media Selector */}
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

              {/* Advanced Motion & Trim Controls */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* Motion Preset Selector */}
                <div className="flex items-center space-x-1 bg-[#090E1A] border border-slate-800 rounded-lg px-2 py-1">
                  <Sliders className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <select
                    value={motionType}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChangeMotion(idx, e.target.value)}
                    className="bg-transparent text-[10px] font-mono text-indigo-200 focus:outline-none w-full"
                    title="Camera motion animation for this scene"
                  >
                    <option value="zoom_in">Zoom In (Ken Burns)</option>
                    <option value="zoom_out">Zoom Out</option>
                    <option value="pan_right">Pan Right</option>
                    <option value="pan_left">Pan Left</option>
                    <option value="static">Static (No Motion)</option>
                  </select>
                </div>

                {/* Video Source In/Out Trim (if video) */}
                {cut.media_type === 'video' ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center space-x-1 bg-[#090E1A] border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300"
                    title="Source In/Out start point in seconds"
                  >
                    <Scissors className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="text-slate-500">In:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={cut.source_start || 0}
                      onChange={(e) => {
                        const sStart = parseFloat(e.target.value) || 0;
                        onChangeSourceTrim(idx, sStart, sStart + cut.duration);
                      }}
                      className="w-12 bg-transparent text-cyan-300 focus:outline-none"
                    />
                    <span className="text-slate-500">s</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 bg-[#090E1A] border border-slate-800/60 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-500">
                    <span>Duration: {cut.duration}s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
