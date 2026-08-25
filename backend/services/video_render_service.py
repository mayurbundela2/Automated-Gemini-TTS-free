import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.audio_converter import AudioConverter


class VideoRenderService:
    """
    Advanced 1080p Video Rendering Engine (FFmpeg).
    Compiles timeline cuts with dynamic Ken Burns motion for images,
    accurate source trimming for video clips, and audio synchronization.
    """

    @classmethod
    def render_timeline_video(
        cls,
        timeline_cuts: List[Dict[str, Any]],
        audio_path: str,
        output_mp4_path: str,
        ffmpeg_path: str = "ffmpeg"
    ) -> Dict[str, Any]:
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
            for idx, cut in enumerate(timeline_cuts):
                dur = max(0.5, cut.get("duration", 3.0))
                media_path = cut.get("media_path")
                media_type = cut.get("media_type") or "image"
                source_start = float(cut.get("source_start", 0.0))
                motion_obj = cut.get("motion") or {}
                motion_type = motion_obj.get("type", "zoom_in") if isinstance(motion_obj, dict) else str(motion_obj)

                seg_out = temp_dir / f"seg_{idx:03d}.mp4"

                if media_path and Path(media_path).exists():
                    if media_type == "video":
                        # Trim video from source_start with length dur, scaled and padded to 1920x1080
                        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
                        cmd = [
                            ffmpeg_path, "-y",
                            "-ss", str(source_start),
                            "-i", str(media_path),
                            "-t", str(dur),
                            "-vf", vf,
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                            "-an",
                            str(seg_out)
                        ]
                    else:
                        # Image with Ken Burns motion effect
                        fps = 30
                        total_frames = int(fps * dur)

                        if motion_type == "zoom_in":
                            vf = f"scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z='min(zoom+0.0012,1.15)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}"
                        elif motion_type == "zoom_out":
                            vf = f"scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z='max(1.15-0.0012*on,1.0)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}"
                        elif motion_type == "pan_right":
                            vf = f"scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z=1.08:d={total_frames}:x='if(lte(on,1),0,x+1.2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}"
                        elif motion_type == "pan_left":
                            vf = f"scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z=1.08:d={total_frames}:x='if(lte(on,1),iw-iw/zoom,x-1.2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}"
                        else:
                            # Static clean fit
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
                    # Solid dark slate placeholder
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

            # 3. Mux with narration audio
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

            from backend.services.media_service import MediaService
            info = MediaService.inspect_media_file(str(out_path))

            return {
                "status": "RENDERED",
                "video_path": str(out_path),
                "file_size": out_path.stat().st_size,
                "duration": info.get("duration", 0.0),
                "total_scenes": len(timeline_cuts)
            }

        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
