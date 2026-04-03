#!/usr/bin/env python3
"""
AgentOS Registry Generator
Gera registries automaticamente a partir do filesystem, eliminando drift manual.

Uso: py -3 system/scripts/generate-registries.py [--dry-run]
"""

import sys
from datetime import datetime
from pathlib import Path


def get_root():
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def read_frontmatter(filepath: Path) -> dict:
    """Extrai campos do frontmatter YAML de um arquivo .md."""
    meta = {}
    if not filepath.exists():
        return meta
    content = filepath.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return meta
    parts = content.split("---", 2)
    if len(parts) < 3:
        return meta
    for line in parts[1].strip().split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta


def discover_agents(root: Path) -> list[dict]:
    """Descobre todos os agentes do sistema e do usuário."""
    agents = []

    # System agents
    sys_agents_dir = root / "system" / "agents"
    if sys_agents_dir.exists():
        for agent_dir in sorted(sys_agents_dir.iterdir()):
            agent_md = agent_dir / "AGENT.md"
            if agent_md.exists():
                meta = read_frontmatter(agent_md)
                agents.append({
                    "name": meta.get("name", agent_dir.name),
                    "scope": "system",
                    "path": f"system/agents/{agent_dir.name}/AGENT.md",
                    "description": meta.get("description", ""),
                    "status": "Ativo",
                })

    # User agents (spaces)
    spaces_dir = root / "spaces"
    if spaces_dir.exists():
        for space_dir in sorted(spaces_dir.iterdir()):
            if not space_dir.is_dir():
                continue
            areas_dir = space_dir / "areas"
            if not areas_dir.exists():
                continue
            for area_dir in sorted(areas_dir.iterdir()):
                if not area_dir.is_dir():
                    continue
                # Area-level agents
                agents_dir = area_dir / "agents"
                if agents_dir.exists():
                    for ag_dir in sorted(agents_dir.iterdir()):
                        ag_md = ag_dir / "AGENT.md"
                        if ag_md.exists():
                            meta = read_frontmatter(ag_md)
                            agents.append({
                                "name": meta.get("name", ag_dir.name),
                                "scope": f"{space_dir.name}/{area_dir.name}",
                                "path": f"spaces/{space_dir.name}/areas/{area_dir.name}/agents/{ag_dir.name}/AGENT.md",
                                "description": meta.get("description", ""),
                                "status": "Ativo",
                            })
                # Team-level agents
                teams_dir = area_dir / "teams"
                if teams_dir.exists():
                    for team_dir in sorted(teams_dir.iterdir()):
                        if not team_dir.is_dir():
                            continue
                        team_agents = team_dir / "agents"
                        if team_agents.exists():
                            for ag_dir in sorted(team_agents.iterdir()):
                                ag_md = ag_dir / "AGENT.md"
                                if ag_md.exists():
                                    meta = read_frontmatter(ag_md)
                                    agents.append({
                                        "name": meta.get("name", ag_dir.name),
                                        "scope": f"{space_dir.name}/{area_dir.name}/{team_dir.name}",
                                        "path": f"spaces/{space_dir.name}/areas/{area_dir.name}/teams/{team_dir.name}/agents/{ag_dir.name}/AGENT.md",
                                        "description": meta.get("description", ""),
                                        "status": "Ativo",
                                    })
    return agents


def discover_skills(root: Path) -> list[dict]:
    """Descobre todas as skills do sistema e do usuário."""
    skills = []

    # Global skills
    global_skills = root / "system" / "skills"
    if global_skills.exists():
        for skill_dir in sorted(global_skills.iterdir()):
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                meta = read_frontmatter(skill_md)
                skills.append({
                    "name": meta.get("name", skill_dir.name),
                    "agent": "global",
                    "scope": "system",
                    "path": f"system/skills/{skill_dir.name}/SKILL.md",
                    "description": meta.get("description", ""),
                })

    # System agent skills
    sys_agents_dir = root / "system" / "agents"
    if sys_agents_dir.exists():
        for agent_dir in sorted(sys_agents_dir.iterdir()):
            skills_dir = agent_dir / "skills"
            if not skills_dir.exists():
                continue
            for skill_dir in sorted(skills_dir.iterdir()):
                skill_md = skill_dir / "SKILL.md"
                if skill_md.exists():
                    meta = read_frontmatter(skill_md)
                    skills.append({
                        "name": meta.get("name", skill_dir.name),
                        "agent": agent_dir.name,
                        "scope": "system",
                        "path": f"system/agents/{agent_dir.name}/skills/{skill_dir.name}/SKILL.md",
                        "description": meta.get("description", ""),
                    })

    # User agent skills (walk spaces)
    spaces_dir = root / "spaces"
    if spaces_dir.exists():
        for skill_md in sorted(spaces_dir.rglob("skills/*/SKILL.md")):
            meta = read_frontmatter(skill_md)
            rel = skill_md.relative_to(root).as_posix()
            skills.append({
                "name": meta.get("name", skill_md.parent.name),
                "agent": meta.get("agent", "unknown"),
                "scope": "user",
                "path": rel,
                "description": meta.get("description", ""),
            })

    return skills


def discover_teams(root: Path) -> list[dict]:
    """Descobre todos os times."""
    teams = []
    spaces_dir = root / "spaces"
    if not spaces_dir.exists():
        return teams
    for team_md in sorted(spaces_dir.rglob("teams/*/TEAM.md")):
        meta = read_frontmatter(team_md)
        rel = team_md.relative_to(root).as_posix()
        teams.append({
            "name": meta.get("name", team_md.parent.name),
            "space": meta.get("space", ""),
            "area": meta.get("area", ""),
            "path": rel,
            "members": meta.get("members", "[]"),
        })
    return teams


def discover_memory(root: Path) -> list[dict]:
    """Descobre todos os arquivos de memória."""
    memory_files = []
    for md_file in sorted(root.rglob("memory/*.md")):
        rel = md_file.relative_to(root).as_posix()
        # Skip non-memory directories
        if not any(p in rel for p in ["system/memory/", "system/agents/", "spaces/"]):
            continue
        memory_files.append({
            "path": rel,
            "size": md_file.stat().st_size,
        })
    return memory_files


def generate_agent_registry(agents: list[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Registro de Agentes — AgentOS",
        "",
        f"> Gerado automaticamente em {now} por `generate-registries.py`",
        "",
        "## Agentes do Sistema",
        "",
        "| Agente | Descrição | Status |",
        "|---|---|---|",
    ]
    for a in agents:
        if a["scope"] == "system":
            lines.append(f"| {a['name']} | {a['description']} | {a['status']} |")

    lines.extend(["", "## Agentes do Usuário", "", "| Agente | Escopo | Descrição | Status |", "|---|---|---|---|"])
    user_agents = [a for a in agents if a["scope"] != "system"]
    if user_agents:
        for a in user_agents:
            lines.append(f"| {a['name']} | {a['scope']} | {a['description']} | {a['status']} |")
    else:
        lines.append("| — | — | — | — |")

    return "\n".join(lines) + "\n"


def generate_skill_registry(skills: list[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Registro de Skills — AgentOS",
        "",
        f"> Gerado automaticamente em {now} por `generate-registries.py`",
        "",
        "## Skills do Sistema",
        "",
        "| Skill | Agente | Descrição |",
        "|---|---|---|",
    ]
    for s in skills:
        if s["scope"] == "system":
            lines.append(f"| {s['name']} | {s['agent']} | {s['description']} |")

    lines.extend(["", "## Skills do Usuário", "", "| Skill | Agente | Descrição |", "|---|---|---|"])
    user_skills = [s for s in skills if s["scope"] == "user"]
    if user_skills:
        for s in user_skills:
            lines.append(f"| {s['name']} | {s['agent']} | {s['description']} |")
    else:
        lines.append("| — | — | — |")

    return "\n".join(lines) + "\n"


def generate_team_registry(teams: list[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Registro de Times — AgentOS",
        "",
        f"> Gerado automaticamente em {now} por `generate-registries.py`",
        "",
        "| Time | Space | Area | Membros |",
        "|---|---|---|---|",
    ]
    if teams:
        for t in teams:
            lines.append(f"| {t['name']} | {t['space']} | {t['area']} | {t['members']} |")
    else:
        lines.append("| — | — | — | — |")

    return "\n".join(lines) + "\n"


def generate_memory_map(memory_files: list[dict]) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Mapa de Memória — AgentOS",
        "",
        f"> Gerado automaticamente em {now} por `generate-registries.py`",
        "",
        "| Arquivo | Tamanho |",
        "|---|---|",
    ]
    for m in memory_files:
        size_str = f"{m['size']} bytes"
        lines.append(f"| `{m['path']}` | {size_str} |")

    return "\n".join(lines) + "\n"


def main():
    root = get_root()
    dry_run = "--dry-run" in sys.argv

    print("AgentOS Registry Generator")
    print("=" * 40)

    # Discover
    agents = discover_agents(root)
    skills = discover_skills(root)
    teams = discover_teams(root)
    memory_files = discover_memory(root)

    print(f"  Agentes encontrados: {len(agents)}")
    print(f"  Skills encontradas: {len(skills)}")
    print(f"  Times encontrados: {len(teams)}")
    print(f"  Arquivos de memória: {len(memory_files)}")

    # Generate
    registries = {
        root / "system" / "agents" / "agent-manager" / "memory" / "registry.md": generate_agent_registry(agents),
        root / "system" / "agents" / "skill-manager" / "memory" / "skill-registry.md": generate_skill_registry(skills),
        root / "system" / "agents" / "team-manager" / "memory" / "team-registry.md": generate_team_registry(teams),
        root / "system" / "agents" / "memory-manager" / "memory" / "memory-map.md": generate_memory_map(memory_files),
    }

    if dry_run:
        print("\n[DRY RUN] Registries que seriam gerados:")
        for path, content in registries.items():
            rel = path.relative_to(root)
            print(f"\n--- {rel} ---")
            print(content[:200] + "..." if len(content) > 200 else content)
    else:
        for path, content in registries.items():
            path.write_text(content, encoding="utf-8")
            rel = path.relative_to(root)
            print(f"  [OK] {rel}")

    print("\nConcluído.")


if __name__ == "__main__":
    main()
