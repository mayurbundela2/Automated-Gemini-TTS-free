import pytest
from backend.services.text_splitter import TextSplitter


def test_limit_status_safe():
    text = "Short narration script."
    res = TextSplitter.check_limit_status(text, max_characters=1000, max_words=200, near_limit_threshold=0.80)
    assert res["status"] == "SAFE"
    assert not res["is_over_limit"]
    assert not res["is_near_limit"]


def test_limit_status_near_limit():
    # 85 words with max 100
    words_85 = " ".join(["word"] * 85)
    res = TextSplitter.check_limit_status(words_85, max_characters=1000, max_words=100, near_limit_threshold=0.80)
    assert res["status"] == "NEAR_LIMIT"
    assert res["is_near_limit"]
    assert not res["is_over_limit"]


def test_limit_status_over_limit():
    words_120 = " ".join(["word"] * 120)
    res = TextSplitter.check_limit_status(words_120, max_characters=1000, max_words=100, near_limit_threshold=0.80)
    assert res["status"] == "OVER_LIMIT"
    assert res["is_over_limit"]
