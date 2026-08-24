import os
import json
import pytest
from pathlib import Path
from backend.services.delivery_provider import LocalDeliveryProvider, sanitize_filename


def test_sanitize_filename():
    assert sanitize_filename("Cannabis Documentary") == "Cannabis_Documentary"
    assert sanitize_filename("Batch #1 (Special)!") == "Batch_1_Special"
    assert sanitize_filename("Part: 01") == "Part_01"


def test_local_storage_hierarchy_creation(tmp_path):
    provider = LocalDeliveryProvider(base_output_dir=str(tmp_path))

    wav_bytes = b"RIFF....WAVEfmt ...."
    mp3_bytes = b"ID3....."
    metadata = {
        "project": "Cannabis Documentary",
        "batch": 1,
        "paragraph": 2,
        "voice": "Algenib",
        "transcript": "Test speech"
    }

    result = provider.deliver_audio_artifact(
        project_name="Cannabis Documentary",
        batch_number=1,
        paragraph_number=2,
        part_identifier=None,
        wav_bytes=wav_bytes,
        mp3_path_or_bytes=mp3_bytes,
        metadata=metadata
    )

    expected_dir = tmp_path / "Cannabis_Documentary" / "Batch_01" / "Paragraph_02"
    assert expected_dir.exists()
    assert (expected_dir / "narration.wav").exists()
    assert (expected_dir / "narration.mp3").exists()
    assert (expected_dir / "metadata.json").exists()

    with open(expected_dir / "metadata.json", "r") as f:
        meta = json.load(f)
        assert meta["wav"] == "narration.wav"
        assert meta["mp3"] == "narration.mp3"
        assert meta["paragraph"] == 2
