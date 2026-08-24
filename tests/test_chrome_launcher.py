import os
import sys
import pytest
from backend.services.chrome_launcher import ChromeLauncher


def test_chrome_binary_detection():
    # Chrome detection should return a string path or None without raising exceptions
    path = ChromeLauncher.find_chrome_binary()
    if path:
        assert isinstance(path, str)
        assert os.path.exists(path)


def test_chrome_manual_path_override(tmp_path):
    # Test fake executable
    dummy_exe = tmp_path / "custom_chrome"
    dummy_exe.touch()
    os.chmod(dummy_exe, 0o755)

    found = ChromeLauncher.find_chrome_binary(manual_path=str(dummy_exe))
    assert found == str(dummy_exe)
