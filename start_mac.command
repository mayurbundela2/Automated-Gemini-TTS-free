#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo "   Automated Gemini TTS Studio - macOS Launcher   "
echo "=================================================="
echo ""

# Activate virtualenv if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run python launcher
if command -v python3 &>/dev/null; then
    python3 run.py
elif command -v python &>/dev/null; then
    python run.py
else
    echo "[Error] Python 3 was not found. Please install Python from https://python.org"
    read -p "Press enter to exit..."
fi
