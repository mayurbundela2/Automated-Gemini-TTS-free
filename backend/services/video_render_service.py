import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.audio_converter import AudioConverter


class VideoRenderService:
    """
    Video Rendering Engine (FFmpeg).
    Renders timeline visual sequences (images with 1080p letterbox + video clips)
    synchronized with the full narration audio track into a single master MP4.
    """

    @classmethod
    def render_timeline_video(
        cls,
        timeline_cuts: List[Dict[str, Any]],
        audio_path: str,
        output_mp4_path: str,
        ffmpeg_path: str = "ffmpeg",
        burn_subtitles_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compiles the timeline sequence into a 1080p 30fps MP4 video.
        """
        if not timeline_cuts:
            raise ValueError("Timeline sequence has no visual cuts to render.")

        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio track not found: {audio_path}")

        out_path = Path(output_mp4_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        temp_dir = out_path.parent / "_temp_render"
        temp_dir.mkdir(parents=True, exist_ok=True)

        for candidate in ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]:
            if subprocess.run(["which", candidate], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0 or Path(candidate).exists():
                ffmpeg_path = candidate
                break

        segment_mp4s = []

        try:
            # 1. Render individual visual segments
            for idx, cut in enumerate(timeline_cuts):
                dur = max(0.5, cut.get("duration", 3.0))
                media_path = cut.get("media_path")
                media_type = cut.get("media_type") or "image"
                seg_out = temp_dir / f"seg_{idx:03d}.mp4"

                if media_path and Path(media_path).exists():
                    if media_type == "video":
                        # Scale video to 1920x1080, loop or trim to duration, 30fps
                        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
                        cmd = [
                            ffmpeg_path, "-y",
                            "-stream_loop", "-1",
                            "-i", str(media_path),
                            "-t", str(dur),
                            "-vf", vf,
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                            "-an",
                            str(seg_out)
                        ]
                    else:
                        # Image with solid 1080p fit
                        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
                        cmd = [
                            ffmpeg_path, "-y",
                            "-loop", "1",
                            "-i", str(media_path),
                            "-t", str(dur),
                            "-vf", vf,
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                            "-an",
                            str(seg_out)
                        ]
                else:
                    # Solid dark slate placeholder if no media assigned
                    cmd = [
                        ffmpeg_path, "-y",
                        "-f", "lavfi", "-i", "color=c=0x0b1322:s=1920x1080:r=30",
                        "-t", str(dur),
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                        "-an",
                        str(seg_out)
                    ]

                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                segment_mp4s.append(seg_out)

            # 2. Concat all visual segments
            concat_list_file = temp_dir / "concat_list.txt"
            with open(concat_list_file, "w", encoding="utf-8") as f:
                for seg in segment_mp4s:
                    f.write(f"file '{seg.name}'\n")

            video_track_mp4 = temp_dir / "combined_video.mp4"
            cmd_concat = [
                ffmpeg_path, "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_list_file),
                "-c", "copy",
                str(video_track_mp4)
            ]
            subprocess.run(cmd_concat, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            # 3. Mux with master/tight audio track
            cmd_final = [
                ffmpeg_path, "-y",
                "-i", str(video_track_mp4),
                "-i", str(audio_path),
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "320k",
                "-shortest",
                str(out_path)
            ]
            subprocess.run(cmd_final, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            info = AudioConverter.get_audio_info(str(out_path))

            return {
                "status": "RENDERED",
                "video_path": str(out_path),
                "file_size": out_path.stat().st_size,
                "duration": info.get("duration", 0.0),
                "total_scenes": len(timeline_cuts)
            }

        finally:
            # Clean up temporary segments
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
