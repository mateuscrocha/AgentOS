"""
AgentOS Hooks — Enforcement Logic (Phase 2)
Detects structural changes and tracks maintenance checklist compliance.

Key behavior: ANY meaningful write (not routine) activates the checklist.
The hook reminds about CHANGELOG.md on every write after activation,
not just at Stop time.
"""

from .config import CHECKLIST_MAP, ROUTINE_WRITE_PATTERNS, STRUCTURAL_CHANGE_PATTERNS, SYNC_TRIGGER_PATTERNS
from .session_tracker import (
    load_state,
    mark_checklist_item,
    mark_structural_change,
    record_file,
    save_state,
)
from .utils import match_glob


def is_structural_change(rel_path: str) -> bool:
    """Check if a file path indicates a meaningful (non-routine) change."""
    # Explicit structural patterns
    if match_glob(rel_path, STRUCTURAL_CHANGE_PATTERNS):
        return True
    return False


def get_sync_reminder(rel_path: str) -> str | None:
    """Check if a file change should trigger a sync reminder.
    Returns the reminder message if matched, None otherwise."""
    for pattern, message in SYNC_TRIGGER_PATTERNS.items():
        if match_glob(rel_path, [pattern]):
            return message
    return None


def is_routine_write(rel_path: str) -> bool:
    """Check if a write is routine (memory updates, checklist files)."""
    return match_glob(rel_path, ROUTINE_WRITE_PATTERNS)


def get_checklist_item(rel_path: str) -> str | None:
    """
    Check if a file path corresponds to a maintenance checklist item.
    Returns the checklist item key if matched, None otherwise.
    """
    for item_key, patterns in CHECKLIST_MAP.items():
        if match_glob(rel_path, patterns):
            return item_key
    return None


def check_world_md_content(tool_input: dict) -> str | None:
    """
    If writing to a world.md file, check that content includes
    the required 'Última Alteração' section.
    Returns a reminder message if missing, None if ok.
    """
    content = tool_input.get("content", "")
    file_path = tool_input.get("file_path", "")

    # Only check Write operations (Edit doesn't have full content)
    if not content:
        return None

    # Only check world.md files
    if not file_path or "world.md" not in file_path:
        return None

    if "ltima Altera" not in content and "Ultima Altera" not in content:
        return (
            "REMINDER: world.md should include a '## Última Alteração' section "
            "with date, what changed, and responsible agent."
        )
    return None


def process_write(rel_path: str, tool_input: dict) -> list[str]:
    """
    Process a Write/Edit operation for enforcement tracking.
    Returns a list of messages to output (may be empty).

    Key behavior:
    - Structural changes activate checklist tracking
    - After activation, EVERY non-checklist write reminds about pending items
    - CHANGELOG.md is always highlighted if missing
    """
    messages = []
    state = load_state()

    # Track the file
    state = record_file(state, rel_path)

    # Check if this is a checklist item being satisfied
    item = get_checklist_item(rel_path)
    if item:
        state = mark_checklist_item(state, item)

    # Check if this write triggers structural change detection
    if not is_routine_write(rel_path) and is_structural_change(rel_path):
        was_detected = state["structural_change_detected"]
        state = mark_structural_change(state, rel_path)
        if not was_detected:
            messages.append(
                f"NOTICE: Structural change detected ({rel_path}). "
                "Maintenance checklist tracking activated. "
                "Remember to update CHANGELOG.md before finishing."
            )

    # Check world.md content
    reminder = check_world_md_content(tool_input)
    if reminder:
        messages.append(reminder)

    # Sync reminder: if changing KERNEL, agents or commands, warn about runtime sync
    sync_msg = get_sync_reminder(rel_path)
    if sync_msg:
        state = mark_structural_change(state, rel_path)
        messages.append(f"SYNC: {sync_msg}")

    # Active reminder: if checklist is active and this is NOT a checklist write,
    # remind about pending items (especially CHANGELOG)
    if state["structural_change_detected"] and not item:
        pending = [k for k, v in state["checklist"].items() if not v]
        if pending:
            if "changelog" in pending:
                messages.append(
                    "REMINDER: CHANGELOG.md has not been updated yet. "
                    "Update it before finishing this session."
                )
            else:
                remaining = ", ".join(pending)
                messages.append(f"Checklist still pending: {remaining}")

    save_state(state)
    return messages
