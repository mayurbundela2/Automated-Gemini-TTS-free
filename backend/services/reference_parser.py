import re
from typing import List, Dict, Any, Optional


class ReferenceParser:
    """
    Parses unstructured or structured markdown / text TTS references from AI Studio breakdowns
    into structured paragraph units with metadata and clean transcripts.
    """

    PARAGRAPH_SPLIT_REGEX = re.compile(
        r'(?:^|\n)\s*(?:---\s*\n\s*)?(?:#{1,6}\s*)?(?:\*{1,2})?(?:Part|Paragraph|Scene|Section|Shot)\s*(\d+)[:\s—\-&]*(.*?)(?:\*{1,2})?(?:\n|$)',
        re.IGNORECASE
    )

    PART_HEADER_REGEX = re.compile(
        r'^\s*(?:---\s*\n\s*)?(?:#{1,6}\s*)?(?:\*{1,2})?(?:Part|Paragraph|Scene|Section|Shot)\s*(\d+)(?:[A-Za-z])?[:\s—\-]*(.*?)(?:\*{1,2})?$',
        re.MULTILINE | re.IGNORECASE
    )

    # Metadata field extractors
    FIELD_PATTERNS = {
        "scene": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Scene|Visual Scene|Visual|Setting)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "sample_context": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Sample Context|Context|Delivery Context|Emotional Context)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "audio_profile": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Audio Profile|Profile|Speaker Profile|Persona|Character Profile)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "speaker": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Speaker|Narrator|Voice Actor)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "style": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Style|Delivery Style|Tone|Speaking Style)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "pace": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Pace|Speed|Cadence)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "accent": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Accent|Language Accent|Dialect)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "voice": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Voice|Voice Name|TTS Voice|Recommended Voice)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ],
        "director_notes": [
            r'^[ \t]*[-*]?[ \t]*(?:\*\*)?(?:Director Notes|Director\'s Notes|Director Note|Direction)(?:\*\*)?[:\s]+["\']?(.*?)["\']?$',
        ]
    }

    SCRIPT_HEADER_REGEX = re.compile(
        r'^[ \t]*(?:#{1,6}\s*)?(?:\*{1,2})?(?:Formatted Script to Copy-Paste|Formatted Script|Script to Copy-Paste|Script|Transcript|Spoken Text|Narration Script|Dialogue)[:\s]*(?:\*{1,2})?$',
        re.MULTILINE | re.IGNORECASE
    )

    @classmethod
    def parse_batch_text(cls, raw_text: str, default_voice: str = "Algenib") -> List[Dict[str, Any]]:
        """
        Parses full pasted batch reference into a list of structured paragraph dictionaries.
        """
        if not raw_text or not raw_text.strip():
            return []

        clean_text = raw_text.strip().replace("\r\n", "\n")

        # Find all Part/Paragraph headers
        matches = list(cls.PARAGRAPH_SPLIT_REGEX.finditer(clean_text))

        if not matches:
            # Fallback to single paragraph
            return [cls._parse_single_block(clean_text, 1, default_voice)]

        parsed_paragraphs: List[Dict[str, Any]] = []

        for idx, m in enumerate(matches):
            start = m.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(clean_text)
            block = clean_text[start:end].strip()

            parsed = cls._parse_single_block(block, idx + 1, default_voice)
            if parsed["transcript"] or parsed["scene"] or parsed["director_notes"]:
                parsed_paragraphs.append(parsed)

        return parsed_paragraphs

    @classmethod
    def _clean_markdown_line(cls, line: str) -> str:
        l = re.sub(r'^\s*[-*+]\s+', '', line).strip()
        l = re.sub(r'\*\*([^*]+)\*\*', r'\1', l)
        return l.strip()

    @classmethod
    def _clean_transcript_line(cls, line: str) -> str:
        l = line.strip()
        if l.startswith('>'):
            l = l[1:].strip()
        # Normalize `[tag]` to [tag]
        l = re.sub(r'\`(\[[^\]]+\])\`', r'\1', l)
        return l

    @classmethod
    def _parse_single_block(cls, block_text: str, index: int, default_voice: str) -> Dict[str, Any]:
        """
        Parses a single paragraph/part block text into metadata and transcript.
        """
        lines = block_text.split("\n")
        
        paragraph_number = index
        part_name = f"Part {index}"
        
        # 1. Check for Part header in the first few lines
        for line in lines[:4]:
            header_match = cls.PART_HEADER_REGEX.match(line.strip())
            if header_match:
                try:
                    paragraph_number = int(header_match.group(1))
                except (ValueError, TypeError):
                    paragraph_number = index
                subtitle = header_match.group(2).strip()
                subtitle_clean = re.sub(r'^\*{1,2}|\*{1,2}$', '', subtitle).strip()
                part_name = f"Part {paragraph_number}" + (f": {subtitle_clean}" if subtitle_clean else "")
                break

        # 2. Separate metadata section from transcript section
        script_start_idx = -1
        for idx, line in enumerate(lines):
            cleaned_header_line = re.sub(r'^\s*[-*+]\s+', '', line).strip()
            if cls.SCRIPT_HEADER_REGEX.match(cleaned_header_line):
                script_start_idx = idx
                break

        metadata_lines = lines[:script_start_idx] if script_start_idx != -1 else lines
        raw_transcript_lines = lines[script_start_idx + 1:] if script_start_idx != -1 else []

        metadata: Dict[str, Any] = {
            "scene": "",
            "sample_context": "",
            "audio_profile": "",
            "speaker": "",
            "style": "Newscaster",
            "pace": "Natural",
            "accent": "Neutral",
            "voice": default_voice,
            "director_notes": "",
            "additional_notes": "",
        }

        additional_notes_lines = []
        inferred_transcript_lines = []
        is_in_transcript_mode = False

        for line in metadata_lines:
            raw_stripped = line.strip()
            stripped = cls._clean_markdown_line(raw_stripped)
            if not stripped or stripped == "---":
                if is_in_transcript_mode:
                    inferred_transcript_lines.append("")
                continue

            # Ignore section labels like "Playground Setup:"
            if re.match(r'^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Playground Setup|Setup|Voice Setup|Parameters)[:\s]*(?:\*{1,2})?$', stripped, re.I):
                continue

            # Check if this line is part header we already handled
            if cls.PART_HEADER_REGEX.match(raw_stripped) or cls.PART_HEADER_REGEX.match(stripped):
                continue

            # Check if line contains pipe-separated key-values (e.g. Style: Newscaster | Pace: Natural | Accent: Neutral | Voice: Algenib)
            if "|" in stripped and ":" in stripped:
                pipe_segments = [seg.strip() for seg in stripped.split("|") if seg.strip()]
                matched_any_pipe = False
                for seg in pipe_segments:
                    clean_seg = cls._clean_markdown_line(seg)
                    matched_this_seg = False
                    for field, patterns in cls.FIELD_PATTERNS.items():
                        for pat in patterns:
                            m = re.match(pat, clean_seg, re.IGNORECASE)
                            if m:
                                val = m.group(1).strip().strip('"\'')
                                metadata[field] = val
                                matched_this_seg = True
                                matched_any_pipe = True
                                break
                        if matched_this_seg:
                            break
                if matched_any_pipe:
                    continue

            matched_field = False
            for field, patterns in cls.FIELD_PATTERNS.items():
                for pat in patterns:
                    m = re.match(pat, stripped, re.IGNORECASE)
                    if m:
                        val = m.group(1).strip().strip('"\'')
                        metadata[field] = val
                        matched_field = True
                        break
                if matched_field:
                    break

            if not matched_field:
                # If script header was missing, check if this line looks like script (e.g. has emotion tags or narration)
                if script_start_idx == -1:
                    clean_t_line = cls._clean_transcript_line(line)
                    if clean_t_line.startswith("[") or is_in_transcript_mode or (len(clean_t_line) > 40 and not clean_t_line.startswith("-")):
                        is_in_transcript_mode = True
                        inferred_transcript_lines.append(clean_t_line)
                    else:
                        additional_notes_lines.append(stripped)
                else:
                    if not stripped.startswith("###") and not stripped.startswith("#"):
                        additional_notes_lines.append(stripped)

        # Assemble and clean transcript lines
        cleaned_transcript_lines = []
        if script_start_idx != -1:
            for l in raw_transcript_lines:
                cl = cls._clean_transcript_line(l)
                # If trailing separator or instructions in footer
                if cl.startswith("---") or cl.startswith("Generate these") or cl.startswith("Let me know"):
                    break
                cleaned_transcript_lines.append(cl)
        else:
            for l in inferred_transcript_lines:
                cleaned_transcript_lines.append(l)

        raw_transcript = "\n".join(cleaned_transcript_lines).strip()

        # Clean additional notes
        if additional_notes_lines:
            metadata["additional_notes"] = "\n".join(additional_notes_lines).strip()

        # Calculate word and char count
        cleaned_for_count = re.sub(r'\[.*?\]', '', raw_transcript).strip()
        words = len(cleaned_for_count.split()) if cleaned_for_count else 0
        characters = len(raw_transcript)

        return {
            "paragraph_number": paragraph_number,
            "part_number": part_name,
            "scene": metadata["scene"] or None,
            "sample_context": metadata["sample_context"] or None,
            "audio_profile": metadata["audio_profile"] or None,
            "speaker": metadata["speaker"] or None,
            "style": metadata["style"] or "Newscaster",
            "pace": metadata["pace"] or "Natural",
            "accent": metadata["accent"] or "Neutral",
            "voice": metadata["voice"] or default_voice,
            "director_notes": metadata["director_notes"] or None,
            "additional_notes": metadata["additional_notes"] or None,
            "transcript": raw_transcript,
            "word_count": words,
            "character_count": characters,
            "raw_reference": block_text.strip(),
            "status": "READY" if raw_transcript else "DRAFT"
        }
