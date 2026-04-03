#!/usr/bin/env python3
"""
AgentOS Sync Script
Detecta drift entre runtimes (.Codex/ e .gemini/) e o KERNEL.md.
Garante que ambos os runtimes estão sincronizados e atualizados.

Uso:
    python system/scripts/sync.py           # Modo relatório (read-only)
    python system/scripts/sync.py --fix     # Aplica correções automaticamente
    python system/scripts/sync.py --json    # Output em JSON (para hooks)
"""

import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


def get_root():
    """Retorna o diretório raiz do AgentOS."""
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent.parent


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class SyncIssue:
    """Representa uma inconsistência detectada."""
    category: str       # "agent", "command", "content", "missing"
    severity: str       # "error", "warning", "info"
    source: str         # arquivo fonte
    target: str         # arquivo que deveria existir/estar atualizado
    message: str        # descrição do problema
    fixable: bool       # se --fix pode resolver

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "severity": self.severity,
            "source": self.source,
            "target": self.target,
            "message": self.message,
            "fixable": self.fixable,
        }


@dataclass
class SyncReport:
    """Relatório completo de sync."""
    timestamp: str = ""
    issues: list = field(default_factory=list)
    fixed: list = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def add_issue(self, issue: SyncIssue):
        self.issues.append(issue)

    def add_fixed(self, description: str):
        self.fixed.append(description)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "issues": [i.to_dict() for i in self.issues],
            "fixed": self.fixed,
            "summary": self.summary,
        }


# ---------------------------------------------------------------------------
# Sync checks
# ---------------------------------------------------------------------------

def check_agent_sync(root: Path, report: SyncReport):
    """Verifica se .Codex/agents/ e .gemini/agents/ estão sincronizados."""
    codex_agents = root / ".Codex" / "agents"
    gemini_agents = root / ".gemini" / "agents"

    if not codex_agents.exists():
        report.add_issue(SyncIssue(
            category="missing", severity="error",
            source=".Codex/agents/", target="",
            message="Diretório .Codex/agents/ não existe",
            fixable=False,
        ))
        return

    codex_files = {f.name for f in codex_agents.glob("*.md")}
    gemini_files = {f.name for f in gemini_agents.glob("*.md")} if gemini_agents.exists() else set()

    # Agents em .Codex/ que não estão em .gemini/
    missing_in_gemini = codex_files - gemini_files
    for name in sorted(missing_in_gemini):
        report.add_issue(SyncIssue(
            category="agent", severity="error",
            source=f".Codex/agents/{name}", target=f".gemini/agents/{name}",
            message=f"Agent '{name}' existe em .Codex/ mas não em .gemini/",
            fixable=True,
        ))

    # Agents em .gemini/ que não estão em .Codex/ (orphans)
    orphans_in_gemini = gemini_files - codex_files
    for name in sorted(orphans_in_gemini):
        report.add_issue(SyncIssue(
            category="agent", severity="warning",
            source=f".gemini/agents/{name}", target="",
            message=f"Agent '{name}' existe em .gemini/ mas não em .Codex/ (órfão)",
            fixable=False,
        ))

    # Agents que existem em ambos — comparar conteúdo (ignorando campos Codex-específicos)
    common = codex_files & gemini_files
    for name in sorted(common):
        codex_content = (codex_agents / name).read_text(encoding="utf-8")
        gemini_content = (gemini_agents / name).read_text(encoding="utf-8")

        # Normalizar: remover model/color do Codex para comparação
        normalized_codex = re.sub(r"^model:.*\n", "", codex_content, flags=re.MULTILINE)
        normalized_codex = re.sub(r"^color:.*\n", "", normalized_codex, flags=re.MULTILINE)

        if normalized_codex.strip() != gemini_content.strip():
            report.add_issue(SyncIssue(
                category="content", severity="warning",
                source=f".Codex/agents/{name}", target=f".gemini/agents/{name}",
                message=f"Agent '{name}' tem conteúdo divergente entre runtimes",
                fixable=True,
            ))


def check_command_skill_sync(root: Path, report: SyncReport):
    """Verifica se .Codex/commands/ e .gemini/skills/ estão sincronizados."""
    codex_commands = root / ".Codex" / "commands"
    gemini_skills = root / ".gemini" / "skills"

    if not codex_commands.exists():
        report.add_issue(SyncIssue(
            category="missing", severity="error",
            source=".Codex/commands/", target="",
            message="Diretório .Codex/commands/ não existe",
            fixable=False,
        ))
        return

    command_names = {f.stem for f in codex_commands.glob("*.md")}
    skill_names = set()
    if gemini_skills.exists():
        for d in gemini_skills.iterdir():
            if d.is_dir() and (d / "SKILL.md").exists():
                skill_names.add(d.name)

    # Commands sem skill correspondente
    missing_skills = command_names - skill_names
    for name in sorted(missing_skills):
        report.add_issue(SyncIssue(
            category="command", severity="error",
            source=f".Codex/commands/{name}.md",
            target=f".gemini/skills/{name}/SKILL.md",
            message=f"Command '{name}' existe em .Codex/ mas não tem skill em .gemini/",
            fixable=True,
        ))

    # Skills órfãs (sem command correspondente)
    orphan_skills = skill_names - command_names
    # agent-bootstrap é uma skill legítima que não tem command
    orphan_skills -= {"agent-bootstrap"}
    for name in sorted(orphan_skills):
        report.add_issue(SyncIssue(
            category="command", severity="warning",
            source=f".gemini/skills/{name}/SKILL.md", target="",
            message=f"Skill '{name}' existe em .gemini/ mas não tem command em .Codex/",
            fixable=False,
        ))


def check_system_agent_completeness(root: Path, report: SyncReport):
    """Verifica se cada system agent tem definição em system/, .claude/ e .gemini/."""
    system_agents_dir = root / "system" / "agents"
    if not system_agents_dir.exists():
        return

    for agent_dir in sorted(system_agents_dir.iterdir()):
        if not agent_dir.is_dir():
            continue
        agent_name = agent_dir.name
        agent_md = agent_dir / "AGENT.md"

        if not agent_md.exists():
            continue  # Skip dirs without AGENT.md (not actual agents)

        # Check .Codex/agents/
        codex_file = root / ".Codex" / "agents" / f"{agent_name}.md"
        if not codex_file.exists():
            report.add_issue(SyncIssue(
                category="agent", severity="error",
                source=f"system/agents/{agent_name}/AGENT.md",
                target=f".Codex/agents/{agent_name}.md",
                message=f"System agent '{agent_name}' não tem loader em .Codex/agents/",
                fixable=False,
            ))

        # Check .gemini/agents/
        gemini_file = root / ".gemini" / "agents" / f"{agent_name}.md"
        if not gemini_file.exists():
            report.add_issue(SyncIssue(
                category="agent", severity="error",
                source=f"system/agents/{agent_name}/AGENT.md",
                target=f".gemini/agents/{agent_name}.md",
                message=f"System agent '{agent_name}' não tem loader em .gemini/agents/",
                fixable=True,
            ))


def check_kernel_references(root: Path, report: SyncReport):
    """Verifica se CODEX.md e GEMINI.md referenciam KERNEL.md corretamente."""
    codex_md = root / "CODEX.md"
    gemini_md = root / "GEMINI.md"

    if codex_md.exists():
        content = codex_md.read_text(encoding="utf-8")
        if "KERNEL.md" not in content:
            report.add_issue(SyncIssue(
                category="content", severity="error",
                source="CODEX.md", target="KERNEL.md",
                message="CODEX.md não referencia KERNEL.md",
                fixable=False,
            ))

    if gemini_md.exists():
        content = gemini_md.read_text(encoding="utf-8")
        if "KERNEL.md" not in content:
            report.add_issue(SyncIssue(
                category="content", severity="error",
                source="GEMINI.md", target="KERNEL.md",
                message="GEMINI.md não referencia KERNEL.md",
                fixable=False,
            ))


def check_version_consistency(root: Path, report: SyncReport):
    """Verifica se a versão é consistente entre world.md, README.md e CHANGELOG.md."""
    world_md = root / "system" / "memory" / "world.md"
    readme_md = root / "README.md"
    changelog_md = root / "CHANGELOG.md"

    versions = {}

    if world_md.exists():
        content = world_md.read_text(encoding="utf-8")
        match = re.search(r"\*\*Versão:\*\*\s*([\d.]+)", content)
        if match:
            versions["world.md"] = match.group(1)

    if readme_md.exists():
        content = readme_md.read_text(encoding="utf-8")
        match = re.search(r"\*\*v([\d.]+)\*\*", content)
        if match:
            versions["README.md"] = match.group(1)

    if changelog_md.exists():
        content = changelog_md.read_text(encoding="utf-8")
        match = re.search(r"## \[([\d.]+)\]", content)
        if match:
            versions["CHANGELOG.md"] = match.group(1)

    if len(set(versions.values())) > 1:
        version_str = ", ".join(f"{k}={v}" for k, v in versions.items())
        report.add_issue(SyncIssue(
            category="content", severity="warning",
            source="multi", target="multi",
            message=f"Versões inconsistentes: {version_str}",
            fixable=False,
        ))


# ---------------------------------------------------------------------------
# Fix operations
# ---------------------------------------------------------------------------

def fix_missing_gemini_agents(root: Path, report: SyncReport) -> int:
    """Sincroniza agents faltantes de .Codex/ para .gemini/."""
    codex_agents = root / ".Codex" / "agents"
    gemini_agents = root / ".gemini" / "agents"
    gemini_agents.mkdir(parents=True, exist_ok=True)

    fixed = 0
    for issue in report.issues:
        if issue.category == "agent" and issue.fixable and ".gemini/agents/" in issue.target:
            source_file = root / issue.source
            target_file = root / issue.target
            if source_file.exists() and not target_file.exists():
                content = source_file.read_text(encoding="utf-8")
                content = re.sub(r"^model:.*\n", "", content, flags=re.MULTILINE)
                content = re.sub(r"^color:.*\n", "", content, flags=re.MULTILINE)
                target_file.write_text(content, encoding="utf-8")
                report.add_fixed(f"Criado {issue.target} a partir de {issue.source}")
                fixed += 1
    return fixed


def fix_divergent_agents(root: Path, report: SyncReport) -> int:
    """Atualiza agents divergentes em .gemini/ a partir de .Codex/."""
    fixed = 0
    for issue in report.issues:
        if issue.category == "content" and issue.fixable and ".gemini/agents/" in issue.target:
            source_file = root / issue.source
            target_file = root / issue.target
            if source_file.exists():
                content = source_file.read_text(encoding="utf-8")
                content = re.sub(r"^model:.*\n", "", content, flags=re.MULTILINE)
                content = re.sub(r"^color:.*\n", "", content, flags=re.MULTILINE)
                target_file.write_text(content, encoding="utf-8")
                report.add_fixed(f"Atualizado {issue.target} com conteúdo de {issue.source}")
                fixed += 1
    return fixed


def fix_missing_gemini_skills(root: Path, report: SyncReport) -> int:
    """Sincroniza commands faltantes como skills em .gemini/."""
    # Reutiliza a lógica do setup.py
    parent = Path(__file__).resolve().parent
    sys.path.insert(0, str(parent))
    from setup import sync_gemini_skills

    fixed_before = len(report.fixed)
    synced = sync_gemini_skills(root)
    if synced > 0:
        report.add_fixed(f"Sincronizados {synced} commands como skills em .gemini/skills/")
    return synced


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_sync(root: Path, fix: bool = False, json_output: bool = False) -> SyncReport:
    """Executa todas as verificações de sync e opcionalmente aplica correções."""
    report = SyncReport(timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    # Run all checks
    check_agent_sync(root, report)
    check_command_skill_sync(root, report)
    check_system_agent_completeness(root, report)
    check_kernel_references(root, report)
    check_version_consistency(root, report)

    # Apply fixes if requested
    if fix:
        fix_missing_gemini_agents(root, report)
        fix_divergent_agents(root, report)
        fix_missing_gemini_skills(root, report)

    # Build summary
    errors = sum(1 for i in report.issues if i.severity == "error")
    warnings = sum(1 for i in report.issues if i.severity == "warning")
    infos = sum(1 for i in report.issues if i.severity == "info")
    fixable = sum(1 for i in report.issues if i.fixable)

    report.summary = {
        "total_issues": len(report.issues),
        "errors": errors,
        "warnings": warnings,
        "infos": infos,
        "fixable": fixable,
        "fixed": len(report.fixed),
        "status": "ok" if errors == 0 else "drift_detected",
    }

    return report


def print_report(report: SyncReport):
    """Imprime o relatório de sync formatado."""
    print("=" * 60)
    print("       AgentOS Sync Report")
    print(f"       {report.timestamp}")
    print("=" * 60)
    print()

    if not report.issues:
        print("  [OK] Todos os runtimes estão sincronizados!")
        print()
        return

    # Group by severity
    for severity, label, icon in [("error", "ERROS", "X"), ("warning", "AVISOS", "!"), ("info", "INFO", "i")]:
        issues = [i for i in report.issues if i.severity == severity]
        if not issues:
            continue
        print(f"  [{icon}] {label} ({len(issues)}):")
        for issue in issues:
            fixable_tag = " [fixable]" if issue.fixable else ""
            print(f"    - {issue.message}{fixable_tag}")
            if issue.source and issue.target:
                print(f"      {issue.source} -> {issue.target}")
        print()

    if report.fixed:
        print(f"  [FIX] Correções aplicadas ({len(report.fixed)}):")
        for fix_msg in report.fixed:
            print(f"    - {fix_msg}")
        print()

    s = report.summary
    status_label = "SINCRONIZADO" if s["status"] == "ok" else "DRIFT DETECTADO"
    print(f"  Resumo: {status_label}")
    print(f"    Erros: {s['errors']} | Avisos: {s['warnings']} | Corrigíveis: {s['fixable']} | Corrigidos: {s['fixed']}")
    print()

    if s["fixable"] > s["fixed"]:
        print(f"  Dica: Execute com --fix para corrigir {s['fixable'] - s['fixed']} problema(s) automaticamente.")
        print()


def main():
    root = get_root()
    fix = "--fix" in sys.argv
    json_output = "--json" in sys.argv

    report = run_sync(root, fix=fix, json_output=json_output)

    if json_output:
        print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
    else:
        print_report(report)

    # Exit code: 0 if ok, 1 if drift detected (unfixed errors)
    remaining_errors = report.summary["errors"] - report.summary["fixed"]
    sys.exit(0 if remaining_errors <= 0 else 1)


if __name__ == "__main__":
    main()
