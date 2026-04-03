#!/usr/bin/env python3
"""
AgentOS Hooks — Unit Tests
Tests for Phase 1 (guardrails) and Phase 2 (enforcement) hook logic.
Run: py -3 system/scripts/hooks/test_hooks.py
"""

import json
import sys
import unittest
from pathlib import Path

# Setup imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from system.scripts.hooks.config import (
    ALLOWED_SYSTEM_WRITES,
    BLOCKED_SYSTEM_PATHS,
    CHECKLIST_MAP,
    SECRETS_PATTERNS,
    STRUCTURAL_CHANGE_PATTERNS,
)
from system.scripts.hooks.guardrails import (
    check_blocked_system,
    check_secrets,
    check_system_directory,
    run_guardrails,
)
from system.scripts.hooks.utils import match_filename, match_glob, normalize_path


class TestNormalizePath(unittest.TestCase):
    """Test path normalization for Windows and POSIX paths."""

    def setUp(self):
        self.root = Path(__file__).resolve().parent.parent.parent.parent

    def test_relative_posix_path(self):
        result = normalize_path("system/memory/bus.md", self.root)
        self.assertEqual(result, "system/memory/bus.md")

    def test_absolute_windows_path(self):
        abs_path = str(self.root / "system" / "protocols" / "memory.md")
        result = normalize_path(abs_path, self.root)
        self.assertEqual(result, "system/protocols/memory.md")

    def test_root_level_file(self):
        abs_path = str(self.root / "CHANGELOG.md")
        result = normalize_path(abs_path, self.root)
        self.assertEqual(result, "CHANGELOG.md")

    def test_deep_nested_path(self):
        abs_path = str(
            self.root / "spaces" / "myspace" / "areas" / "backend" / "agents" / "api" / "AGENT.md"
        )
        result = normalize_path(abs_path, self.root)
        self.assertEqual(result, "spaces/myspace/areas/backend/agents/api/AGENT.md")


class TestMatchGlob(unittest.TestCase):
    """Test glob pattern matching."""

    def test_single_wildcard(self):
        self.assertTrue(match_glob("system/protocols/memory.md", ["system/protocols/*"]))
        self.assertTrue(match_glob("system/protocols/handoff.md", ["system/protocols/*"]))

    def test_single_wildcard_no_match_subdir(self):
        # system/protocols/* should NOT match nested subdirs
        self.assertFalse(match_glob("system/protocols/sub/file.md", ["system/protocols/*"]))

    def test_middle_wildcard(self):
        self.assertTrue(match_glob("system/agents/agent-manager/AGENT.md", ["system/agents/*/AGENT.md"]))
        self.assertTrue(match_glob("system/agents/skill-manager/AGENT.md", ["system/agents/*/AGENT.md"]))

    def test_middle_wildcard_no_match(self):
        self.assertFalse(match_glob("system/agents/agent-manager/memory/history.md", ["system/agents/*/AGENT.md"]))

    def test_double_wildcard(self):
        self.assertTrue(match_glob("docs/overview.md", ["docs/**/*"]))
        self.assertTrue(match_glob("docs/api/endpoints.md", ["docs/**/*"]))

    def test_filename_only_pattern(self):
        # *.key should match at the same depth level only
        self.assertTrue(match_glob("server.key", ["*.key"]))
        self.assertFalse(match_glob("certs/server.key", ["*.key"]))

    def test_memory_wildcard(self):
        self.assertTrue(
            match_glob("system/agents/agent-manager/memory/history.md", ["system/agents/*/memory/*.md"])
        )
        self.assertTrue(
            match_glob("system/agents/skill-manager/memory/registry.md", ["system/agents/*/memory/*.md"])
        )

    def test_no_match(self):
        self.assertFalse(match_glob("random/path/file.txt", ["system/protocols/*"]))


class TestMatchFilename(unittest.TestCase):
    """Test filename pattern matching."""

    def test_exact_match(self):
        self.assertTrue(match_filename(".env", SECRETS_PATTERNS))

    def test_dotenv_variants(self):
        self.assertTrue(match_filename(".env.local", SECRETS_PATTERNS))
        self.assertTrue(match_filename(".env.production", SECRETS_PATTERNS))

    def test_key_files(self):
        self.assertTrue(match_filename("server.key", SECRETS_PATTERNS))
        self.assertTrue(match_filename("private.pem", SECRETS_PATTERNS))
        self.assertTrue(match_filename("cert.p12", SECRETS_PATTERNS))

    def test_credentials(self):
        self.assertTrue(match_filename("credentials.json", SECRETS_PATTERNS))
        self.assertTrue(match_filename("secrets.json", SECRETS_PATTERNS))
        self.assertTrue(match_filename("secrets.yaml", SECRETS_PATTERNS))

    def test_non_secret_files(self):
        self.assertFalse(match_filename("config.json", SECRETS_PATTERNS))
        self.assertFalse(match_filename("README.md", SECRETS_PATTERNS))
        self.assertFalse(match_filename("AGENT.md", SECRETS_PATTERNS))


class TestGuardrailSecrets(unittest.TestCase):
    """Test secrets check."""

    def test_blocks_env_file(self):
        self.assertIsNotNone(check_secrets(".env"))
        self.assertIsNotNone(check_secrets("spaces/myspace/.env"))

    def test_blocks_key_file(self):
        self.assertIsNotNone(check_secrets("certs/server.key"))

    def test_allows_normal_file(self):
        self.assertIsNone(check_secrets("system/memory/bus.md"))
        self.assertIsNone(check_secrets("CHANGELOG.md"))


class TestGuardrailBlockedSystem(unittest.TestCase):
    """Test structural system file protection."""

    def test_blocks_protocols(self):
        self.assertIsNotNone(check_blocked_system("system/protocols/memory.md"))
        self.assertIsNotNone(check_blocked_system("system/protocols/handoff.md"))

    def test_blocks_templates(self):
        self.assertIsNotNone(check_blocked_system("system/templates/agent.md"))

    def test_blocks_scripts(self):
        self.assertIsNotNone(check_blocked_system("system/scripts/setup.py"))
        self.assertIsNotNone(check_blocked_system("system/scripts/hooks/config.py"))

    def test_blocks_agent_definitions(self):
        self.assertIsNotNone(check_blocked_system("system/agents/agent-manager/AGENT.md"))

    def test_blocks_skill_definitions(self):
        self.assertIsNotNone(check_blocked_system("system/skills/brand-guidelines/SKILL.md"))

    def test_blocks_settings(self):
        self.assertIsNotNone(check_blocked_system(".claude/settings.json"))
        self.assertIsNotNone(check_blocked_system(".gemini/settings.json"))

    def test_allows_memory_files(self):
        self.assertIsNone(check_blocked_system("system/memory/bus.md"))
        self.assertIsNone(check_blocked_system("system/agents/agent-manager/memory/history.md"))

    def test_allows_user_space_files(self):
        self.assertIsNone(check_blocked_system("spaces/myspace/areas/backend/agents/api/AGENT.md"))


class TestGuardrailSystemDirectory(unittest.TestCase):
    """Test generic system/ directory protection."""

    def test_allows_memory(self):
        self.assertIsNone(check_system_directory("system/memory/bus.md"))
        self.assertIsNone(check_system_directory("system/memory/world.md"))

    def test_allows_agent_memory(self):
        self.assertIsNone(check_system_directory("system/agents/agent-manager/memory/history.md"))

    def test_blocks_unknown_system_path(self):
        self.assertIsNotNone(check_system_directory("system/unknown/random.txt"))

    def test_allows_non_system_paths(self):
        self.assertIsNone(check_system_directory("spaces/myspace/anything.md"))
        self.assertIsNone(check_system_directory("CHANGELOG.md"))

    def test_allows_docs(self):
        self.assertIsNone(check_system_directory("docs/overview.md"))


class TestRunGuardrails(unittest.TestCase):
    """Test the full guardrails pipeline."""

    def test_blocks_secrets_first(self):
        # Even if path is in system/, secrets check comes first
        result = run_guardrails("system/memory/.env")
        self.assertIn("BLOCKED", result)
        self.assertIn("secrets", result.lower())

    def test_blocks_structural(self):
        result = run_guardrails("system/protocols/memory.md")
        self.assertIn("BLOCKED", result)
        self.assertIn("system structure", result.lower())

    def test_blocks_unallowed_system(self):
        result = run_guardrails("system/random/file.txt")
        self.assertIn("BLOCKED", result)

    def test_allows_memory(self):
        self.assertIsNone(run_guardrails("system/memory/bus.md"))

    def test_allows_changelog(self):
        self.assertIsNone(run_guardrails("CHANGELOG.md"))

    def test_allows_user_space(self):
        self.assertIsNone(run_guardrails("spaces/myspace/areas/backend/agents/api/AGENT.md"))

    def test_allows_claude_agents_dir(self):
        # .claude/agents/*.md is NOT in blocked list (only .claude/settings.json is)
        self.assertIsNone(run_guardrails(".claude/agents/my-agent.md"))

    def test_allows_claude_commands_dir(self):
        self.assertIsNone(run_guardrails(".claude/commands/new-space.md"))


class TestStructuralChangePatterns(unittest.TestCase):
    """Test patterns used for Phase 2 structural change detection."""

    def test_space_creation(self):
        self.assertTrue(match_glob("spaces/myspace/SPACE.md", STRUCTURAL_CHANGE_PATTERNS))

    def test_area_creation(self):
        self.assertTrue(match_glob("spaces/myspace/areas/backend/AREA.md", STRUCTURAL_CHANGE_PATTERNS))

    def test_team_creation(self):
        self.assertTrue(
            match_glob("spaces/myspace/areas/backend/teams/api/TEAM.md", STRUCTURAL_CHANGE_PATTERNS)
        )

    def test_agent_registration(self):
        self.assertTrue(match_glob(".claude/agents/myspace--backend--api.md", STRUCTURAL_CHANGE_PATTERNS))

    def test_normal_file_not_structural(self):
        self.assertFalse(match_glob("system/memory/bus.md", STRUCTURAL_CHANGE_PATTERNS))
        self.assertFalse(match_glob("CHANGELOG.md", STRUCTURAL_CHANGE_PATTERNS))


class TestChecklistMap(unittest.TestCase):
    """Test checklist file pattern matching."""

    def test_changelog_matches(self):
        self.assertTrue(match_glob("CHANGELOG.md", CHECKLIST_MAP["changelog"]))

    def test_world_md_matches(self):
        self.assertTrue(match_glob("system/memory/world.md", CHECKLIST_MAP["world_md"]))

    def test_bus_md_matches(self):
        self.assertTrue(match_glob("system/memory/bus.md", CHECKLIST_MAP["bus_md"]))

    def test_claude_md_matches(self):
        self.assertTrue(match_glob("CLAUDE.md", CHECKLIST_MAP["claude_md"]))

    def test_readme_matches(self):
        self.assertTrue(match_glob("README.md", CHECKLIST_MAP["readme"]))


class TestSessionTracker(unittest.TestCase):
    """Test session state management."""

    def setUp(self):
        from system.scripts.hooks.session_tracker import _state_path, reset_state
        self.state_path = _state_path()
        reset_state()  # Start clean

    def tearDown(self):
        from system.scripts.hooks.session_tracker import reset_state
        reset_state()

    def test_default_state(self):
        from system.scripts.hooks.session_tracker import load_state
        state = load_state()
        self.assertFalse(state["structural_change_detected"])
        self.assertEqual(state["modified_files"], [])
        self.assertFalse(state["checklist"]["changelog"])

    def test_save_and_load(self):
        from system.scripts.hooks.session_tracker import load_state, save_state
        state = load_state()
        state["structural_change_detected"] = True
        save_state(state)
        reloaded = load_state()
        self.assertTrue(reloaded["structural_change_detected"])

    def test_mark_structural_change(self):
        from system.scripts.hooks.session_tracker import load_state, mark_structural_change
        state = load_state()
        state = mark_structural_change(state, "spaces/myspace/SPACE.md")
        self.assertTrue(state["structural_change_detected"])
        self.assertIn("spaces/myspace/SPACE.md", state["modified_files"])

    def test_mark_checklist_item(self):
        from system.scripts.hooks.session_tracker import load_state, mark_checklist_item
        state = load_state()
        state = mark_checklist_item(state, "changelog")
        self.assertTrue(state["checklist"]["changelog"])

    def test_get_incomplete_checklist(self):
        from system.scripts.hooks.session_tracker import (
            get_incomplete_checklist, load_state, mark_checklist_item,
        )
        state = load_state()
        state = mark_checklist_item(state, "changelog")
        state = mark_checklist_item(state, "world_md")
        incomplete = get_incomplete_checklist(state)
        self.assertNotIn("changelog", incomplete)
        self.assertNotIn("world_md", incomplete)
        self.assertIn("bus_md", incomplete)
        self.assertIn("claude_md", incomplete)
        self.assertIn("readme", incomplete)


class TestEnforcement(unittest.TestCase):
    """Test enforcement logic."""

    def setUp(self):
        from system.scripts.hooks.session_tracker import reset_state
        reset_state()

    def tearDown(self):
        from system.scripts.hooks.session_tracker import reset_state
        reset_state()

    def test_is_structural_change(self):
        from system.scripts.hooks.enforcement import is_structural_change
        self.assertTrue(is_structural_change("spaces/myspace/SPACE.md"))
        self.assertTrue(is_structural_change(".claude/agents/myspace--backend--api.md"))
        self.assertTrue(is_structural_change(".claude/commands/new-cmd.md"))
        self.assertTrue(is_structural_change("system/memory/world.md"))

    def test_is_routine_write(self):
        from system.scripts.hooks.enforcement import is_routine_write
        self.assertTrue(is_routine_write("system/memory/bus.md"))
        self.assertTrue(is_routine_write("system/memory/handoff.md"))
        self.assertTrue(is_routine_write("CHANGELOG.md"))
        self.assertTrue(is_routine_write("README.md"))
        self.assertFalse(is_routine_write("spaces/myspace/SPACE.md"))

    def test_bus_md_not_structural(self):
        """bus.md is in STRUCTURAL patterns (world.md) but also in ROUTINE — routine wins."""
        from system.scripts.hooks.enforcement import is_routine_write
        self.assertTrue(is_routine_write("system/memory/bus.md"))

    def test_get_checklist_item(self):
        from system.scripts.hooks.enforcement import get_checklist_item
        self.assertEqual(get_checklist_item("CHANGELOG.md"), "changelog")
        self.assertEqual(get_checklist_item("system/memory/world.md"), "world_md")
        self.assertEqual(get_checklist_item("system/memory/bus.md"), "bus_md")
        self.assertIsNone(get_checklist_item("random/file.md"))

    def test_process_write_structural(self):
        from system.scripts.hooks.enforcement import process_write
        msgs = process_write("spaces/myspace/SPACE.md", {"file_path": "spaces/myspace/SPACE.md"})
        self.assertTrue(any("Structural change detected" in m for m in msgs))

    def test_process_write_reminds_changelog(self):
        """After structural change, subsequent non-checklist writes remind about CHANGELOG."""
        from system.scripts.hooks.enforcement import process_write
        # Trigger structural change
        process_write("spaces/myspace/SPACE.md", {"file_path": "spaces/myspace/SPACE.md"})
        # Next write should remind about CHANGELOG
        msgs = process_write(
            "spaces/myspace/areas/backend/AREA.md",
            {"file_path": "spaces/myspace/areas/backend/AREA.md"},
        )
        self.assertTrue(any("CHANGELOG.md" in m for m in msgs))

    def test_process_write_no_reminder_after_changelog_updated(self):
        """After CHANGELOG is updated, no more CHANGELOG reminders."""
        from system.scripts.hooks.enforcement import process_write
        # Trigger structural change
        process_write("spaces/myspace/SPACE.md", {"file_path": "spaces/myspace/SPACE.md"})
        # Update CHANGELOG
        process_write("CHANGELOG.md", {"file_path": "CHANGELOG.md"})
        # Next write should NOT mention CHANGELOG
        msgs = process_write(
            "spaces/myspace/areas/backend/AREA.md",
            {"file_path": "spaces/myspace/areas/backend/AREA.md"},
        )
        changelog_msgs = [m for m in msgs if "CHANGELOG.md has not been updated" in m]
        self.assertEqual(len(changelog_msgs), 0)

    def test_check_world_md_missing_section(self):
        from system.scripts.hooks.enforcement import check_world_md_content
        result = check_world_md_content({
            "file_path": "system/memory/world.md",
            "content": "# World State\nSome content without the required section.",
        })
        self.assertIsNotNone(result)
        self.assertIn("REMINDER", result)

    def test_check_world_md_with_section(self):
        from system.scripts.hooks.enforcement import check_world_md_content
        result = check_world_md_content({
            "file_path": "system/memory/world.md",
            "content": "# World State\n## Última Alteração\n- 2026-03-23",
        })
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
