import os
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.services.delivery_provider import sanitize_filename


class MediaService:
    """
    Service for managing project/batch media assets (images & video clips).
    Handles file saving, format inspection via FFprobe/Pillow, and keyword tag extraction.
    """

    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
    VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv"}

    @classmethod
    def get_media_dir(cls, base_output_dir: str, project_name: str, batch_number: int) -> Path:
        media_dir = Path(base_output_dir) / sanitize_filename(project_name) / f"Batch_{batch_number:02d}" / "media"
        media_dir.mkdir(parents=True, exist_ok=True)
        return media_dir

    @classmethod
    def extract_keywords_from_filename(cls, filename: str) -> List[str]:
        """
        Extracts semantic tokens from a filename like '03_ancient_hemp_rope_making.jpg'.
        """
        stem = Path(filename).stem
        # Remove leading numbers/prefixes like 01_, P02_, seq_3_
        stem_clean = re.sub(r'^(?:seq_?|part_?|p_?)?\d+[\s_-]*', '', stem, flags=re.IGNORECASE)
        # Split by underscores, dashes, spaces
        tokens = re.split(r'[\s_\-]+', stem_clean)
        return [t.lower() for t in tokens if len(t) > 2 and not t.isdigit()]

    @classmethod
    def inspect_media_file(cls, file_path: str, ffmpeg_path: str = "ffmpeg") -> Dict[str, Any]:
        """
        Inspects media dimensions and duration using ffprobe/ffmpeg.
        """
        p = Path(file_path)
        ext = p.suffix.lower()
        media_type = "video" if ext in cls.VIDEO_EXTENSIONS else "image"
        size_bytes = p.stat().st_size if p.exists() else 0

        width = 1920
        height = 1080
        duration = 0.0

        ffprobe_bin = "ffprobe"
        for candidate in ["ffprobe", "/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe"]:
            if subprocess.run(["which", candidate], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0 or Path(candidate).exists():
                ffprobe_bin = candidate
                break

        try:
            cmd = [
                ffprobe_bin,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,duration:format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path)
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            lines = [l.strip() for l in res.stdout.strip().split('\n') if l.strip()]
            if len(lines) >= 2:
                width = int(lines[0]) if lines[0].isdigit() else 1920
                height = int(lines[1]) if lines[1].isdigit() else 1080
            if len(lines) >= 3 and media_type == "video":
                try:
                    duration = float(lines[2])
                except ValueError:
                    duration = 0.0
        except Exception:
            pass

        return {
            "media_type": media_type,
            "width": width,
            "height": height,
            "duration": duration,
            "size_bytes": size_bytes,
            "tags": ", ".join(cls.extract_keywords_from_filename(p.name))
        }
