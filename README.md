# Automated Gemini TTS Free 🎙️🎬

Production-grade localhost application for automated high-quality voiceover narration using **Google Gemini 3.1 & 2.5 Text-to-Speech API**. Features multi-key round-robin pooling, AI Studio voice direction, master WAV preservation, no-pause silence trimming, 1080p timeline MP4 video export, and millisecond-precision word-level subtitles (.SRT, .VTT, .JSON).

---

## 🌟 Key Features

### 1. 🔑 Multi-Key API Pooling & Rate Pacing
- **Round-Robin Key Pool**: Provide multiple Gemini API keys to bypass RPM and RPD limits.
- **Smart Rate Pacing**: Automatically paces requests per key to strictly respect the 3 RPM rate limit without failing.
- **Model Fallback Chain**: Automatically tries `gemini-3.1-flash-tts-preview` and gracefully falls back to `gemini-2.5-flash-preview-tts` on temporary resource exhaustion.

### 2. ⚡ Full Batch Narration & Rebuild
- **Sequential Stitching**: Automatically joins all paragraph voiceovers in chronological order with natural padding.
- **Single-Click Rebuild**: Edit any paragraph or re-generate individual parts, then click **`REBUILD FULL NARRATION & MP4`** to update the entire sequence instantly.
- **Browser Cache-Busting**: Instant UI player audio updates without browser caching lockups.

### 3. ✂️ No-Pause Auto-Trimmer & Fast Narration
- **FFmpeg Silence Removal**: Automatically detects and trims dead air and awkward long pauses (`>0.35s`) down to clean, natural pauses.
- **Saves 10–25% Video Runtime**: Delivers a fast, punchy voiceover track tailored for YouTube, Reels, and documentary storytelling.

### 4. 🎞️ 1080p MP4 Timeline Video Generation
- **Timeline-Ready MP4**: Generates a lightweight, studio-grade 1920x1080 MP4 video synced with the no-pause audio.
- **Direct NLE Import**: Drag and drop directly into **Premiere Pro**, **DaVinci Resolve**, **CapCut**, or **Final Cut Pro** video editing timelines.

### 5. ⏱️ Precision Subtitles & Word-Level Timestamps
- **SubRip (.SRT)**: 3–6 word caption chunks with millisecond timecodes.
- **WebVTT (.VTT)**: Formatted for web video players and HTML5 video.
- **Word Timestamps (.JSON)**: Exact start, end, and duration for every single spoken word for **kinetic typography** and animated captions.
- **Interactive In-App Inspector**: Inspect and copy word-by-word timestamps directly within the dashboard.

### 6. 📝 AI Studio Reference Script Importer
- Paste multi-paragraph scripts directly from Google AI Studio.
- Automatically extracts Scene, Sample Context, Audio Profile, Speaker, Style, Pace, Accent, and Voice while preserving inline emotion tags (`[serious]`, `[curious]`, `[whisper]`).

---

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/mayurbundela2/Automated-Gemini-TTS-free.git
cd Automated-Gemini-TTS-free
```

### 2. Setup Python Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Configure API Keys

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add one or more Gemini API keys (comma-separated):
```env
GEMINI_API_KEY=AIzaSy...,AIzaSy...,AIzaSy...
GEMINI_MODEL=gemini-3.1-flash-tts-preview
DEFAULT_VOICE=Algenib
```

### 5. Run the Application

```bash
python run.py
```

The app will launch your browser automatically at:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy (SQLite), Google GenAI SDK, FFmpeg, Uvicorn
- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Wavesurfer
- **Audio/Video Processing**: FFmpeg (WAV &rarr; 320k MP3, silence removal filter, 1080p MP4 synthesis)

---

## 📄 License

MIT License. Free for personal and commercial content creation.
