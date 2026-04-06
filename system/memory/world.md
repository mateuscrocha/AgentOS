# AgentOS — Estado Global

## Sistema

- **Versão:** 0.9.0
- **Instalado em:** 2026-03-20
- **Status:** Ativo

## Agentes do Sistema

| Agente | Status |
|---|---|
| agent-manager | Ativo |
| skill-manager | Ativo |
| memory-manager | Ativo |
| team-manager | Ativo |
| doc-manager | Ativo |
| health-monitor | Ativo |
| task-runner | Ativo |
| workflow-planner | Ativo |
| brand-guidelines | Ativo |
| canvas-design | Ativo |
| doc-coauthoring | Ativo |
| docx-manager | Ativo |
| pptx-manager | Ativo |
| xlsx-manager | Ativo |
| pdf-manager | Ativo |
| frontend-design | Ativo |
| theme-factory | Ativo |
| web-artifacts-builder | Ativo |
| mcp-builder | Ativo |

## Spaces

- `boris`
- `pessoal`

## Estatísticas

- Spaces: 2
- Areas: 6
- Agentes do usuário: 6
- Times: 0
- Skills do usuário: 24

## Hooks

O sistema agora possui hooks de enforcement em `.Codex/settings.json`:
- **PreToolUse** — Bloqueia writes em arquivos protegidos (protocols, scripts, AGENT.md, settings, secrets)
- **PostToolUse** — Rastreia mudanças estruturais e checklist de manutenção
- **Stop** — Valida checklist ao final da sessão

Scripts em `system/scripts/hooks/` (10 arquivos, 62 testes).

## Sync de Runtimes

O sistema possui protocolo de sincronização entre runtimes (`.Codex/` → `.gemini/`):
- **Protocolo:** `system/protocols/sync.md`
- **Script:** `system/scripts/sync.py` (modos: relatório, --fix, --json)
- **Hooks:** PostToolUse detecta mudanças em KERNEL.md, agents e commands e avisa sobre sync pendente
- **Direção:** Unidirecional — `.Codex/` é source of truth, `.gemini/` é derivado

## Última Alteração

- **Data:** 2026-04-06
- **O que mudou:** Criação do agente `day-manager` no space `pessoal/dia`, com loaders em `.Codex/agents/` e `.gemini/agents/` para gestão do dia a dia.
- **Agente:** kernel
