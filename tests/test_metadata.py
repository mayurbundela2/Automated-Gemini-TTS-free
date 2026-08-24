import json
import pytest
from pathlib import Path


def test_metadata_structure_conformance():
    sample_meta = {
        "project": "Cannabis Documentary",
        "batch": 1,
        "paragraph": 1,
        "part": None,
        "voice": "Algenib",
        "model": "gemini-2.0-flash",
        "scene": "Dimly lit room",
        "sample_context": "Gripping mystery",
        "audio_profile": "Documentary narrator",
        "style": "Newscaster",
        "pace": "Natural",
        "accent": "Neutral",
        "director_notes": "None",
        "transcript": "[serious] Ek sawaal...",
        "generated_prompt": "...",
        "word_count": 126,
        "character_count": 742,
        "created_at": "2026-08-24T12:00:00Z",
        "wav": "narration.wav",
        "mp3": "narration.mp3"
    }

    # Verify JSON serializability and schema fields
    encoded = json.dumps(sample_meta, indent=2)
    decoded = json.loads(encoded)

    assert decoded["project"] == "Cannabis Documentary"
    assert decoded["voice"] == "Algenib"
    assert decoded["wav"] == "narration.wav"
    assert decoded["mp3"] == "narration.mp3"
    assert "transcript" in decoded
    assert "word_count" in decoded
