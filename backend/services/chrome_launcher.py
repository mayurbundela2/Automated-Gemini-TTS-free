import os
import sys
import subprocess
import webbrowser
from pathlib import Path
from typing import Optional, List


class ChromeLauncher:
    """
    Cross-platform Google Chrome binary detector and launcher.
    """

    MAC_PATHS = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]

    LINUX_PATHS = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
    ]

    WINDOWS_PATHS = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]

    @classmethod
    def find_chrome_binary(cls, manual_path: Optional[str] = None) -> Optional[str]:
        """
        Attempts to locate Google Chrome executable across operating systems.
        """
        if manual_path and os.path.isfile(manual_path) and os.access(manual_path, os.X_OK):
            return manual_path

        candidates: List[str] = []
        if sys.platform == "darwin":
            candidates = cls.MAC_PATHS
        elif sys.platform.startswith("linux"):
            candidates = cls.LINUX_PATHS
        elif sys.platform == "win32":
            candidates = cls.WINDOWS_PATHS

        for path in candidates:
            if os.path.isfile(path) and (os.access(path, os.X_OK) or sys.platform == "win32"):
                return path

        return None

    @classmethod
    def launch(cls, url: str = "http://127.0.0.1:8000", manual_path: Optional[str] = None) -> bool:
        """
        Launches Google Chrome to the specified URL. If Chrome is not found,
        falls back to the default web browser without crashing.
        """
        chrome_bin = cls.find_chrome_binary(manual_path)
        if chrome_bin:
            try:
                subprocess.Popen(
                    [chrome_bin, url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
                return True
            except Exception as e:
                print(f"[ChromeLauncher] Note: Could not launch directly with {chrome_bin}: {e}")

        # Fallback to system default browser
        try:
            webbrowser.open(url)
            return True
        except Exception:
            print(f"\n==========================================")
            print(f"  Application running at:")
            print(f"  {url}")
            print(f"==========================================\n")
            return False

    @classmethod
    def open_ai_studio(cls, manual_path: Optional[str] = None) -> bool:
        """
        Opens Google AI Studio in Chrome for audio exploration and voice testing.
        """
        return cls.launch("https://aistudio.google.com/", manual_path)
