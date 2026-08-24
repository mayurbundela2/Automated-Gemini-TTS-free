import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, FileAudio, RotateCcw, FileText } from 'lucide-react';
import { Waveform } from './Waveform';
import { api } from '../api';
import { Generation } from '../types';

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

  // Audio source URL
  const audioUrl = api.getAudioUrl(generation.id, 'wav');

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
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Top Header / Audio File Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <FileAudio className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white tracking-wide">
              {generation.voice} &bull; {generation.model}
            </span>
            <span className="text-[10px] text-studio-textMuted ml-2 font-mono">
              ({formatTime(currentTime)} / {formatTime(duration)})
            </span>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getAudioUrl(generation.id, 'wav', true)}
            download
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-colors shadow-sm"
            title="Download Lossless Master WAV file"
          >
            <Download className="w-3 h-3" />
            <span>DOWNLOAD WAV</span>
          </a>

          {generation.mp3_path && (
            <a
              href={api.getAudioUrl(generation.id, 'mp3', true)}
              download
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-colors shadow-sm"
              title="Download 320kbps MP3 file"
            >
              <Download className="w-3 h-3" />
              <span>DOWNLOAD MP3</span>
            </a>
          )}
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
      <div className="flex items-center justify-between pt-1">
        {/* Play / Pause / Replay */}
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-md shadow-blue-600/20"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => handleSeek(0)}
            className="p-1.5 rounded-lg text-studio-textMuted hover:text-white hover:bg-slate-800 transition-colors"
            title="Replay from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="flex items-center space-x-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-1.5 py-0.5 rounded ${
                playbackRate === rate ? 'bg-blue-600 text-white font-bold' : 'text-studio-textMuted hover:text-white'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume & Downloads */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 mr-2">
            <button onClick={toggleMute} className="text-studio-textMuted hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <a
            href={api.getAudioUrl(generation.id, 'wav', true)}
            download
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] font-bold shadow transition-all"
            title="Download Master Lossless WAV"
          >
            <Download className="w-3 h-3" />
            <span>WAV</span>
          </a>

          {generation.mp3_path && (
            <a
              href={api.getAudioUrl(generation.id, 'mp3', true)}
              download
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 shadow transition-all"
              title="Download 320k MP3"
            >
              <Download className="w-3 h-3" />
              <span>MP3</span>
            </a>
          )}

          <a
            href={api.getParagraphSubtitlesUrl(generation.paragraph_id, 'srt', true)}
            download
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[11px] font-bold shadow transition-all"
            title="Download Subtitles for CapCut / Premiere Pro (.SRT)"
          >
            <FileText className="w-3 h-3" />
            <span>.SRT</span>
          </a>

          <a
            href={api.getParagraphSubtitlesUrl(generation.paragraph_id, 'json', true)}
            download
            className="flex items-center space-x-1 px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition-all"
            title="Download Word-by-Word JSON Timestamps"
          >
            <span>JSON</span>
          </a>
        </div>
      </div>
    </div>
  );
};
