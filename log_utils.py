import logging
import os
from logging.handlers import RotatingFileHandler

_LOGGER_CONFIGURED = False


def _ensure_logs_dir() -> str:
    """Create a logs directory next to this file and return its path."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    logs_dir = os.path.join(base_dir, "logs")
    try:
        os.makedirs(logs_dir, exist_ok=True)
    except Exception:
        # Fallback to /tmp if workspace is read-only for any reason
        logs_dir = "/tmp"
    return logs_dir


def configure_root_logger() -> None:
    global _LOGGER_CONFIGURED
    if _LOGGER_CONFIGURED:
        return

    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logs_dir = _ensure_logs_dir()
    log_file = os.path.join(logs_dir, "qpcr_debug.log")

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)

    # File handler with rotation (keep last 5 files, 5MB each)
    try:
        file_handler = RotatingFileHandler(
            log_file, maxBytes=5 * 1024 * 1024, backupCount=5
        )
        file_handler.setFormatter(fmt)
        file_handler.setLevel(level)
        root.addHandler(file_handler)
    except Exception:
        # If file handler fails, we still want stdout
        pass

    # Always keep a stream handler for container/dev logs
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(fmt)
    stream_handler.setLevel(level)
    root.addHandler(stream_handler)

    logging.captureWarnings(True)
    _LOGGER_CONFIGURED = True


def get_logger(name: str = __name__) -> logging.Logger:
    """Return a module logger with root configured once."""
    configure_root_logger()
    return logging.getLogger(name)
