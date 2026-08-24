from typing import List, Dict, Any

# Google Gemini / AI Studio prebuilt & supported voice catalogue
VOICE_LIBRARY: List[Dict[str, Any]] = [
    {
        "name": "Algenib",
        "gender": "Male",
        "description": "Deep, authoritative, documentary narration, cinematic delivery",
        "recommended_for": "Documentary, News, Serious Analysis, Explainer Videos",
        "is_default": True
    },
    {
        "name": "Aoede",
        "gender": "Female",
        "description": "Warm, engaging, polished, storytelling and podcast style",
        "recommended_for": "Storytelling, Education, Lifestyle, Commercials",
        "is_default": False
    },
    {
        "name": "Charon",
        "gender": "Male",
        "description": "Low, resonant, serious, grave and mysterious tone",
        "recommended_for": "Investigation, History, Thriller, Cold Opens",
        "is_default": False
    },
    {
        "name": "Fenrir",
        "gender": "Male",
        "description": "Crisp, dynamic, energetic, modern broadcaster voice",
        "recommended_for": "Tech, Fast Pace, Sports, Action, Energetic News",
        "is_default": False
    },
    {
        "name": "Kore",
        "gender": "Female",
        "description": "Clear, natural, professional, balanced conversational tone",
        "recommended_for": "Tutorials, Corporate, Explanations, Audiobooks",
        "is_default": False
    },
    {
        "name": "Puck",
        "gender": "Male",
        "description": "Playful, enthusiastic, youthful, upbeat narration",
        "recommended_for": "Entertainment, Shorts, Comedy, Dynamic Intros",
        "is_default": False
    },
    {
        "name": "Sulafat",
        "gender": "Female",
        "description": "Soft, reflective, empathetic, thoughtful pacing",
        "recommended_for": "Drama, Emotional, Meditation, Deep Dive",
        "is_default": False
    },
    {
        "name": "Schedar",
        "gender": "Male",
        "description": "Authoritative, commanding, confident presenter tone",
        "recommended_for": "Announcements, Heavy Lore, Epic Narratives",
        "is_default": False
    },
    {
        "name": "Vega",
        "gender": "Female",
        "description": "Bright, articulate, modern tech commentator",
        "recommended_for": "Reviews, Science, Modern YouTube Style",
        "is_default": False
    },
    {
        "name": "Zephyr",
        "gender": "Female",
        "description": "Calm, whisper-capable, intimate and suspenseful",
        "recommended_for": "True Crime, ASMR/Whisper, Mysteries",
        "is_default": False
    }
]


def get_all_voices(custom_voices: List[str] = None) -> List[Dict[str, Any]]:
    voices = list(VOICE_LIBRARY)
    if custom_voices:
        existing_names = {v["name"].lower() for v in voices}
        for cv in custom_voices:
            if cv and cv.lower() not in existing_names:
                voices.append({
                    "name": cv,
                    "gender": "Custom",
                    "description": "User-defined custom voice parameter",
                    "recommended_for": "Custom narration",
                    "is_default": False
                })
    return voices
