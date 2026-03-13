#!/usr/bin/env python3
"""
Run the STT wrapper with CUDA library path set before the process starts.
Same fix as model_benchmark.py: add stt-wrapper to path, import cuda_env
(which sets LD_LIBRARY_PATH), then exec uvicorn so it inherits that env.
Use this when starting the STT via tsummix so the cublas fix is applied.
"""
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stt_wrapper = os.path.join(root, "stt-wrapper")
if stt_wrapper not in sys.path:
    sys.path.insert(0, stt_wrapper)

import cuda_env  # noqa: E402 — sets LD_LIBRARY_PATH (or PATH on Windows)

if sys.platform == "win32":
    uvicorn_exe = os.path.join(root, ".venv", "Scripts", "uvicorn.exe")
else:
    uvicorn_exe = os.path.join(root, ".venv", "bin", "uvicorn")

os.execve(uvicorn_exe, ["uvicorn", "stt-wrapper.app:app"], os.environ)
