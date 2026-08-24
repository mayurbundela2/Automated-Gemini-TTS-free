import pytest
from backend.services.prompt_builder import PromptBuilder


def test_prompt_builder_structure():
    config = {
        "scene": "Dimly lit room",
        "sample_context": "Gripping mystery",
        "audio_profile": "Authoritative documentary voice",
        "style": "Newscaster",
        "pace": "Natural",
        "accent": "Neutral",
        "voice": "Algenib",
        "transcript": "[serious] Ek sawaal insaan se pucha gaya."
    }

    prompt = PromptBuilder.build_tts_prompt(config, preserve_inline_tags=True)

    assert "Generate a natural spoken narration." in prompt
    assert "Do not speak the metadata" in prompt
    assert "SCENE:\nDimly lit room" in prompt
    assert "SAMPLE CONTEXT:\nGripping mystery" in prompt
    assert "AUDIO PROFILE:\nAuthoritative documentary voice" in prompt
    assert "STYLE:\nNewscaster" in prompt
    assert "VOICE:\nAlgenib" in prompt
    assert "TRANSCRIPT:\n[serious] Ek sawaal insaan se pucha gaya." in prompt


def test_prompt_builder_omits_empty_fields():
    config = {
        "voice": "Fenrir",
        "transcript": "Hello world"
    }

    prompt = PromptBuilder.build_tts_prompt(config)
    assert "SCENE:" not in prompt
    assert "SAMPLE CONTEXT:" not in prompt
    assert "VOICE:\nFenrir" in prompt
    assert "TRANSCRIPT:\nHello world" in prompt


def test_prompt_builder_strip_tags_when_disabled():
    config = {
        "transcript": "[excited] [amazed] Look at this discovery!"
    }
    prompt = PromptBuilder.build_tts_prompt(config, preserve_inline_tags=False)
    assert "[excited]" not in prompt
    assert "Look at this discovery!" in prompt
