#!/usr/bin/env python3
"""
AgentOS Hooks — PostToolUse Entry Point (Phase 2)
Tracks writes for maintenance checklist enforcement.
Always exits 0 (warn only, never block).
"""

import sys
from pathlib import Path

# Add parent dirs to path so we can import as a package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from system.scripts.hooks.enforcement import process_write
from system.scripts.hooks.utils import extract_file_path, normalize_path, read_tool_input


def main():
    tool_input = read_tool_input()

    file_path = extract_file_path(tool_input)
    if not file_path:
        sys.exit(0)

    rel_path = normalize_path(file_path)
    messages = process_write(rel_path, tool_input)

    for msg in messages:
        print(msg, file=sys.stderr)

    # Always exit 0 — enforcement warns, never blocks
    sys.exit(0)


if __name__ == "__main__":
    main()
