"""
AgentOS Hooks — Configuration
Constantes centrais para guardrails, enforcement e sync detection.
"""

# ---------------------------------------------------------------------------
# Phase 1 — Guardrails (PreToolUse)
# ---------------------------------------------------------------------------

# Paths that are NEVER writable via Write/Edit (structural system files)
BLOCKED_SYSTEM_PATHS = [
    "system/protocols/*",
    "system/templates/*",
    "system/scripts/*",
    "system/scripts/**/*",
    "system/agents/*/AGENT.md",
    "system/skills/*/SKILL.md",
    ".Codex/settings.json",
    ".Codex/settings.local.json",
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".gemini/settings.json",
]

# Paths within system/ that ARE writable (memory, registries, logs)
ALLOWED_SYSTEM_WRITES = [
    "system/memory/*.md",
    "system/agents/*/memory/*.md",
    "system/agents/*/memory/skill-registry.md",
    "CHANGELOG.md",
    "CODEX.md",
    "CLAUDE.md",
    "GEMINI.md",
    "KERNEL.md",
    "README.md",
    "docs/*",
    "docs/**/*",
]

# Filename patterns that should never be written (secrets)
SECRETS_PATTERNS = [
    ".env",
    ".env.*",
    "credentials.json",
    "*.key",
    "*.pem",
    "*.p12",
    "*.pfx",
    "secrets.json",
    "secrets.yaml",
    "secrets.yml",
    "secret.json",
    "secret.yaml",
    "secret.yml",
    ".npmrc",
    ".pypirc",
]

# ---------------------------------------------------------------------------
# Phase 2 — Enforcement (PostToolUse / Stop)
# ---------------------------------------------------------------------------

# Patterns that indicate a structural change (triggers checklist tracking)
# Broad scope: ANY meaningful write to the system activates the checklist.
STRUCTURAL_CHANGE_PATTERNS = [
    # Resource creation/modification
    "spaces/*/SPACE.md",
    "spaces/*/areas/*/AREA.md",
    "spaces/*/areas/*/teams/*/TEAM.md",
    "spaces/*/areas/*/agents/*/AGENT.md",
    "spaces/*/areas/*/teams/*/agents/*/AGENT.md",
    # Agent/skill registration and definitions
    ".Codex/agents/*.md",
    ".claude/agents/*.md",
    ".gemini/agents/*.md",
    ".Codex/commands/*.md",
    ".claude/commands/*.md",
    ".gemini/skills/*.md",
    "*/skills/*/SKILL.md",
    # System memory updates (world state changes)
    "system/memory/world.md",
    # User agent/skill definitions
    "spaces/*/areas/*/agents/*/skills/*/SKILL.md",
    "spaces/*/areas/*/teams/*/agents/*/skills/*/SKILL.md",
    # Guidelines changes
    "spaces/*/guidelines/*.md",
    "spaces/*/areas/*/guidelines/*.md",
    "spaces/*/areas/*/teams/*/guidelines/*.md",
]

# Files that are exempt from triggering the checklist (routine writes)
ROUTINE_WRITE_PATTERNS = [
    # Memory files are routine (history, handoffs, bus appends)
    "system/memory/bus.md",
    "system/memory/handoff.md",
    "system/agents/*/memory/history.md",
    "spaces/*/memory/handoff.md",
    "spaces/*/areas/*/memory/handoff.md",
    "spaces/*/areas/*/teams/*/memory/handoff.md",
    # Checklist files themselves are not triggers
    "CHANGELOG.md",
    "CODEX.md",
    "CLAUDE.md",
    "GEMINI.md",
    "KERNEL.md",
    "README.md",
    "docs/*",
    "docs/**/*",
]

# Map of checklist item name -> file patterns that satisfy it
CHECKLIST_MAP = {
    "changelog": ["CHANGELOG.md"],
    "world_md": ["system/memory/world.md"],
    "bus_md": ["system/memory/bus.md"],
    "codex_md": ["CODEX.md"],
    "claude_md": ["CLAUDE.md"],
    "readme": ["README.md"],
}

# ---------------------------------------------------------------------------
# Phase 2.5 — Sync Detection (PostToolUse)
# ---------------------------------------------------------------------------

# Patterns that indicate a sync between runtimes may be needed.
# When these files are changed, the hook warns about pending sync.
SYNC_TRIGGER_PATTERNS = {
    "KERNEL.md": (
        "KERNEL.md alterado — verificar se CODEX.md e GEMINI.md estão consistentes. "
        "Execute `py -3 system/scripts/sync.py` para verificar."
    ),
    ".Codex/agents/*.md": (
        "Agent alterado em .Codex/ — sync com .gemini/agents/ pode estar pendente. "
        "Execute `py -3 system/scripts/sync.py --fix` para sincronizar."
    ),
    ".Codex/commands/*.md": (
        "Command alterado em .Codex/ — sync com .gemini/skills/ pode estar pendente. "
        "Execute `py -3 system/scripts/sync.py --fix` para sincronizar."
    ),
    ".claude/agents/*.md": (
        "Agent alterado em .claude/ — sync com .gemini/agents/ pode estar pendente. "
        "Execute `py -3 system/scripts/sync.py --fix` para sincronizar."
    ),
    ".claude/commands/*.md": (
        "Command alterado em .claude/ — sync com .gemini/skills/ pode estar pendente. "
        "Execute `py -3 system/scripts/sync.py --fix` para sincronizar."
    ),
}

# Session state file location (relative to hooks dir)
SESSION_STATE_FILE = ".session_state.json"
