import React, { useRef } from 'react';
import { TimelineCut, MediaAsset } from '../../types';
import { api } from '../../api';

interface TimelineTrackProps {
  timelineCuts: TimelineCut[];
  mediaAssets: MediaAsset[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  timelineCuts,
  mediaAssets,
  currentTime,
  duration,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalDuration = Math.max(1.0, duration);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(pct * totalDuration);
  };

  const playheadPercent = (currentTime / totalDuration) * 100;

  // Generate 10-15 time marker ticks
  const tickCount = 12;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const timeVal = (i / tickCount) * totalDuration;
    const m = Math.floor(timeVal / 60);
    const s = Math.floor(timeVal % 60);
    return {
      percent: (i / tickCount) * 100,
      label: `${m}:${s.toString().padStart(2, '0')}`,
    };
  });

  return (
    <div className="h-44 bg-[#090E1A] border-t border-[#1F2E4A] flex flex-col select-none overflow-hidden">
      {/* Timecode Ruler */}
      <div className="h-6 bg-[#0B1222] border-b border-[#1A263E] relative flex items-center px-4">
        {ticks.map((t, idx) => (
          <div
            key={idx}
            className="absolute top-0 bottom-0 flex flex-col justify-end"
            style={{ left: `${t.percent}%` }}
          >
            <div className="h-2 w-px bg-slate-700" />
            <span className="text-[9px] font-mono text-slate-500 -ml-2 mb-0.5">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Main Tracks Area with Scrubber */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="flex-1 p-3 flex flex-col justify-center space-y-2 relative cursor-pointer group"
      >
        {/* Playhead Red Needle */}
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all flex flex-col items-center"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-3 h-3 bg-rose-500 rotate-45 -mt-1 shadow-lg shadow-rose-500/50" />
          <div className="w-0.5 flex-1 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        </div>

        {/* Video Track */}
        <div className="h-14 bg-[#111A30] rounded-xl border border-[#1F2E4A] overflow-hidden flex relative shadow-inner">
          <div className="absolute left-2 top-1 text-[9px] font-mono uppercase text-blue-400 font-bold tracking-wider z-10">
            VIDEO TRACK
          </div>
          {timelineCuts.map((cut, idx) => {
            const cutWidthPct = (cut.duration / totalDuration) * 100;
            const cutStart = cut.timeline_start ?? (cut as any).start_time ?? 0;
            const cutEnd = cut.timeline_end ?? (cut as any).end_time ?? cutStart + cut.duration;
            const assignedAsset = mediaAssets.find((a) => a.id === cut.media_asset_id);
            const isPlayingCut = currentTime >= cutStart && currentTime < cutEnd;

            return (
              <div
                key={idx}
                style={{ width: `${cutWidthPct}%` }}
                className={`h-full border-r border-[#1F2E4A] relative overflow-hidden flex items-center p-1 transition-all ${
                  isPlayingCut
                    ? 'ring-2 ring-blue-400 ring-inset bg-blue-900/40'
                    : cut.locked
                    ? 'bg-amber-950/40 border-amber-500/30'
                    : 'bg-[#15213D]/70'
                }`}
                title={`Scene #${cut.scene_index}: ${cut.media_filename || 'No media'}${cut.locked ? ' (LOCKED)' : ''}`}
              >
                {assignedAsset && (
                  <div className="w-full h-full rounded-md overflow-hidden relative opacity-75">
                    {assignedAsset.file_type === 'video' ? (
                      <video src={api.getMediaFileUrl(assignedAsset.id)} className="w-full h-full object-cover" />
                    ) : (
                      <img src={api.getMediaFileUrl(assignedAsset.id)} alt="" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                )}
                <span className="absolute bottom-1 left-2 text-[10px] font-mono font-extrabold text-white truncate max-w-[90%] drop-shadow flex items-center space-x-1">
                  <span>#{cut.scene_index} {cut.media_filename ? cut.media_filename.split('.')[0] : 'Cut'}</span>
                  {cut.locked && <span className="text-[9px] text-amber-400">🔒</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Audio Waveform Track */}
        <div className="h-10 bg-[#0E1F24] rounded-xl border border-emerald-500/30 overflow-hidden relative flex items-center px-3 shadow-inner">
          <div className="text-[9px] font-mono uppercase text-emerald-400 font-bold tracking-wider z-10">
            AUDIO NARRATION (MASTER / TIGHT SYNCHRONIZED)
          </div>
          <div className="absolute inset-0 flex items-center justify-around opacity-35 px-4 pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-400 rounded-full"
                style={{ height: `${Math.sin(i * 0.35) * 40 + 50}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
