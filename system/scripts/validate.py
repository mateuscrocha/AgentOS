#!/usr/bin/env python3
"""
AgentOS Validate Script
Valida a integridade da estrutura do AgentOS.
"""

import sys
from pathlib import Path


def get_root():
    """Retorna o diretório raiz do AgentOS."""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def validate_directories(root: Path) -> list[str]:
    """Valida que todos os diretórios essenciais existem."""
    required_dirs = [
        ".Codex/agents",
        ".Codex/commands",
        ".Codex/skills",
        ".claude/agents",
        ".claude/commands",
        ".claude/skills",
        ".gemini/agents",
        ".gemini/skills",
        "system/agents/agent-manager/memory",
        "system/agents/agent-manager/skills",
        "system/agents/skill-manager/memory",
        "system/agents/skill-manager/skills",
        "system/agents/memory-manager/memory",
        "system/agents/memory-manager/skills",
        "system/agents/team-manager/memory",
        "system/agents/team-manager/skills",
        "system/memory",
        "system/protocols",
        "system/templates",
        "system/scripts",
        "spaces",
    ]

    missing = []
    for d in required_dirs:
        if not (root / d).is_dir():
            missing.append(d)
    return missing


def validate_files(root: Path) -> list[str]:
    """Valida que todos os arquivos críticos existem."""
    required_files = [
        "CODEX.md",
        "CLAUDE.md",
        "KERNEL.md",
        "GEMINI.md",
        ".Codex/settings.json",
        ".claude/settings.json",
        ".gemini/settings.json",
        # System memory
        "system/memory/world.md",
        "system/memory/handoff.md",
        "system/memory/bus.md",
        # Protocols
        "system/protocols/communication.md",
        "system/protocols/handoff.md",
        "system/protocols/memory.md",
        # Templates
        "system/templates/agent/AGENT.md.template",
        "system/templates/space/SPACE.md.template",
        "system/templates/area/AREA.md.template",
        "system/templates/team/TEAM.md.template",
        "system/templates/skill/SKILL.md.template",
        # Agent Manager
        "system/agents/agent-manager/AGENT.md",
        "system/agents/agent-manager/memory/registry.md",
        "system/agents/agent-manager/memory/standards.md",
        "system/agents/agent-manager/memory/history.md",
        "system/agents/agent-manager/skills/create-agent/SKILL.md",
        "system/agents/agent-manager/skills/create-space/SKILL.md",
        "system/agents/agent-manager/skills/create-area/SKILL.md",
        "system/agents/agent-manager/skills/evolve-agent/SKILL.md",
        ".Codex/agents/agent-manager.md",
        ".gemini/agents/agent-manager.md",
        # Skill Manager
        "system/agents/skill-manager/AGENT.md",
        "system/agents/skill-manager/memory/skill-registry.md",
        "system/agents/skill-manager/memory/history.md",
        "system/agents/skill-manager/skills/validate-skill/SKILL.md",
        ".Codex/agents/skill-manager.md",
        ".gemini/agents/skill-manager.md",
        # Skill Creator (global)
        "system/skills/skill-creator/SKILL.md",
        # Memory Manager
        "system/agents/memory-manager/AGENT.md",
        "system/agents/memory-manager/memory/memory-map.md",
        "system/agents/memory-manager/memory/history.md",
        "system/agents/memory-manager/skills/init-memory/SKILL.md",
        "system/agents/memory-manager/skills/cleanup-memory/SKILL.md",
        ".Codex/agents/memory-manager.md",
        ".gemini/agents/memory-manager.md",
        # Team Manager
        "system/agents/team-manager/AGENT.md",
        "system/agents/team-manager/memory/team-registry.md",
        "system/agents/team-manager/memory/history.md",
        "system/agents/team-manager/skills/create-team/SKILL.md",
        "system/agents/team-manager/skills/manage-members/SKILL.md",
        ".Codex/agents/team-manager.md",
        ".gemini/agents/team-manager.md",
        # Commands
        ".Codex/commands/setup.md",
        ".Codex/commands/new-agent.md",
        ".Codex/commands/new-area.md",
        ".Codex/commands/new-team.md",
        ".Codex/commands/new-skill.md",
        ".Codex/commands/new-space.md",
        ".Codex/commands/status.md",
        ".Codex/commands/handoff.md",
    ]

    missing = []
    for f in required_files:
        if not (root / f).is_file():
            missing.append(f)
    return missing


def count_resources(root: Path) -> dict:
    """Conta recursos do sistema."""
    stats = {
        "system_agents": 0,
        "user_agents": 0,
        "spaces": 0,
        "areas": 0,
        "teams": 0,
        "system_skills": 0,
        "user_skills": 0,
        "commands": 0,
    }

    # System agents
    system_agents = root / "system" / "agents"
    if system_agents.exists():
        stats["system_agents"] = len([d for d in system_agents.iterdir() if d.is_dir()])

    # Commands
    commands = root / ".Codex" / "commands"
    if commands.exists():
        stats["commands"] = len([f for f in commands.iterdir() if f.suffix == ".md"])

    # System skills
    for agent_dir in (root / "system" / "agents").iterdir():
        skills_dir = agent_dir / "skills"
        if skills_dir.exists():
            stats["system_skills"] += len([d for d in skills_dir.iterdir() if d.is_dir()])

    # Spaces and user resources
    spaces_dir = root / "spaces"
    if spaces_dir.exists():
        for space_dir in spaces_dir.iterdir():
            if not space_dir.is_dir():
                continue

            stats["spaces"] += 1
            areas_dir = space_dir / "areas"
            if not areas_dir.exists():
                continue

            for area_dir in areas_dir.iterdir():
                if not area_dir.is_dir():
                    continue

                stats["areas"] += 1

                agents_dir = area_dir / "agents"
                if agents_dir.exists():
                    stats["user_agents"] += len([d for d in agents_dir.iterdir() if d.is_dir()])

                teams_dir = area_dir / "teams"
                if teams_dir.exists():
                    team_dirs = [d for d in teams_dir.iterdir() if d.is_dir()]
                    stats["teams"] += len(team_dirs)
                    for team_dir in team_dirs:
                        team_agents_dir = team_dir / "agents"
                        if team_agents_dir.exists():
                            stats["user_agents"] += len([d for d in team_agents_dir.iterdir() if d.is_dir()])

    return stats


def main():
    root = get_root()

    print("=" * 50)
    print("    AgentOS Validation Report")
    print("=" * 50)
    print()

    # Validate directories
    missing_dirs = validate_directories(root)
    if missing_dirs:
        print(f"[FAIL] {len(missing_dirs)} diretórios faltando:")
        for d in missing_dirs:
            print(f"  - {d}")
    else:
        print("[OK] Todos os diretórios essenciais presentes")

    # Validate files
    missing_files = validate_files(root)
    if missing_files:
        print(f"[FAIL] {len(missing_files)} arquivos faltando:")
        for f in missing_files:
            print(f"  - {f}")
    else:
        print("[OK] Todos os arquivos críticos presentes")

    # Count resources
    stats = count_resources(root)
    print()
    print("Recursos:")
    print(f"  Agentes do sistema: {stats['system_agents']}")
    print(f"  Skills do sistema:  {stats['system_skills']}")
    print(f"  Commands:           {stats['commands']}")
    print(f"  Spaces:             {stats['spaces']}")
    print(f"  Areas:              {stats['areas']}")
    print(f"  Agentes do usuário: {stats['user_agents']}")
    print(f"  Times:              {stats['teams']}")

    # Overall result
    print()
    if missing_dirs or missing_files:
        print(f"[RESULTADO] FALHAS ENCONTRADAS — {len(missing_dirs)} dirs + {len(missing_files)} files")
        sys.exit(1)
    else:
        print("[RESULTADO] Sistema íntegro — todas as validações passaram")
        sys.exit(0)


if __name__ == "__main__":
    main()
