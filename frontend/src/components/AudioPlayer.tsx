import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, FileAudio, RotateCcw, FileText } from 'lucide-react';
import { Waveform } from './Waveform';
import { api } from '../api';
import { Generation } from '../types';
import { NativeExporter } from '../services/nativeExporter';
import { ClientAudioProcessor } from '../services/clientAudioTrimmer';

interface AudioPlayerProps {
  generation: Generation;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ generation }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(generation.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const resolveSource = async () => {
      const blobKey = generation.wav_path || (generation.paragraph_id ? `para_${generation.paragraph_id}_audio` : '');
      if (blobKey) {
        try {
          const blob = await api.getAudioBlob(blobKey);
          if (blob && active) {
            const blobUrl = URL.createObjectURL(blob);
            setResolvedAudioUrl(blobUrl);
            return;
          }
        } catch {}
      }
      if (active) {
        setResolvedAudioUrl(api.getAudioUrl(generation.id, 'wav'));
      }
    };

    resolveSource();
    return () => {
      active = false;
      if (resolvedAudioUrl && resolvedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedAudioUrl);
      }
    };
  }, [generation.id, generation.wav_path, generation.paragraph_id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (seekTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else if (isMuted) setIsMuted(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-[#0B1322] border border-[#1F2E4A] rounded-xl p-4 flex flex-col space-y-3 shadow-inner">
      <audio ref={audioRef} src={resolvedAudioUrl} preload="metadata" />

      {/* Top Header / Audio File Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <FileAudio className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="text-xs font-semibold text-white tracking-wide">
                {generation.voice}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 font-mono">
                {generation.model.replace('gemini-', '').replace('-preview', '')}
              </span>
              <span className="text-[10px] text-studio-textMuted font-mono">
                ({formatTime(currentTime)} / {formatTime(duration)})
              </span>
            </div>
          </div>
        </div>

        {/* Download & Export Buttons */}
        <div className="flex items-center space-x-1.5 self-end sm:self-auto flex-shrink-0">
          <button
            onClick={async () => {
              const blobKey = generation.wav_path || (generation.paragraph_id ? `para_${generation.paragraph_id}_audio` : '');
              let blob: Blob | null = null;
              if (blobKey) {
                blob = await api.getAudioBlob(blobKey);
              }
              if (blob) {
                await NativeExporter.shareOrDownloadBlob(blob, `paragraph_${generation.paragraph_id || generation.id}.wav`);
              } else {
                await NativeExporter.shareAudioUrl(api.getAudioUrl(generation.id, 'wav', true), `paragraph_${generation.paragraph_id || generation.id}.wav`);
              }
            }}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-colors shadow-sm active:scale-95"
            title="Download Lossless Master WAV file"
          >
            <Download className="w-3 h-3" />
            <span>WAV</span>
          </button>

          <button
            onClick={async () => {
              try {
                const blobKey = generation.wav_path || (generation.paragraph_id ? `para_${generation.paragraph_id}_audio` : '');
                let blob: Blob | null = null;
                if (blobKey) {
                  blob = await api.getAudioBlob(blobKey);
                }
                const transcript = generation.raw_prompt || '';
                if (blob) {
                  const buffer = await ClientAudioProcessor.decodeAudioBlob(blob);
                  const intervals = ClientAudioProcessor.detectSpeechIntervals(buffer, -40, 0.15);
                  const subResult = ClientAudioProcessor.generateSubtitles(transcript, intervals, buffer.duration, 4);
                  await NativeExporter.shareText(`Subtitles`, subResult.srt, `paragraph_${generation.paragraph_id || generation.id}.srt`);
                  return;
                }
                const srtText = await api.getSubtitleText(generation.id);
                if (srtText) {
                  await NativeExporter.shareText(`Subtitles`, srtText, `paragraph_${generation.paragraph_id || generation.id}.srt`);
                }
              } catch (e: any) {
                alert(e.message || 'Could not export paragraph subtitle');
              }
            }}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-colors shadow-sm active:scale-95"
            title="Export .SRT Subtitles"
          >
            <FileText className="w-3 h-3 text-indigo-400" />
            <span>.SRT</span>
          </button>
        </div>
      </div>

      {/* Waveform Visualizer */}
      <Waveform
        peaks={generation.waveform?.peaks}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        height={46}
      />

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {/* Play / Pause / Replay */}
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-md shadow-blue-600/20"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => handleSeek(0)}
            className="p-1 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
            title="Replay from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="flex items-center space-x-0.5 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-1.5 py-0.5 rounded transition-all ${
                playbackRate === rate ? 'bg-blue-600 text-white font-bold' : 'text-studio-textMuted hover:text-white'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume & Additional Downloads */}
        <div className="flex items-center space-x-1.5">
          <button onClick={toggleMute} className="text-studio-textMuted hover:text-white transition-colors p-1">
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-12 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hidden sm:inline-block"
          />

          {generation.mp3_path && (
            <a
              href={api.getAudioUrl(generation.id, 'mp3', true)}
              download
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition-all"
              title="Download MP3"
            >
              MP3
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
