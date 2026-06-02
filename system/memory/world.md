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
- Areas: 9
- Agentes do usuário: 12
- Times: 0
- Skills do usuário: 31

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

## Gestão Financeira Doméstica

O space `pessoal` agora também formaliza uma frente simples de finanças da casa:
- `spaces/pessoal/areas/financas/agents/household-finance-manager/` — agente para consolidar extratos, contas previstas, dívidas e runway
- `spaces/pessoal/areas/financas/memory/resumo-atual.md` — snapshot financeiro corrente
- `spaces/pessoal/areas/financas/memory/contas-previstas.md` — compromissos e vencimentos futuros
- `spaces/pessoal/areas/financas/memory/dividas.md` — pendências e parcelamentos visíveis

## Integrações Operacionais

- Google Calendar deve usar por padrão as credenciais `GOOGLE_CALENDAR_*` carregadas do `.env` raiz do projeto principal.
- O calendário principal da conta é o default operacional; calendários alternativos só entram quando o pedido explicitar esse destino.
- O space `empresa/infra` agora concentra operação segura de cPanel com token em Keychain do macOS e fallback por interface web quando necessário.

## Frentes Editoriais Oficiais

- `boris/conteudo/youtube-live-producer` formaliza a produção de séries ao vivo no YouTube com convidados da comunidade Automate, incluindo pauta, pacote de publicação e operação de transmissão.

## Camadas de Inteligência do Boris

- `boris/produto/customer-intelligence-manager` formaliza a consolidação de reuniões, pesquisas e insights do cliente em memória acionável para decisões técnicas e estratégicas.
- `spaces/boris/projects/customer-intelligence-dashboard/` passa a ser o projeto standalone inicial de visualização dessa camada em formato de dashboard próprio.

## Última Alteração

- **Data:** 2026-05-24
- **O que mudou:** Criado o projeto standalone `spaces/boris/projects/customer-intelligence-dashboard/` para visualizar a inteligência do cliente do Bóris fora do `boris-painel`, mantendo o acervo oficial em `resources/`.
- **Agente:** kernel
