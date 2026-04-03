#!/usr/bin/env python3
"""
AgentOS Setup Script
Bootstrap inicial do sistema — cria estrutura, valida e inicializa memória.
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path


def get_root():
    """Retorna o diretório raiz do AgentOS."""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


def check_already_installed(root: Path) -> bool:
    """Verifica se o sistema já foi instalado."""
    world = root / "system" / "memory" / "world.md"
    return world.exists()


def create_directories(root: Path):
    """Cria toda a árvore de diretórios do AgentOS."""
    dirs = [
        # .Codex (Codex runtime)
        ".Codex/agents",
        ".Codex/commands",
        ".Codex/skills/agent-bootstrap",
        # .claude (legacy runtime compatibility)
        ".claude/agents",
        ".claude/commands",
        ".claude/skills/agent-bootstrap",
        # .gemini (Gemini CLI runtime)
        ".gemini/agents",
        ".gemini/skills",
        # system
        "system/agents/agent-manager/memory",
        "system/agents/agent-manager/skills/create-agent",
        "system/agents/agent-manager/skills/create-space",
        "system/agents/agent-manager/skills/create-area",
        "system/agents/agent-manager/skills/evolve-agent",
        "system/agents/skill-manager/memory",
        "system/agents/skill-manager/skills/validate-skill",
        "system/agents/memory-manager/memory",
        "system/agents/memory-manager/skills/init-memory",
        "system/agents/memory-manager/skills/cleanup-memory",
        "system/agents/team-manager/memory",
        "system/agents/team-manager/skills/create-team",
        "system/agents/team-manager/skills/manage-members",
        "system/agents/doc-manager/memory",
        "system/agents/doc-manager/skills/generate-docs",
        "system/agents/doc-manager/skills/generate-readme",
        "system/agents/doc-manager/skills/audit-docs",
        "system/agents/health-monitor/memory",
        "system/agents/health-monitor/skills/check-health",
        "system/agents/health-monitor/skills/check-handoffs",
        "system/agents/health-monitor/skills/generate-report",
        "system/agents/task-runner/memory",
        "system/agents/task-runner/skills/run-workflow",
        "system/agents/task-runner/skills/create-workflow",
        "system/agents/task-runner/skills/resume-workflow",
        "system/agents/workflow-planner/memory",
        "system/agents/workflow-planner/skills/plan-action",
        "system/agents/workflow-planner/skills/estimate-impact",
        "system/memory",
        "system/protocols",
        "system/templates/agent",
        "system/templates/space",
        "system/templates/area",
        "system/templates/team",
        "system/templates/skill",
        "system/templates/guidelines",
        "system/scripts",
        "system/skills/skill-creator",
        "system/skills/brand-guidelines",
        "system/skills/canvas-design",
        "system/skills/doc-coauthoring",
        "system/skills/docx",
        "system/skills/pptx",
        "system/skills/xlsx",
        "system/skills/pdf",
        "system/skills/frontend-design",
        "system/skills/theme-factory",
        "system/skills/web-artifacts-builder",
        "system/skills/mcp-builder",
        # system agents — skills Anthropic
        "system/agents/brand-guidelines/memory",
        "system/agents/canvas-design/memory",
        "system/agents/doc-coauthoring/memory",
        "system/agents/docx-manager/memory",
        "system/agents/pptx-manager/memory",
        "system/agents/xlsx-manager/memory",
        "system/agents/pdf-manager/memory",
        "system/agents/frontend-design/memory",
        "system/agents/theme-factory/memory",
        "system/agents/web-artifacts-builder/memory",
        "system/agents/mcp-builder/memory",
        "system/workflows",
        # spaces
        "spaces",
    ]

    created = []
    for d in dirs:
        path = root / d
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            created.append(d)

    return created


def validate_structure(root: Path) -> list[str]:
    """Valida que todos os arquivos críticos existem."""
    critical_files = [
        "CODEX.md",
        "CLAUDE.md",
        "KERNEL.md",
        "GEMINI.md",
        ".Codex/settings.json",
        ".claude/settings.json",
        ".gemini/settings.json",
        "system/memory/world.md",
        "system/memory/handoff.md",
        "system/memory/bus.md",
        "system/protocols/communication.md",
        "system/protocols/handoff.md",
        "system/protocols/memory.md",
        "system/protocols/maintenance.md",
        "system/templates/agent/AGENT.md.template",
        "system/templates/space/SPACE.md.template",
        "system/templates/area/AREA.md.template",
        "system/templates/team/TEAM.md.template",
        "system/templates/skill/SKILL.md.template",
        "system/templates/guidelines/GUIDELINES.md.template",
    ]

    missing = []
    for f in critical_files:
        if not (root / f).exists():
            missing.append(f)

    return missing


def validate_system_agents(root: Path) -> list[str]:
    """Valida que os agentes do sistema existem."""
    agents = [
        "agent-manager",
        "skill-manager",
        "memory-manager",
        "team-manager",
        "doc-manager",
        "health-monitor",
        "task-runner",
        "workflow-planner",
        "brand-guidelines",
        "canvas-design",
        "doc-coauthoring",
        "docx-manager",
        "pptx-manager",
        "xlsx-manager",
        "pdf-manager",
        "frontend-design",
        "theme-factory",
        "web-artifacts-builder",
        "mcp-builder",
    ]
    missing = []

    for agent in agents:
        agent_md = root / "system" / "agents" / agent / "AGENT.md"
        codex_agent = root / ".Codex" / "agents" / f"{agent}.md"
        gemini_agent = root / ".gemini" / "agents" / f"{agent}.md"

        if not agent_md.exists():
            missing.append(f"system/agents/{agent}/AGENT.md")
        if not codex_agent.exists():
            missing.append(f".Codex/agents/{agent}.md")
        if not gemini_agent.exists():
            missing.append(f".gemini/agents/{agent}.md")

    return missing


def sync_gemini_agents(root: Path) -> int:
    """Sincroniza .gemini/agents/ a partir de .Codex/agents/.
    Para cada agent em .Codex/agents/ que não existe em .gemini/agents/,
    gera o equivalente removendo campos Claude-específicos do frontmatter.
    """
    codex_agents = root / ".Codex" / "agents"
    gemini_agents = root / ".gemini" / "agents"
    gemini_agents.mkdir(parents=True, exist_ok=True)

    synced = 0
    if not codex_agents.exists():
        return synced

    for codex_file in codex_agents.glob("*.md"):
        gemini_file = gemini_agents / codex_file.name
        if gemini_file.exists():
            continue

        content = codex_file.read_text(encoding="utf-8")

        # Remove model e color do frontmatter (campos Claude Code-específicos)
        content = re.sub(r"^model:.*\n", "", content, flags=re.MULTILINE)
        content = re.sub(r"^color:.*\n", "", content, flags=re.MULTILINE)

        gemini_file.write_text(content, encoding="utf-8")
        synced += 1

    return synced


def sync_gemini_skills(root: Path) -> int:
    """Sincroniza .gemini/skills/ a partir de .Codex/commands/.
    Para cada command em .Codex/commands/ que não existe em .gemini/skills/,
    gera o equivalente adaptando frontmatter e invocações.
    """
    codex_commands = root / ".Codex" / "commands"
    gemini_skills = root / ".gemini" / "skills"
    gemini_skills.mkdir(parents=True, exist_ok=True)

    synced = 0
    if not codex_commands.exists():
        return synced

    for cmd_file in codex_commands.glob("*.md"):
        skill_name = cmd_file.stem
        skill_dir = gemini_skills / skill_name
        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists():
            continue

        content = cmd_file.read_text(encoding="utf-8")

        # Adaptar frontmatter: manter só name e description
        # Extrair description do frontmatter original
        desc_match = re.search(r"^description:\s*(.+)$", content, re.MULTILINE)
        description = desc_match.group(1).strip() if desc_match else skill_name

        # Extrair corpo (tudo após o frontmatter ---)
        parts = content.split("---", 2)
        body = parts[2].strip() if len(parts) >= 3 else content

        # Substituir invocações Claude Code por Gemini CLI
        body = re.sub(
            r"Invoque `(\w[\w-]*)` via Agent tool",
            r"Invoque `@\1`",
            body,
        )
        body = body.replace("via Agent tool", "via @subagent")
        # Adaptar referências de .claude/ para incluir .gemini/
        body = body.replace(
            "registrado em `.claude/agents/",
            "registrado em `.claude/agents/` e `.gemini/agents/"
        )

        # Gerar novo conteúdo no formato Gemini skill
        new_content = f"---\nname: {skill_name}\ndescription: {description}\n---\n\n{body}\n"

        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_file.write_text(new_content, encoding="utf-8")
        synced += 1

    return synced


def main():
    root = get_root()
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    print("=" * 50)
    print("       AgentOS Setup v0.7.0")
    print("=" * 50)
    print()

    # Check if already installed
    if check_already_installed(root):
        print("[INFO] AgentOS já está instalado.")
        print(f"[INFO] Diretório: {root}")

        # Sync Gemini runtime (garante paridade com .Codex/)
        agents_synced = sync_gemini_agents(root)
        skills_synced = sync_gemini_skills(root)
        if agents_synced or skills_synced:
            print(f"[SYNC] Gemini runtime sincronizado: {agents_synced} agents, {skills_synced} skills")

        # Run validation
        missing_files = validate_structure(root)
        missing_agents = validate_system_agents(root)

        if missing_files or missing_agents:
            print()
            print("[WARN] Alguns arquivos estão faltando:")
            for f in missing_files + missing_agents:
                print(f"  - {f}")
            print()
            print("[INFO] Execute o setup novamente para reparar.")
        else:
            print("[OK] Todos os arquivos críticos estão presentes.")

        return

    # Create directories
    print("[1/4] Criando estrutura de diretórios...")
    created = create_directories(root)
    print(f"  -> {len(created)} diretórios criados")

    # Validate structure
    print("[2/4] Validando arquivos do sistema...")
    missing_files = validate_structure(root)
    if missing_files:
        print(f"  [WARN] {len(missing_files)} arquivos críticos faltando:")
        for f in missing_files:
            print(f"    - {f}")
    else:
        print("  -> Todos os arquivos críticos presentes")

    # Validate system agents
    print("[3/4] Validando agentes do sistema...")
    missing_agents = validate_system_agents(root)
    if missing_agents:
        print(f"  [WARN] {len(missing_agents)} definições de agentes faltando:")
        for f in missing_agents:
            print(f"    - {f}")
    else:
        print("  -> Todos os agentes do sistema presentes")

    # Sync Gemini runtime
    print("[4/5] Sincronizando runtime Gemini CLI a partir do runtime Codex...")
    agents_synced = sync_gemini_agents(root)
    skills_synced = sync_gemini_skills(root)
    print(f"  -> {agents_synced} agents, {skills_synced} skills sincronizados")

    # Summary
    print("[5/5] Resumo da instalação...")
    print()
    print("=" * 50)
    print("  AgentOS instalado com sucesso!")
    print("=" * 50)
    print()
    print("Agentes do sistema (19):")
    print()
    print("  Core:")
    print("  - agent-manager        (gerencia agentes, spaces e areas)")
    print("  - skill-manager        (gerencia skills)")
    print("  - memory-manager       (gerencia memória)")
    print("  - team-manager         (gerencia times)")
    print("  - doc-manager          (gerencia documentação)")
    print("  - health-monitor       (diagnóstico de integridade)")
    print("  - task-runner          (orquestra workflows)")
    print("  - workflow-planner     (planeja execuções)")
    print()
    print("  Skills Anthropic:")
    print("  - brand-guidelines     (identidade visual Anthropic)")
    print("  - canvas-design        (arte visual em PDF/PNG)")
    print("  - doc-coauthoring      (workflow colaborativo de documentos)")
    print("  - docx-manager         (documentos Word .docx)")
    print("  - pptx-manager         (apresentações PowerPoint .pptx)")
    print("  - xlsx-manager         (planilhas Excel .xlsx)")
    print("  - pdf-manager          (processamento de PDFs)")
    print("  - frontend-design      (interfaces frontend production-grade)")
    print("  - theme-factory        (toolkit de temas profissionais)")
    print("  - web-artifacts-builder (artefatos web React/TS)")
    print("  - mcp-builder          (construção de servidores MCP)")
    print()
    print("Comandos disponíveis:")
    print("  /new-space <nome>                  Criar space")
    print("  /new-area <space> <nome>           Criar area")
    print("  /new-agent <space> <area> <nome>   Criar agente")
    print("  /new-team <space> <area> <nome>    Criar time")
    print("  /new-skill <space/area/agent> <n>  Criar skill")
    print("  /status                            Ver estado do sistema")
    print("  /health                            Diagnóstico de integridade")
    print("  /plan <descrição>                  Planejar execução")
    print("  /run <workflow>                    Executar workflow")
    print()
    print("  /brand-guidelines                  Identidade visual Anthropic")
    print("  /canvas-design                     Arte visual em PDF/PNG")
    print("  /doc-coauthoring                   Criação colaborativa de documentos")
    print("  /docx                              Documentos Word")
    print("  /pptx                              Apresentações PowerPoint")
    print("  /xlsx                              Planilhas Excel")
    print("  /pdf                               Processamento de PDFs")
    print("  /frontend-design                   Interfaces frontend")
    print("  /theme-factory                     Temas profissionais")
    print("  /web-artifacts                     Artefatos web React/TS")
    print("  /mcp-builder                       Servidores MCP")
    print()
    print("Sistema de Guidelines:")
    print("  Cada space, area e time criado terá um diretório guidelines/")
    print("  para documentação de processos, playbooks e padrões.")
    print("  Guidelines são herdados em cascata: space → area → time.")
    print()
    print(f"Próximo passo: /new-space <nome-do-seu-space>")


if __name__ == "__main__":
    main()
