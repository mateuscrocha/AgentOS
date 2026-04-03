"""
AgentOS Hooks — Utilities
Path normalization, stdin reading, and glob matching for Windows + POSIX.
"""

import json
import os
import sys
from fnmatch import fnmatch
from pathlib import Path, PurePosixPath


def get_root() -> Path:
    """Return the AgentOS root directory (two levels up from system/scripts/hooks/)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def normalize_path(file_path: str, root: Path | None = None) -> str:
    """
    Convert an absolute or relative file path to a POSIX-style relative path
    from the AgentOS root.

    Handles:
    - Windows absolute paths:  C:\\Users\\...\\AgentOS\\system\\foo.md
    - MSYS/Git-bash paths:     /c/Users/.../AgentOS/system/foo.md
    - Already-relative paths:  system/foo.md
    """
    if root is None:
        root = get_root()

    # Normalize to a resolved Path object
    p = Path(file_path).resolve()
    root_resolved = root.resolve()

    try:
        rel = p.relative_to(root_resolved)
    except ValueError:
        # Path is outside the AgentOS root — return as-is with forward slashes
        return str(PurePosixPath(p))

    return str(PurePosixPath(rel))


def read_tool_input() -> dict:
    """
    Read the JSON tool input from stdin.
    Claude Code passes $TOOL_INPUT as JSON on stdin to hook commands.
    Returns an empty dict if stdin is empty or invalid.
    """
    try:
        data = sys.stdin.read()
        if not data.strip():
            return {}
        return json.loads(data)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def extract_file_path(tool_input: dict) -> str | None:
    """
    Extract the file_path from tool input.
    Works for both Write (file_path) and Edit (file_path) tools.
    """
    return tool_input.get("file_path")


def match_glob(path: str, patterns: list[str]) -> bool:
    """
    Check if a POSIX-style relative path matches any glob pattern in the list.
    Uses fnmatch for each path segment level.

    Supports:
    - system/protocols/*          (any file directly in protocols/)
    - system/agents/*/AGENT.md    (AGENT.md in any agent dir)
    - system/agents/*/memory/*.md (any .md in any agent's memory/)
    - docs/**/*                   (any file recursively under docs/)
    - *.key                       (any .key file at any depth)
    """
    for pattern in patterns:
        if _match_single(path, pattern):
            return True
    return False


def match_filename(filename: str, patterns: list[str]) -> bool:
    """Check if a filename (basename only) matches any pattern."""
    for pattern in patterns:
        if fnmatch(filename, pattern):
            return True
    return False


def _match_single(path: str, pattern: str) -> bool:
    """Match a single path against a single glob pattern."""
    # Handle ** (recursive) patterns
    if "**" in pattern:
        # Convert ** pattern to work with fnmatch
        # e.g., docs/**/* matches docs/foo/bar/baz.md
        prefix = pattern.split("**")[0].rstrip("/")
        if path.startswith(prefix + "/") or path == prefix:
            return True
        return False

    # Split both path and pattern into segments
    path_parts = path.replace("\\", "/").split("/")
    pattern_parts = pattern.replace("\\", "/").split("/")

    if len(path_parts) != len(pattern_parts):
        return False

    for p_part, g_part in zip(path_parts, pattern_parts):
        if not fnmatch(p_part, g_part):
            return False

    return True
