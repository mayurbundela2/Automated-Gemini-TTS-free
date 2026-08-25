import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.subtitle_service import SubtitleService


class SequenceAligner:
    """
    3-Layer Visual Auto-Alignment Engine.
    Aligns imported media assets (images & video clips) with audio paragraphs and subtitle scenes:
      1. Filename / Sequence Number Prefix Matching (01_..., P01_..., Part_1_...)
      2. Semantic Keyword / Content Matching
      3. Audio Timestamp Boundary Snapping
    """

    @staticmethod
    def extract_sequence_number(filename: str) -> Optional[int]:
        """
        Extracts sequence number from prefixes like:
          '01_image.jpg' -> 1
          'Paragraph_03_shot.mp4' -> 3
          'P04_ancient.png' -> 4
          'seq_5_rope.jpg' -> 5
        """
        stem = Path(filename).stem
        m = re.search(r'^(?:seq_?|paragraph_?|part_?|p_?)?(\d+)', stem, flags=re.IGNORECASE)
        if m:
            return int(m.group(1))
        return None

    @classmethod
    def calculate_semantic_similarity(cls, media_keywords: List[str], text_content: str) -> float:
        """
        Calculates keyword overlap similarity score (0.0 to 1.0) between media tokens and scene text.
        """
        if not media_keywords or not text_content:
            return 0.0

        cleaned_text = re.sub(r'\[.*?\]', '', text_content).lower()
        # Find exact and partial substring matches
        score = 0.0
        for kw in media_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', cleaned_text):
                score += 1.0
            elif kw in cleaned_text:
                score += 0.5

        # Normalize score
        return min(1.0, score / max(1.0, len(media_keywords)))

    @classmethod
    def auto_align_sequence(
        cls,
        paragraphs_data: List[Dict[str, Any]],
        media_assets: List[Dict[str, Any]],
        audio_track_type: str = "master"
    ) -> List[Dict[str, Any]]:
        """
        Runs the 3-Layer alignment engine.
        Returns a list of timeline scene cuts with assigned media, timecodes, confidence, and match reason.
        """
        timeline_cuts = []
        assigned_asset_ids = set()

        current_time = 0.0

        for p_idx, para in enumerate(paragraphs_data):
            p_num = para.get("paragraph_number", p_idx + 1)
            p_part = para.get("part_number") or f"Paragraph {p_num}"
            duration = float(para.get("duration") or 3.0)
            transcript = para.get("transcript", "")
            scene_desc = para.get("scene", "")
            combined_context = f"{transcript} {scene_desc} {p_part}"

            start_time = round(current_time, 3)
            end_time = round(current_time + duration, 3)
            current_time = end_time

            # Matching candidate search
            best_asset = None
            best_score = 0.0
            match_reason = "Default fallback assignment"

            # 1. First priority: Exact sequence number match (e.g. 01_... for Paragraph 1)
            for asset in media_assets:
                asset_seq = cls.extract_sequence_number(asset["filename"])
                if asset_seq == p_num:
                    best_asset = asset
                    best_score = 0.98
                    match_reason = f"Exact sequence number #{p_num} prefix match"
                    break

            # 2. Second priority: Semantic keyword matching (if not matched by prefix)
            if not best_asset:
                for asset in media_assets:
                    tags = [t.strip().lower() for t in (asset.get("tags") or "").split(",") if t.strip()]
                    if not tags:
                        stem_tokens = Path(asset["filename"]).stem.lower().split("_")
                        tags = [t for t in stem_tokens if len(t) > 2 and not t.isdigit()]

                    sim = cls.calculate_semantic_similarity(tags, combined_context)
                    # Prefer unassigned assets slightly
                    if asset["id"] in assigned_asset_ids:
                        sim *= 0.85

                    if sim > best_score and sim > 0.20:
                        best_score = sim
                        best_asset = asset
                        matched_words = [t for t in tags if t in combined_context.lower()]
                        match_reason = f"Semantic match on keywords: {', '.join(matched_words)}"

            # 3. Third priority: Chronological fallback from media pool
            if not best_asset and media_assets:
                fallback_idx = p_idx % len(media_assets)
                best_asset = media_assets[fallback_idx]
                best_score = 0.40
                match_reason = f"Chronological pool fallback (Asset #{fallback_idx + 1})"

            if best_asset:
                assigned_asset_ids.add(best_asset["id"])

            timeline_cuts.append({
                "scene_index": p_idx + 1,
                "paragraph_id": para.get("id"),
                "paragraph_number": p_num,
                "part_title": p_part,
                "transcript": SubtitleService.clean_transcript(transcript),
                "start_time": start_time,
                "end_time": end_time,
                "duration": round(duration, 3),
                "media_asset_id": best_asset["id"] if best_asset else None,
                "media_filename": best_asset["filename"] if best_asset else None,
                "media_type": best_asset["file_type"] if best_asset else None,
                "media_path": best_asset["file_path"] if best_asset else None,
                "match_confidence": round(best_score * 100, 1) if best_asset else 0.0,
                "match_reason": match_reason,
                "motion_effect": "zoom_in" if p_idx % 2 == 0 else "pan_right"
            })

        return timeline_cuts
