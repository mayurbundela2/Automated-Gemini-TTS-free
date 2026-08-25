import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Subtitles, Film } from 'lucide-react';
import { TimelineCut } from '../../types';
import { api } from '../../api';

interface VideoPreviewCanvasProps {
  timelineCuts: TimelineCut[];
  audioUrl: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export const VideoPreviewCanvas: React.FC<VideoPreviewCanvasProps> = ({
  timelineCuts,
  audioUrl,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
}) => {
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active cut at currentTime
  const activeCut = timelineCuts.find((cut) => {
    const cutStart = cut.timeline_start ?? (cut as any).start_time ?? 0;
    const cutEnd = cut.timeline_end ?? (cut as any).end_time ?? cutStart + cut.duration;
    return currentTime >= cutStart && currentTime < cutEnd;
  }) || (timelineCuts.length > 0 ? timelineCuts[timelineCuts.length - 1] : null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const motionType = activeCut?.motion?.type || (activeCut as any)?.motion_effect || 'zoom_in';

  return (
    <div className="flex flex-col h-full bg-[#080D1A] overflow-hidden">
      {/* 16:9 Visual Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 bg-[#050811] relative overflow-hidden"
      >
        <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800 flex items-center justify-center group">
          {activeCut?.media_path && activeCut?.media_asset_id ? (
            activeCut.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={api.getMediaFileUrl(activeCut.media_asset_id)}
                autoPlay={isPlaying}
                loop
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={api.getMediaFileUrl(activeCut.media_asset_id)}
                alt={activeCut.media_filename || 'Scene Visual'}
                className={`w-full h-full object-contain transition-transform duration-1000 ${
                  motionType === 'zoom_in'
                    ? 'scale-105'
                    : motionType === 'zoom_out'
                    ? 'scale-95'
                    : motionType === 'pan_right'
                    ? 'translate-x-2'
                    : motionType === 'pan_left'
                    ? '-translate-x-2'
                    : 'scale-100'
                }`}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-600 space-y-2">
              <Film className="w-12 h-12 stroke-[1.5]" />
              <p className="text-xs font-mono font-medium">No Visual Media Assigned for Scene</p>
            </div>
          )}

          {/* Subtitle Overlay */}
          {showSubtitles && activeCut?.transcript && (
            <div className="absolute bottom-6 inset-x-8 text-center pointer-events-none animate-fadeIn">
              <span className="inline-block bg-black/85 text-amber-300 font-extrabold text-sm md:text-base px-4 py-1.5 rounded-xl shadow-2xl border border-amber-400/30 backdrop-blur-md max-w-2xl leading-relaxed tracking-wide">
                {activeCut.transcript}
              </span>
            </div>
          )}

          {/* Scene Tag Badge with Lock Status */}
          {activeCut && (
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-black/75 text-slate-300 text-[11px] font-mono border border-slate-700/80 backdrop-blur flex items-center space-x-1.5 font-bold">
              <span className={`w-2 h-2 rounded-full ${activeCut.locked ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span>{activeCut.part_title || `Scene ${activeCut.scene_index}`}</span>
              {activeCut.locked && <span className="text-[10px] text-amber-300 ml-1">🔒 LOCKED</span>}
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-14 bg-[#0D1527] border-t border-[#1F2E4A] px-5 flex items-center justify-between">
        {/* Left: Playhead Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onSeek(0)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all active:scale-95"
            title="Jump to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onPlayPause}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="font-mono text-xs text-slate-300 pl-2">
            <span className="text-white font-bold">{formatTime(currentTime)}</span>
            <span className="text-slate-500 mx-1.5">/</span>
            <span className="text-slate-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Subtitles Toggle, Mute, Fullscreen */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSubtitles(!showSubtitles)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
              showSubtitles
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Subtitle Overlay on Video Canvas"
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>CAPTIONS</span>
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Fullscreen Preview"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
