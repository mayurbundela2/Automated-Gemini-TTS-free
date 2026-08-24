import re
import json
import math
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional


class SubtitleService:
    """
    Precision Subtitle & Word-Level Timestamp Generation Service.
    Produces SRT, VTT, and JSON word-level timestamps for video editors
    (Premiere Pro, CapCut, DaVinci Resolve, Final Cut Pro).
    """

    @staticmethod
    def clean_transcript(text: str) -> str:
        """
        Strips inline emotion/direction tags like [serious], [whisper], [curious].
        """
        cleaned = re.sub(r'\[.*?\]', '', text)
        return re.sub(r'\s+', ' ', cleaned).strip()

    @classmethod
    def format_timestamp_srt(cls, seconds: float) -> str:
        """
        Converts seconds (e.g. 75.432) to SRT format: HH:MM:SS,mmm
        """
        total_ms = int(round(seconds * 1000))
        hrs = total_ms // 3600000
        mins = (total_ms % 3600000) // 60000
        secs = (total_ms % 60000) // 1000
        ms = total_ms % 1000
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"

    @classmethod
    def format_timestamp_vtt(cls, seconds: float) -> str:
        """
        Converts seconds to WebVTT format: HH:MM:SS.mmm
        """
        total_ms = int(round(seconds * 1000))
        hrs = total_ms // 3600000
        mins = (total_ms % 3600000) // 60000
        secs = (total_ms % 60000) // 1000
        ms = total_ms % 1000
        return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"

    @classmethod
    def generate_paragraph_word_timestamps(
        cls,
        transcript: str,
        start_offset: float,
        duration: float
    ) -> List[Dict[str, Any]]:
        """
        Estimates millisecond-accurate word-level timestamps for a paragraph
        using word length, syllable weighting, and punctuation pauses.
        """
        cleaned = cls.clean_transcript(transcript)
        words = cleaned.split()
        if not words:
            return []

        if duration <= 0:
            duration = max(1.0, len(words) * 0.35)

        # Calculate weight for each word (length + punctuation pause)
        weights = []
        for w in words:
            # Base weight by character length
            weight = max(1.0, len(w))
            # Extra weight / pause for punctuation
            if w.endswith('...') or '...' in w:
                weight += 4.5
            elif w.endswith('.') or w.endswith('?') or w.endswith('!'):
                weight += 3.0
            elif w.endswith(',') or w.endswith(';') or w.endswith(':'):
                weight += 1.8
            elif w.endswith('-'):
                weight += 1.0
            weights.append(weight)

        total_weight = sum(weights) or 1.0
        current_time = start_offset
        word_entries = []

        for idx, (word, weight) in enumerate(zip(words, weights)):
            word_duration = (weight / total_weight) * duration
            # Distribute into speech time and small trailing micro-pause
            speech_dur = word_duration * 0.85
            end_time = round(current_time + speech_dur, 3)

            word_entries.append({
                "index": idx + 1,
                "word": word,
                "start": round(current_time, 3),
                "end": end_time,
                "duration": round(speech_dur, 3)
            })
            current_time += word_duration

        return word_entries

    @classmethod
    def build_srt_content(cls, word_entries: List[Dict[str, Any]], words_per_caption: int = 5) -> str:
        """
        Builds standard .SRT subtitle file from word-level timestamp entries,
        chunking words into natural 3-6 word caption segments.
        """
        if not word_entries:
            return ""

        srt_lines = []
        caption_idx = 1

        for i in range(0, len(word_entries), words_per_caption):
            chunk = word_entries[i:i + words_per_caption]
            if not chunk:
                continue

            start_str = cls.format_timestamp_srt(chunk[0]["start"])
            end_str = cls.format_timestamp_srt(chunk[-1]["end"])
            text = " ".join(c["word"] for c in chunk)

            srt_lines.append(f"{caption_idx}")
            srt_lines.append(f"{start_str} --> {end_str}")
            srt_lines.append(text)
            srt_lines.append("")
            caption_idx += 1

        return "\n".join(srt_lines)

    @classmethod
    def build_vtt_content(cls, word_entries: List[Dict[str, Any]], words_per_caption: int = 5) -> str:
        """
        Builds standard .VTT WebVTT subtitle file.
        """
        if not word_entries:
            return "WEBVTT\n\n"

        vtt_lines = ["WEBVTT", ""]
        caption_idx = 1

        for i in range(0, len(word_entries), words_per_caption):
            chunk = word_entries[i:i + words_per_caption]
            if not chunk:
                continue

            start_str = cls.format_timestamp_vtt(chunk[0]["start"])
            end_str = cls.format_timestamp_vtt(chunk[-1]["end"])
            text = " ".join(c["word"] for c in chunk)

            vtt_lines.append(f"{caption_idx}")
            vtt_lines.append(f"{start_str} --> {end_str}")
            vtt_lines.append(text)
            vtt_lines.append("")
            caption_idx += 1

        return "\n".join(vtt_lines)

    @classmethod
    def generate_batch_subtitles(
        cls,
        paragraphs_data: List[Dict[str, Any]],
        output_base_dir: Path,
        prefix: str = "full_batch_narration",
        silence_gap: float = 0.4,
        scale_factor: float = 1.0
    ) -> Dict[str, Any]:
        """
        Generates .SRT, .VTT, and .JSON word-level subtitle files for a full batch.
        `scale_factor` is used to scale timestamps when pauses are trimmed (for tight audio).
        """
        output_base_dir.mkdir(parents=True, exist_ok=True)
        all_words: List[Dict[str, Any]] = []
        current_offset = 0.0

        for p_idx, p in enumerate(paragraphs_data):
            transcript = p.get("transcript", "")
            duration = (p.get("duration") or 2.0) * scale_factor
            gap = silence_gap * scale_factor if p_idx > 0 else 0.0

            current_offset += gap
            p_words = cls.generate_paragraph_word_timestamps(
                transcript=transcript,
                start_offset=current_offset,
                duration=duration
            )

            for pw in p_words:
                pw["paragraph_number"] = p.get("paragraph_number", p_idx + 1)
                pw["part_title"] = p.get("part_title", "")
                all_words.append(pw)

            current_offset += duration

        # 1. SRT file
        srt_content = cls.build_srt_content(all_words, words_per_caption=5)
        srt_file = output_base_dir / f"{prefix}.srt"
        srt_file.write_text(srt_content, encoding="utf-8")

        # 2. VTT file
        vtt_content = cls.build_vtt_content(all_words, words_per_caption=5)
        vtt_file = output_base_dir / f"{prefix}.vtt"
        vtt_file.write_text(vtt_content, encoding="utf-8")

        # 3. Word-level JSON timestamps
        json_data = {
            "total_words": len(all_words),
            "total_duration": round(current_offset, 3),
            "words": all_words
        }
        json_file = output_base_dir / f"{prefix}_words.json"
        json_file.write_text(json.dumps(json_data, indent=2, ensure_ascii=False), encoding="utf-8")

        return {
            "srt_path": str(srt_file),
            "vtt_path": str(vtt_file),
            "json_path": str(json_file),
            "total_words": len(all_words),
            "duration": round(current_offset, 3)
        }
