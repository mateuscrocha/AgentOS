#!/usr/bin/env python3
"""
AgentOS Hooks — Stop Entry Point (Phase 2)
Validates maintenance checklist at end of session.
Always exits 0 (advisory only).
"""

import sys
from pathlib import Path

# Add parent dirs to path so we can import as a package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from system.scripts.hooks.session_tracker import get_incomplete_checklist, load_state, reset_state

# Friendly labels for checklist items
LABELS = {
    "changelog": "CHANGELOG.md",
    "world_md": "system/memory/world.md",
    "bus_md": "system/memory/bus.md",
    "codex_md": "CODEX.md",
    "claude_md": "CLAUDE.md",
    "readme": "README.md",
}


def main():
    state = load_state()

    if not state.get("structural_change_detected"):
        # No structural changes in this session — nothing to check
        reset_state()
        sys.exit(0)

    incomplete = get_incomplete_checklist(state)

    if not incomplete:
        print("Maintenance checklist: COMPLETE", file=sys.stderr)
    else:
        print(
            "WARNING: Structural changes were made but maintenance checklist is incomplete:",
            file=sys.stderr,
        )
        for key, checked in state["checklist"].items():
            label = LABELS.get(key, key)
            mark = "x" if checked else " "
            print(f"  [{mark}] {label}", file=sys.stderr)

        modified = state.get("modified_files", [])
        if modified:
            print(f"\nStructural files modified: {', '.join(modified)}", file=sys.stderr)

    reset_state()
    sys.exit(0)


if __name__ == "__main__":
    main()
