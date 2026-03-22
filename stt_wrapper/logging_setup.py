"""
Rotating JSON-line logs for the STT wrapper (Loki/Promtail parity with Node services/logger).

Env (same semantics as Node where applicable):
  LOG_FILE_DIR       — if set, enable file logging under this directory
  LOG_FILE_NAME      — default stt-wrapper.log
  LOG_FILE_MAX_SIZE  — default 10M (K/M/G suffix)
  LOG_FILE_MAX_FILES — default 14
  LOG_TO_STDOUT      — if LOG_FILE_DIR is set, default false to avoid duplicate lines in Loki
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler


def _parse_size(s: str) -> int:
    s = s.strip().upper()
    if not s:
        return 10 * 1024 * 1024
    if s.endswith("M"):
        return int(float(s[:-1]) * 1024 * 1024)
    if s.endswith("G"):
        return int(float(s[:-1]) * 1024 * 1024 * 1024)
    if s.endswith("K"):
        return int(float(s[:-1]) * 1024)
    return int(s)


def _parse_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return str(raw).lower().strip() == "true"


class JsonLineFormatter(logging.Formatter):
    """One JSON object per line, aligned with services/logger envelope shape."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "component": "stt-wrapper",
            "event": getattr(record, "event", None) or f"python_{record.name}",
            "message": record.getMessage(),
            "context": {
                "logger": record.name,
                "pathname": record.pathname,
                "lineno": record.lineno,
            },
        }
        if record.exc_info:
            entry["context"]["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def configure_logging() -> None:
    log_dir = os.getenv("LOG_FILE_DIR", "").strip()
    if not log_dir:
        return

    os.makedirs(log_dir, mode=0o755, exist_ok=True)
    filename = os.getenv("LOG_FILE_NAME", "").strip() or "stt-wrapper.log"
    max_bytes = _parse_size(os.getenv("LOG_FILE_MAX_SIZE", "10M"))
    max_files_raw = os.getenv("LOG_FILE_MAX_FILES", "14")
    try:
        backup_count = max(1, int(max_files_raw))
    except ValueError:
        backup_count = 14

    log_to_stdout = _parse_bool("LOG_TO_STDOUT", False)

    path = os.path.join(log_dir, filename)
    file_handler = RotatingFileHandler(
        path,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(JsonLineFormatter())
    file_handler.setLevel(logging.DEBUG)

    stdout_handler = None
    if log_to_stdout:
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setFormatter(JsonLineFormatter())
        stdout_handler.setLevel(logging.DEBUG)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)
    root.addHandler(file_handler)
    if stdout_handler:
        root.addHandler(stdout_handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.setLevel(logging.INFO)
        lg.addHandler(file_handler)
        if stdout_handler:
            lg.addHandler(stdout_handler)
        lg.propagate = False
