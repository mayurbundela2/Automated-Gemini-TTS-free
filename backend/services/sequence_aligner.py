import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.services.subtitle_service import SubtitleService


class SequenceAligner:
    """
    Advanced Weighted Visual Auto-Alignment Engine.
    Evaluates 4 weighted criteria:
      1. Filename / Number Prefix (20% weight hint)
      2. Filename Keyword Tokens (25% weight)
      3. User Metadata Tags (20% weight)
      4. Semantic Context & Transcript Overlap (35% weight)

    Honors 'locked: true' clips, preserving user manual overrides during re-alignments.
    """

    @staticmethod
    def extract_sequence_number(filename: str) -> Optional[int]:
        stem = Path(filename).stem
        m = re.search(r'^(?:seq_?|paragraph_?|part_?|p_?)?(\d+)', stem, flags=re.IGNORECASE)
        if m:
            return int(m.group(1))
        return None

    @classmethod
    def calculate_token_similarity(cls, tokens: List[str], text_content: str) -> float:
        if not tokens or not text_content:
            return 0.0

        cleaned_text = re.sub(r'\[.*?\]', '', text_content).lower()
        score = 0.0
        for tok in tokens:
            if not tok or len(tok) < 2:
                continue
            if re.search(r'\b' + re.escape(tok) + r'\b', cleaned_text):
                score += 1.0
            elif tok in cleaned_text:
                score += 0.5

        return min(1.0, score / max(1.0, len(tokens)))

    @classmethod
    def compute_weighted_match_score(
        cls,
        asset: Dict[str, Any],
        paragraph_number: int,
        context_text: str,
        assigned_ids: set
    ) -> Dict[str, Any]:
        """
        Computes composite score:
          - Number Prefix: 20%
          - Filename Tokens: 25%
          - User Tags: 20%
          - Semantic Context: 35%
        """
        filename = asset.get("filename", "")
        stem = Path(filename).stem.lower()

        # 1. Number Prefix Score (20% max)
        seq_num = cls.extract_sequence_number(filename)
        prefix_score = 0.20 if (seq_num is not None and seq_num == paragraph_number) else 0.0

        # 2. Filename Tokens Score (25% max)
        stem_tokens = [t for t in re.split(r'[\s_\-]+', stem) if len(t) > 2 and not t.isdigit()]
        token_sim = cls.calculate_token_similarity(stem_tokens, context_text)
        filename_score = token_sim * 0.25

        # 3. User Tags Score (20% max)
        raw_tags = asset.get("tags") or ""
        tags = [t.strip().lower() for t in raw_tags.split(",") if t.strip()]
        tags_sim = cls.calculate_token_similarity(tags, context_text) if tags else token_sim * 0.5
        tags_score = tags_sim * 0.20

        # 4. Semantic Context Match (35% max)
        all_keywords = list(set(stem_tokens + tags))
        semantic_sim = cls.calculate_token_similarity(all_keywords, context_text)
        semantic_score = semantic_sim * 0.35

        total_score = prefix_score + filename_score + tags_score + semantic_score

        # Slight discount if asset already assigned to encourage variety
        if asset["id"] in assigned_ids:
            total_score *= 0.80

        reasons = []
        if prefix_score > 0:
            reasons.append(f"Prefix #{paragraph_number}")
        if filename_score > 0.05:
            reasons.append("Filename keywords")
        if tags_score > 0.05:
            reasons.append("Asset tags")
        if semantic_score > 0.10:
            reasons.append("Transcript overlap")

        reason_str = " + ".join(reasons) if reasons else "Pool fallback"

        return {
            "total_score": round(total_score, 3),
            "reason": reason_str,
            "match_method": "weighted_semantic" if (filename_score + semantic_score > 0.15) else "prefix" if prefix_score > 0 else "pool_distribution"
        }

    @classmethod
    def auto_align_sequence(
        cls,
        paragraphs_data: List[Dict[str, Any]],
        media_assets: List[Dict[str, Any]],
        existing_cuts: Optional[List[Dict[str, Any]]] = None,
        audio_track_type: str = "master"
    ) -> List[Dict[str, Any]]:
        """
        Runs weighted matching across all paragraphs while preserving locked cuts.
        """
        timeline_cuts = []
        assigned_asset_ids = set()

        # Index existing cuts by scene_index to preserve locked status and manual trims
        existing_by_scene = {}
        if existing_cuts:
            for c in existing_cuts:
                existing_by_scene[c.get("scene_index")] = c
                if c.get("locked") and c.get("media_asset_id"):
                    assigned_asset_ids.add(c["media_asset_id"])

        current_time = 0.0

        for p_idx, para in enumerate(paragraphs_data):
            scene_idx = p_idx + 1
            p_num = para.get("paragraph_number", scene_idx)
            p_part = para.get("part_number") or f"Paragraph {p_num}"
            duration = float(para.get("duration") or 3.0)
            transcript = para.get("transcript", "")
            scene_desc = para.get("scene", "")
            combined_context = f"{transcript} {scene_desc} {p_part}"

            start_time = round(current_time, 3)
            end_time = round(current_time + duration, 3)
            current_time = end_time

            existing_cut = existing_by_scene.get(scene_idx)

            # If existing cut is LOCKED, preserve it strictly!
            if existing_cut and existing_cut.get("locked"):
                cut_copy = dict(existing_cut)
                cut_copy["timeline_start"] = start_time
                cut_copy["timeline_end"] = end_time
                cut_copy["duration"] = round(duration, 3)
                cut_copy["transcript"] = SubtitleService.clean_transcript(transcript)
                timeline_cuts.append(cut_copy)
                continue

            # Otherwise, run weighted matching
            best_asset = None
            best_score = 0.0
            best_reason = "Default fallback"
            best_method = "pool"

            for asset in media_assets:
                res = cls.compute_weighted_match_score(asset, p_num, combined_context, assigned_asset_ids)
                if res["total_score"] > best_score:
                    best_score = res["total_score"]
                    best_asset = asset
                    best_reason = res["reason"]
                    best_method = res["match_method"]

            # Fallback if no assets match above threshold
            if not best_asset and media_assets:
                fallback_idx = p_idx % len(media_assets)
                best_asset = media_assets[fallback_idx]
                best_score = 0.35
                best_reason = f"Chronological pool fallback #{fallback_idx + 1}"
                best_method = "pool_distribution"

            if best_asset:
                assigned_asset_ids.add(best_asset["id"])

            # Default alternating motion for cinematic documentary feel
            motion_presets = ["zoom_in", "zoom_out", "pan_right", "pan_left"]
            assigned_motion = motion_presets[p_idx % len(motion_presets)]

            timeline_cuts.append({
                "id": f"cut_{scene_idx:03d}",
                "scene_index": scene_idx,
                "paragraph_id": para.get("id"),
                "paragraph_number": p_num,
                "part_title": p_part,
                "transcript": SubtitleService.clean_transcript(transcript),
                "timeline_start": start_time,
                "timeline_end": end_time,
                "duration": round(duration, 3),
                "source_start": 0.0,
                "source_end": round(duration, 3),
                "media_asset_id": best_asset["id"] if best_asset else None,
                "media_filename": best_asset["filename"] if best_asset else None,
                "media_type": best_asset["file_type"] if best_asset else "image",
                "media_path": best_asset["file_path"] if best_asset else None,
                "match_score": round(best_score, 2),
                "match_confidence": round(best_score * 100, 1),
                "match_reason": best_reason,
                "match_method": best_method,
                "locked": False,
                "motion": {
                    "type": assigned_motion,
                    "amount": 0.08
                },
                "transition": {
                    "type": "cut",
                    "duration": 0.0
                }
            })

        return timeline_cuts
