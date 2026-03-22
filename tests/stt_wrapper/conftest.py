"""
Ensure pytest does not pick up production-like secrets from .env before stt_wrapper.app loads.

python-dotenv does not override existing env keys; we pin keys before import so tests stay hermetic.
"""

import os

os.environ["LOG_FILE_DIR"] = ""
os.environ["STT_AUTH_TOKEN"] = ""
