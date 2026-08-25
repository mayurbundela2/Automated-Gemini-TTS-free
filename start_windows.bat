@echo off
title Automated Gemini TTS Studio
cd /d "%~dp0"

echo ==================================================
echo    Automated Gemini TTS Studio - Windows Launcher
echo ==================================================
echo.

:: Check virtual environment
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

:: Run launcher
python run.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Error] Execution failed. Make sure Python 3.12+ is installed and on your PATH.
    pause
)
