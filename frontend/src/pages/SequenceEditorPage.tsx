import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Film,
  Download,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Project, Batch, MediaAsset, TimelineCut } from '../types';
import { api } from '../api';
import { MediaLibraryPanel } from '../components/sequence/MediaLibraryPanel';
import { VideoPreviewCanvas } from '../components/sequence/VideoPreviewCanvas';
import { ScriptCutsPanel } from '../components/sequence/ScriptCutsPanel';
import { TimelineTrack } from '../components/sequence/TimelineTrack';

interface SequenceEditorPageProps {
  project: Project;
  batch: Batch;
  onBack: () => void;
}

export const SequenceEditorPage: React.FC<SequenceEditorPageProps> = ({
  project,
  batch,
  onBack,
}) => {
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [timelineCuts, setTimelineCuts] = useState<TimelineCut[]>([]);
  const [trackType, setTrackType] = useState<'tight' | 'master'>('tight');
  const [loading, setLoading] = useState(true);
  const [aligning, setAligning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Audio Playback & Playhead State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    batch.tight_audio?.duration || batch.combined_audio?.duration || 10.0
  );

  const audioSourceUrl =
    trackType === 'tight' && batch.tight_audio
      ? api.getBatchTightAudioUrl(batch.id, 'wav')
      : api.getBatchAudioUrl(batch.id, 'wav');

  // Fetch Media and Sequence on mount
  useEffect(() => {
    loadData();
  }, [batch.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mediaData, seqData] = await Promise.all([
        api.listBatchMedia(batch.id),
        api.getBatchSequence(batch.id),
      ]);
      setMediaAssets(mediaData);
      if (seqData.timeline_cuts) {
        setTimelineCuts(seqData.timeline_cuts);
        const calculatedDur = seqData.timeline_cuts.reduce(
          (acc: number, c: TimelineCut) => Math.max(acc, c.timeline_end ?? (c as any).end_time ?? 0),
          0
        );
        if (calculatedDur > 0) setDuration(calculatedDur);
      }
    } catch (err: any) {
      console.error('Failed to load sequence editor data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize HTML5 Audio Playhead with State
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSourceUrl]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleAutoAlign = async () => {
    setAligning(true);
    try {
      const res = await api.autoAlignBatchSequence(batch.id, trackType);
      setTimelineCuts(res.timeline_cuts);
      alert(`⚡ Successfully auto-aligned ${res.total_scenes} scenes with visual media!`);
    } catch (err: any) {
      alert(err.message || 'Auto-alignment failed');
    } finally {
      setAligning(false);
    }
  };

  const handleSaveSequence = async () => {
    setSaving(true);
    try {
      await api.updateBatchSequence(batch.id, timelineCuts);
      alert('💾 Timeline sequence saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save timeline');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignMediaToCut = (cutIndex: number, mediaAssetId: number) => {
    const asset = mediaAssets.find((a) => a.id === mediaAssetId);
    if (!asset) return;

    const updated = [...timelineCuts];
    updated[cutIndex] = {
      ...updated[cutIndex],
      media_asset_id: asset.id,
      media_filename: asset.filename,
      media_type: asset.file_type,
      media_path: (asset as any).file_path || '',
      match_confidence: 100,
      match_reason: 'Manual User Selection',
    };
    setTimelineCuts(updated);
  };

  const handleToggleLock = (cutIndex: number) => {
    const updated = [...timelineCuts];
    updated[cutIndex] = {
      ...updated[cutIndex],
      locked: !updated[cutIndex].locked,
    };
    setTimelineCuts(updated);
  };

  const handleChangeMotion = (cutIndex: number, motionType: any) => {
    const updated = [...timelineCuts];
    updated[cutIndex] = {
      ...updated[cutIndex],
      motion: {
        type: motionType,
        amount: 0.08,
      },
    };
    setTimelineCuts(updated);
  };

  const handleChangeSourceTrim = (cutIndex: number, sourceStart: number, sourceEnd: number) => {
    const updated = [...timelineCuts];
    updated[cutIndex] = {
      ...updated[cutIndex],
      source_start: sourceStart,
      source_end: sourceEnd,
    };
    setTimelineCuts(updated);
  };

  const handleRenderVideo = async () => {
    setRendering(true);
    setRenderedVideoUrl(null);
    try {
      const res = await api.renderTimelineVideo(batch.id, trackType);
      setRenderedVideoUrl(api.getRenderedVideoUrl(batch.id));
      alert('🎉 1080p MP4 Video Rendered Successfully!');
    } catch (err: any) {
      alert(err.message || 'Video rendering failed');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050811] text-white flex flex-col overflow-hidden select-none animate-fadeIn">
      {/* Hidden Audio Player for Timeline Sync */}
      <audio ref={audioRef} src={audioSourceUrl} preload="auto" />

      {/* Top Navigation & Workspace Header */}
      <header className="h-16 bg-[#090E1A] border-b border-[#1F2E4A] px-5 flex items-center justify-between">
        {/* Left: Back & Project Info */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BATCH</span>
          </button>

          <div className="h-5 w-px bg-slate-700/80" />

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-extrabold text-white tracking-wide">
                {project.name} &bull; Batch {batch.batch_number.toString().padStart(2, '0')}
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                Visual Sequence Editor
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {timelineCuts.length} Scenes &bull; {duration.toFixed(1)}s Total Timeline
            </p>
          </div>
        </div>

        {/* Center: Track Selector */}
        <div className="hidden md:flex items-center bg-[#111A30] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTrackType('tight')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              trackType === 'tight'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ Tight Audio (No-Pause)
          </button>
          <button
            onClick={() => setTrackType('master')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              trackType === 'master'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎙️ Master Audio
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleAutoAlign}
            disabled={aligning}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
            title="Automatically match media assets with script scenes by filename, tags, and timestamps"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aligning ? 'animate-spin' : ''}`} />
            <span>{aligning ? 'ALIGNING...' : 'AUTO-ALIGN VISUALS'}</span>
          </button>

          <button
            onClick={handleSaveSequence}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold border border-slate-700 transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'SAVING...' : 'SAVE'}</span>
          </button>

          <button
            onClick={handleRenderVideo}
            disabled={rendering}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
          >
            <Film className={`w-3.5 h-3.5 ${rendering ? 'animate-spin' : ''}`} />
            <span>{rendering ? 'RENDERING MP4...' : 'EXPORT 1080p MP4'}</span>
          </button>

          {renderedVideoUrl && (
            <a
              href={`${api.getRenderedVideoUrl(batch.id, true)}&t=${Date.now()}`}
              download
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all animate-bounce"
              title="Download Rendered 1080p MP4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD</span>
            </a>
          )}
        </div>
      </header>

      {/* Main 3-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Media Assets Library */}
        <div className="w-72 xl:w-80 flex-shrink-0">
          <MediaLibraryPanel
            batchId={batch.id}
            mediaAssets={mediaAssets}
            onMediaUploaded={loadData}
            onMediaDeleted={(id) => setMediaAssets(mediaAssets.filter((a) => a.id !== id))}
          />
        </div>

        {/* Center Panel: 16:9 Video Canvas Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <VideoPreviewCanvas
            timelineCuts={timelineCuts}
            audioUrl={audioSourceUrl}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
          />
        </div>

        {/* Right Panel: Script & Cuts Breakdown */}
        <div className="w-80 xl:w-96 flex-shrink-0">
          <ScriptCutsPanel
            timelineCuts={timelineCuts}
            mediaAssets={mediaAssets}
            currentTime={currentTime}
            onSelectCutTime={handleSeek}
            onAssignMedia={handleAssignMediaToCut}
            onToggleLock={handleToggleLock}
            onChangeMotion={handleChangeMotion}
            onChangeSourceTrim={handleChangeSourceTrim}
          />
        </div>
      </div>

      {/* Bottom Timeline Multi-Track */}
      <TimelineTrack
        timelineCuts={timelineCuts}
        mediaAssets={mediaAssets}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
      />
    </div>
  );
};
