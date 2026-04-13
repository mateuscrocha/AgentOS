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
- `empresa`
- `pessoal`

## Estatísticas

- Spaces: 3
- Areas: 7
- Agentes do usuário: 7
- Times: 0
- Skills do usuário: 27

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

## Contexto Operacional Vivo

O sistema agora formaliza uma camada de memória viva para o cotidiano no space `pessoal`:
- `spaces/pessoal/areas/dia/memory/agora.md` — snapshot do momento atual
- `spaces/pessoal/areas/dia/memory/inbox.md` — capturas rápidas ainda não triadas
- `spaces/pessoal/areas/dia/memory/follow-ups.md` — dependências externas ativas

Essa camada existe para reduzir dependência do histórico de conversa em assuntos operacionais recorrentes.

## Integrações Operacionais

- Google Calendar deve usar por padrão as credenciais `GOOGLE_CALENDAR_*` carregadas do `.env` raiz do projeto principal.
- O calendário principal da conta é o default operacional; calendários alternativos só entram quando o pedido explicitar esse destino.

## Última Alteração

- **Data:** 2026-04-09
- **O que mudou:** O sistema passou a formalizar que integrações com Google Calendar devem usar por padrão as credenciais `GOOGLE_CALENDAR_*` do `.env` raiz do projeto principal.
- **Agente:** kernel
