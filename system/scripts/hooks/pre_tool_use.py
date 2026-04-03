#!/usr/bin/env python3
"""
AgentOS Hooks — PreToolUse Entry Point (Phase 1)
Reads tool input from stdin and runs guardrail checks.
Exit code 0 = allowed, non-zero = blocked (message printed to stderr).
"""

import sys
from pathlib import Path

# Add parent dirs to path so we can import as a package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from system.scripts.hooks.guardrails import run_guardrails
from system.scripts.hooks.utils import extract_file_path, normalize_path, read_tool_input


def main():
    tool_input = read_tool_input()

    file_path = extract_file_path(tool_input)
    if not file_path:
        # No file_path in input — nothing to check
        sys.exit(0)

    rel_path = normalize_path(file_path)

    error = run_guardrails(rel_path)
    if error:
        print(error, file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
