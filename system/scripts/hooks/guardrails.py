"""
AgentOS Hooks — Guardrails (Phase 1)
Preventive checks that block forbidden Write/Edit operations.
"""

import os

from .config import ALLOWED_SYSTEM_WRITES, BLOCKED_SYSTEM_PATHS, SECRETS_PATTERNS
from .utils import match_filename, match_glob


def check_secrets(rel_path: str) -> str | None:
    """
    Block writes to files that look like secrets.
    Returns an error message if blocked, None if allowed.
    """
    filename = os.path.basename(rel_path)
    if match_filename(filename, SECRETS_PATTERNS):
        return (
            f"BLOCKED: Writing secrets files is not allowed: {filename}\n"
            f"Path: {rel_path}"
        )
    return None


def check_blocked_system(rel_path: str) -> str | None:
    """
    Block writes to protected structural system files.
    Returns an error message if blocked, None if allowed.
    """
    if match_glob(rel_path, BLOCKED_SYSTEM_PATHS):
        return (
            f"BLOCKED: Direct modification of system structure is not allowed: {rel_path}\n"
            "Use the appropriate system agent to make structural changes."
        )
    return None


def check_system_directory(rel_path: str) -> str | None:
    """
    Block writes to system/ paths that are not in the explicit allow list.
    Returns an error message if blocked, None if allowed.
    """
    if not rel_path.startswith("system/"):
        return None

    if match_glob(rel_path, ALLOWED_SYSTEM_WRITES):
        return None

    return (
        f"BLOCKED: Writing to system/ requires explicit allowlisting: {rel_path}\n"
        "Only memory files, registries, and documentation are writable."
    )


def run_guardrails(rel_path: str) -> str | None:
    """
    Run all guardrail checks in priority order.
    Returns the first error message found, or None if all checks pass.
    """
    # Check 1: Secrets (highest priority)
    error = check_secrets(rel_path)
    if error:
        return error

    # Check 2: Blocked structural paths
    error = check_blocked_system(rel_path)
    if error:
        return error

    # Check 3: Generic system/ protection
    error = check_system_directory(rel_path)
    if error:
        return error

    return None
