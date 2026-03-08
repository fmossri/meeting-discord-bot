#!/usr/bin/env bash
# Run CUDA/GPU checks for faster-whisper on WSL (or Linux). Use from repo root.
# Usage: ./scripts/diagnose-cuda.sh   or   bash scripts/diagnose-cuda.sh
_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$_REPO_ROOT"

echo "=== CUDA / GPU diagnosis ==="
echo ""

# 1. nvidia-smi
echo "1. nvidia-smi (driver + GPU)"
if command -v nvidia-smi &>/dev/null; then
	nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || nvidia-smi
else
	echo "   nvidia-smi not found or not in PATH. Install NVIDIA driver for WSL/Linux if you want GPU."
fi
echo ""

# 2. venv and pip packages
echo "2. Venv and nvidia pip packages"
if [ -d ".venv/bin" ]; then
	. .venv/bin/activate
	for pkg in nvidia-cublas-cu12 nvidia-cudnn-cu12; do
		if pip show "$pkg" &>/dev/null; then
			echo "   $pkg: $(pip show "$pkg" | grep -E '^(Version|Location):' | tr '\n' ' ')"
		else
			echo "   $pkg: not installed (pip install nvidia-cublas-cu12 nvidia-cudnn-cu12)"
		fi
	done
else
	echo "   .venv not found. Create it and install requirements first."
fi
echo ""

# 3. Lib path exists
echo "3. Venv CUDA lib path"
_PYVER="$(python -c 'import sys; print(f"python{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)" || true
if [ -n "$_PYVER" ]; then
	_CUBLAS=".venv/lib/${_PYVER}/site-packages/nvidia/cublas/lib"
	if [ -d "$_CUBLAS" ]; then
		echo "   $_CUBLAS exists ($(ls "$_CUBLAS" 2>/dev/null | head -3 | tr '\n' ' '))"
	else
		echo "   $_CUBLAS not found (wrong Python version or nvidia-cublas-cu12 not installed?)"
	fi
else
	echo "   Could not get Python version from venv"
fi
echo ""

# 4. CTranslate2 CUDA (raw import; STT app/repl/benchmark use cuda_env.py to set path)
echo "4. CTranslate2 CUDA device count (this shell; STT entry points set path via cuda_env.py)"
if python -c "import ctranslate2" 2>/dev/null; then
	_count=$(python -c "import ctranslate2; print(ctranslate2.get_cuda_device_count())" 2>/dev/null) || _count="error"
	echo "   get_cuda_device_count(): $_count"
	if [ "$_count" = "error" ]; then
		echo "   (Direct import may fail here; app.py, repl.py, model_benchmark.py set LD_LIBRARY_PATH via cuda_env.py when run.)"
	fi
else
	echo "   ctranslate2 not importable"
fi
echo ""
echo "=== End diagnosis ==="
