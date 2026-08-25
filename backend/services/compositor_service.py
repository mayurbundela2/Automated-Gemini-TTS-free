import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.media_service import MediaService
from backend.services.audio_converter import AudioConverter


class CompositorService:
    """
    Video Compositor Engine (FFmpeg).
    Implements §7 of the Visual Sequencer Spec:
      1. Photo assets: Ken Burns slow pan/zoom for clips > 1.5s, static cut for <= 1.5s.
      2. Video assets: Trims to segment duration; if shorter, freezes last frame via tpad.
      3. Multi-asset paragraph splitting (duration divided evenly or via duration_override_ms).
      4. Soft-fail color card for unassigned segments.
      5. Concatenation + Audio muxing with full_batch_tight.wav/mp3.
      6. Output: full_batch_final.mp4.
    """

    @classmethod
    def compose_batch_video(
        cls,
        segments_data: List[Dict[str, Any]],
        audio_path: str,
        output_mp4_path: str,
        burn_subtitles_srt: Optional[str] = None,
        ffmpeg_path: str = "ffmpeg"
    ) -> Dict[str, Any]:
        if not segments_data:
            raise ValueError("No sequence segments to compose.")

        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Tight audio track not found: {audio_path}")

        out_path = Path(output_mp4_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        temp_dir = out_path.parent / "_temp_compose"
        temp_dir.mkdir(parents=True, exist_ok=True)

        for candidate in ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]:
            if subprocess.run(["which", candidate], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0 or Path(candidate).exists():
                ffmpeg_path = candidate
                break

        segment_clips = []
        fps = 30

        try:
            clip_counter = 0

            for seg in segments_data:
                seg_start_ms = seg.get("start_ms", 0)
                seg_end_ms = seg.get("end_ms", seg_start_ms + 3000)
                seg_total_dur = max(0.4, (seg_end_ms - seg_start_ms) / 1000.0)

                assets = seg.get("assets", [])
                p_title = seg.get("part_title") or f"Paragraph {seg.get('paragraph_number', 1)}"
                p_transcript = seg.get("subtitle_text", "")

                if not assets:
                    # Soft fail: Solid dark slate with scene context
                    seg_out = temp_dir / f"clip_{clip_counter:04d}.mp4"
                    cmd = [
                        ffmpeg_path, "-y",
                        "-f", "lavfi", "-i", "color=c=0x0b1322:s=1920x1080:r=30",
                        "-t", str(seg_total_dur),
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                        "-an",
                        str(seg_out)
                    ]
                    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    segment_clips.append(seg_out)
                    clip_counter += 1
                else:
                    # Split duration across assets in this paragraph
                    num_assets = len(assets)
                    default_asset_dur = seg_total_dur / num_assets

                    for a_idx, asset in enumerate(assets):
                        seg_out = temp_dir / f"clip_{clip_counter:04d}.mp4"
                        asset_dur = (asset.get("duration_override_ms") / 1000.0) if asset.get("duration_override_ms") else default_asset_dur
                        asset_dur = max(0.3, asset_dur)

                        file_path = asset.get("file_path", "")
                        asset_type = asset.get("asset_type") or "photo"

                        if not Path(file_path).exists():
                            # Fallback color card if file missing
                            cmd = [
                                ffmpeg_path, "-y",
                                "-f", "lavfi", "-i", "color=c=0x0b1322:s=1920x1080:r=30",
                                "-t", str(asset_dur),
                                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                                "-an",
                                str(seg_out)
                            ]
                            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                        elif asset_type == "video":
                            # Video asset: Inspect duration
                            vmeta = MediaService.inspect_media_file(file_path, ffmpeg_path=ffmpeg_path)
                            source_dur = vmeta.get("duration", 0.0)

                            if source_dur > 0 and source_dur < asset_dur:
                                # Shorter video: Freeze last frame to fill remainder
                                deficit = asset_dur - source_dur
                                vf = f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration={deficit}"
                            else:
                                vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"

                            cmd = [
                                ffmpeg_path, "-y",
                                "-i", str(file_path),
                                "-t", str(asset_dur),
                                "-vf", vf,
                                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                                "-an",
                                str(seg_out)
                            ]
                            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                        else:
                            # Photo asset: Ken Burns if > 1.5s, static if <= 1.5s
                            total_frames = int(fps * asset_dur)
                            if asset_dur > 1.5:
                                # Slow cinematic zoom-in
                                vf = f"scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z='min(zoom+0.0005,1.10)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}"
                            else:
                                # Rapid cut static
                                vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"

                            cmd = [
                                ffmpeg_path, "-y",
                                "-loop", "1",
                                "-i", str(file_path),
                                "-t", str(asset_dur),
                                "-vf", vf,
                                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                                "-an",
                                str(seg_out)
                            ]
                            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

                        segment_clips.append(seg_out)
                        clip_counter += 1

            # 2. Concat all clips using concat demuxer
            concat_list = temp_dir / "concat_list.txt"
            with open(concat_list, "w", encoding="utf-8") as f:
                for c in segment_clips:
                    f.write(f"file '{c.name}'\n")

            video_track_mp4 = temp_dir / "concatenated_visuals.mp4"
            cmd_concat = [
                ffmpeg_path, "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_list),
                "-c", "copy",
                str(video_track_mp4)
            ]
            subprocess.run(cmd_concat, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            # 3. Final Mux with tight audio (+ optional burned subtitles)
            success = False
            if burn_subtitles_srt and Path(burn_subtitles_srt).exists():
                try:
                    escaped_srt = str(burn_subtitles_srt).replace("\\", "/").replace(":", "\\:")
                    cmd_final = [
                        ffmpeg_path, "-y",
                        "-i", str(video_track_mp4),
                        "-i", str(audio_path),
                        "-vf", f"subtitles='{escaped_srt}'",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                        "-c:a", "aac", "-b:a", "320k",
                        "-shortest",
                        str(out_path)
                    ]
                    subprocess.run(cmd_final, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    success = True
                except Exception:
                    success = False

            if not success:
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

            meta = MediaService.inspect_media_file(str(out_path), ffmpeg_path=ffmpeg_path)

            return {
                "status": "COMPOSED",
                "video_path": str(out_path),
                "duration": meta.get("duration", 0.0),
                "file_size": out_path.stat().st_size,
                "total_segments": len(segments_data),
                "total_clips": len(segment_clips)
            }

        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
