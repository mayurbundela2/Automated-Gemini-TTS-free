import pytest
from backend.services.text_splitter import TextSplitter


def test_count_words_and_characters():
    text = "[serious] [mysterious] Ek sawaal insaan se pucha gaya."
    # Emotion tags excluded from word count: "Ek", "sawaal", "insaan", "se", "pucha", "gaya." -> 6 words
    words = TextSplitter.count_words(text)
    chars = TextSplitter.count_characters(text)
    assert words == 6
    assert chars == len(text)


def test_split_by_sentences():
    text = "Sentence one. Sentence two! Sentence three? Sentence four।"
    sentences = TextSplitter.split_by_sentences(text)
    assert len(sentences) == 4
    assert sentences[0] == "Sentence one."
    assert sentences[1] == "Sentence two!"
    assert sentences[2] == "Sentence three?"
    assert sentences[3] == "Sentence four।"


def test_split_by_limit_preserves_text_and_tags():
    # Long text exceeding 50 words / 200 chars limit
    sentences = [
        "[thoughtful] In the beginning of time, humanity discovered medicinal herbs across vast continents.",
        "[authoritative] These traditions were passed down across generations in ancient texts and scriptures.",
        "[dramatic] However, during the nineteenth century, global regulatory shifts changed the landscape forever.",
        "[curious] What led to these unprecedented policy changes across the civilized world?"
    ]
    long_text = "\n\n".join(sentences)

    chunks = TextSplitter.split_by_limit(long_text, max_characters=200, max_words=30)
    assert len(chunks) > 1

    # Verify all parts combine back to original sentences without loss
    combined = " ".join(chunks)
    assert "humanity discovered medicinal herbs" in combined
    assert "ancient texts and scriptures" in combined
    assert "nineteenth century" in combined
    assert "[thoughtful]" in chunks[0]
