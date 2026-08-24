import re
from typing import List, Dict, Any, Tuple


class TextSplitter:
    """
    Handles character/word length estimation, status threshold checks,
    and smart boundary-aware splitting preserving inline tags.
    """

    SENTENCE_END_REGEX = re.compile(r'(?<=[.!?।])\s+', re.UNICODE)
    CLAUSE_END_REGEX = re.compile(r'(?<=[,;:\-—])\s+', re.UNICODE)

    @classmethod
    def count_words(cls, text: str) -> int:
        if not text:
            return 0
        # Exclude emotion tags from word count estimation
        stripped = re.sub(r'\[[\w\s\-_]+\]', '', text).strip()
        return len(stripped.split()) if stripped else 0

    @classmethod
    def count_characters(cls, text: str) -> int:
        return len(text) if text else 0

    @classmethod
    def estimate_tts_size(cls, text: str) -> Dict[str, Any]:
        """
        Estimates audio duration (approx 140 words per minute) and token/payload size.
        """
        words = cls.count_words(text)
        chars = cls.count_characters(text)
        # Average speaking rate ~2.3 words per second (140 wpm)
        est_duration_sec = round(words / 2.3, 1) if words > 0 else 0.0
        return {
            "words": words,
            "characters": chars,
            "estimated_duration_seconds": est_duration_sec,
            "estimated_duration_formatted": f"{int(est_duration_sec // 60):02d}:{int(est_duration_sec % 60):02d}"
        }

    @classmethod
    def check_limit_status(
        cls,
        text: str,
        max_characters: int = 3000,
        max_words: int = 500,
        near_limit_threshold: float = 0.80
    ) -> Dict[str, Any]:
        """
        Calculates whether text is SAFE, NEAR_LIMIT, or OVER_LIMIT based on character and word limits.
        """
        words = cls.count_words(text)
        chars = cls.count_characters(text)

        char_ratio = chars / max_characters if max_characters > 0 else 0
        word_ratio = words / max_words if max_words > 0 else 0
        max_ratio = max(char_ratio, word_ratio)

        if max_ratio > 1.0:
            status = "OVER_LIMIT"
        elif max_ratio >= near_limit_threshold:
            status = "NEAR_LIMIT"
        else:
            status = "SAFE"

        return {
            "status": status,
            "words": words,
            "characters": chars,
            "max_words": max_words,
            "max_characters": max_characters,
            "word_percentage": round(word_ratio * 100, 1),
            "character_percentage": round(char_ratio * 100, 1),
            "is_over_limit": status == "OVER_LIMIT",
            "is_near_limit": status == "NEAR_LIMIT"
        }

    @classmethod
    def split_by_sentences(cls, text: str) -> List[str]:
        """
        Splits text into sentences preserving punctuation.
        """
        if not text:
            return []
        parts = cls.SENTENCE_END_REGEX.split(text.strip())
        return [p.strip() for p in parts if p.strip()]

    @classmethod
    def split_by_limit(
        cls,
        text: str,
        max_characters: int = 3000,
        max_words: int = 500
    ) -> List[str]:
        """
        Splits over-limit text into minimal sequential parts (Part A, Part B, etc.)
        following the priority hierarchy:
        1. Paragraph breaks (\n\n)
        2. Sentence boundaries (. ! ? ।)
        3. Punctuation clauses (, ; —)
        4. Word boundaries (fallback)
        """
        if not text:
            return []

        status_info = cls.check_limit_status(text, max_characters, max_words)
        if not status_info["is_over_limit"]:
            return [text]

        # Target safe size per chunk (~80% of max limit)
        target_chars = int(max_characters * 0.85)
        target_words = int(max_words * 0.85)

        # 1. Try paragraph splitting first
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if len(paragraphs) > 1:
            chunks = cls._group_items_under_limit(paragraphs, "\n\n", target_chars, target_words, max_characters, max_words)
            if len(chunks) > 1:
                return chunks

        # 2. Try sentence splitting
        # Split while preserving newlines
        lines = text.split("\n")
        atomic_units = []
        for line in lines:
            if not line.strip():
                atomic_units.append(("", "\n"))
                continue
            sentences = cls.split_by_sentences(line)
            for s in sentences:
                atomic_units.append((s, " "))

        chunks = cls._group_atomic_units(atomic_units, target_chars, target_words, max_characters, max_words)
        if len(chunks) > 1:
            return chunks

        # 3. Fallback: split long atomic unit by clauses or words
        return cls._force_split_text(text, max_characters, max_words)

    @classmethod
    def _group_items_under_limit(
        cls,
        items: List[str],
        delimiter: str,
        target_chars: int,
        target_words: int,
        max_chars: int,
        max_words: int
    ) -> List[str]:
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_c = 0
        current_w = 0

        for item in items:
            item_c = cls.count_characters(item)
            item_w = cls.count_words(item)

            if current_chunk and (current_c + item_c > target_chars or current_w + item_w > target_words):
                chunks.append(delimiter.join(current_chunk))
                current_chunk = [item]
                current_c = item_c
                current_w = item_w
            else:
                current_chunk.append(item)
                current_c += item_c + len(delimiter)
                current_w += item_w

        if current_chunk:
            chunks.append(delimiter.join(current_chunk))

        # Check if any chunk is still over limit, if so recurse
        final_chunks = []
        for chunk in chunks:
            if cls.check_limit_status(chunk, max_chars, max_words)["is_over_limit"]:
                final_chunks.extend(cls.split_by_limit(chunk, max_chars, max_words))
            else:
                final_chunks.append(chunk)

        return final_chunks

    @classmethod
    def _group_atomic_units(
        cls,
        units: List[Tuple[str, str]],
        target_chars: int,
        target_words: int,
        max_chars: int,
        max_words: int
    ) -> List[str]:
        chunks: List[str] = []
        current_str = ""

        for text_part, sep in units:
            if not text_part:
                current_str += sep
                continue

            test_str = (current_str + text_part + sep).strip()
            c = cls.count_characters(test_str)
            w = cls.count_words(test_str)

            if current_str.strip() and (c > target_chars or w > target_words):
                chunks.append(current_str.strip())
                current_str = text_part + sep
            else:
                current_str += text_part + sep

        if current_str.strip():
            chunks.append(current_str.strip())

        return chunks

    @classmethod
    def _force_split_text(cls, text: str, max_chars: int, max_words: int) -> List[str]:
        words = text.split()
        chunks = []
        curr = []
        curr_len = 0
        limit_w = int(max_words * 0.8)

        for w in words:
            if len(curr) >= limit_w or curr_len + len(w) + 1 > int(max_chars * 0.8):
                if curr:
                    chunks.append(" ".join(curr))
                curr = [w]
                curr_len = len(w)
            else:
                curr.append(w)
                curr_len += len(w) + 1

        if curr:
            chunks.append(" ".join(curr))

        return chunks if chunks else [text]
