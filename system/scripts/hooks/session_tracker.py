"""
AgentOS Hooks — Session Tracker (Phase 2)
Manages .session_state.json to accumulate state across tool calls within a session.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from .config import SESSION_STATE_FILE


def _state_path() -> Path:
    """Return the absolute path to the session state file."""
    return Path(__file__).resolve().parent / SESSION_STATE_FILE


def _default_state() -> dict:
    """Return a fresh session state."""
    return {
        "structural_change_detected": False,
        "modified_files": [],
        "checklist": {
            "changelog": False,
            "world_md": False,
            "bus_md": False,
            "claude_md": False,
            "readme": False,
        },
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def load_state() -> dict:
    """Load session state from disk. Returns default state if file missing or corrupt."""
    path = _state_path()
    if not path.exists():
        return _default_state()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_state()


def save_state(state: dict) -> None:
    """Persist session state to disk."""
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    path = _state_path()
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def reset_state() -> None:
    """Reset session state to defaults (called at end of session)."""
    path = _state_path()
    if path.exists():
        path.unlink()


def mark_structural_change(state: dict, file_path: str) -> dict:
    """Mark that a structural change was detected."""
    state["structural_change_detected"] = True
    if file_path not in state["modified_files"]:
        state["modified_files"].append(file_path)
    return state


def mark_checklist_item(state: dict, item: str) -> dict:
    """Mark a checklist item as completed."""
    if item in state["checklist"]:
        state["checklist"][item] = True
    return state


def record_file(state: dict, file_path: str) -> dict:
    """Record a modified file in the session."""
    if file_path not in state["modified_files"]:
        state["modified_files"].append(file_path)
    return state


def get_incomplete_checklist(state: dict) -> list[str]:
    """Return list of checklist items that are still False."""
    return [k for k, v in state["checklist"].items() if not v]
