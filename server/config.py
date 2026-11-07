"""Where PharmaGraph keeps your data.

Code and data live in different folders, so updating the app never touches your knowledge.
"""
import os
from pathlib import Path

APP_VERSION = "0.1.0"


def data_dir() -> Path:
    # Set the PHARMAGRAPH_DATA environment variable to use another folder (tests use a temporary one).
    return Path(os.environ.get("PHARMAGRAPH_DATA", Path.home() / "PharmaGraph-Data"))


def db_path() -> Path:
    return data_dir() / "pharmagraph.db"


def backups_dir() -> Path:
    return data_dir() / "backups"
