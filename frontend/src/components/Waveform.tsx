import React, { useRef, useEffect, useState } from 'react';

interface WaveformProps {
  peaks?: number[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  height?: number;
}

export const Waveform: React.FC<WaveformProps> = ({
  peaks = [],
  duration,
  currentTime,
  onSeek,
  height = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  // Default simulated peaks if array is empty
  const defaultPeaks = Array.from({ length: 90 }, (_, i) => 0.15 + 0.7 * Math.abs(Math.sin(i * 0.2) * Math.cos(i * 0.08)));
  const dataPeaks = peaks && peaks.length > 0 ? peaks : defaultPeaks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barCount = dataPeaks.length;
    const barWidth = Math.max(2, (w / barCount) - 1.5);
    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const currentX = w * progressRatio;

    ctx.clearRect(0, 0, w, h);

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + 1.5);
      const val = dataPeaks[i];
      const barHeight = Math.max(4, val * (h - 6));
      const y = (h - barHeight) / 2;

      // Played portion vs unplayed portion
      if (x + barWidth <= currentX) {
        ctx.fillStyle = '#3B82F6'; // active blue
      } else if (x < currentX && x + barWidth > currentX) {
        ctx.fillStyle = '#60A5FA';
      } else {
        ctx.fillStyle = '#334155'; // unplayed slate
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    // Playhead line
    if (duration > 0) {
      ctx.fillStyle = '#93C5FD';
      ctx.fillRect(currentX - 1, 0, 2, h);
    }
  }, [dataPeaks, duration, currentTime]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    setHoverX(mouseX);
    setHoverTime(ratio * duration);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full cursor-pointer select-none group py-1"
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block rounded-lg"
      />

      {/* Hover timestamp tooltip */}
      {hoverTime !== null && (
        <div
          className="absolute -top-7 transform -translate-x-1/2 bg-slate-900 text-blue-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-700 shadow pointer-events-none z-10"
          style={{ left: `${hoverX}px` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
};
