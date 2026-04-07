# Changelog

Todas as mudanças significativas do AgentOS serão documentadas neste arquivo.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/).

---

## [Unreleased]

### Adicionado
- **Memória operacional viva do dia** — criados `spaces/pessoal/areas/dia/memory/agora.md`, `inbox.md` e `follow-ups.md` para persistir contexto cotidiano importante fora do histórico da conversa
- **Comando `/agora`** — criado slash command no runtime Codex para consultar e atualizar o estado vivo do dia com `mostrar`, `captura`, `check-in` e `fechamento`
- **Runtime Codex primário** — criado `CODEX.md` e a árvore `.Codex/` (`agents/`, `commands/`, `skills/agent-bootstrap`) para tornar o Codex o runtime principal do AgentOS
- **Regra global de idioma** — criado `docs/language.md` e adicionada regra explícita de português brasileiro como idioma padrão do projeto, salvo override explícito do usuário
- **Space pessoal inicial** — criado `spaces/pessoal/` com memória, guidelines e a área `dia` para começar a gerenciar projetos pessoais e a rotina diária dentro do AgentOS
- **Space empresa inicial** — criado `spaces/empresa/` para centralizar dados institucionais, fiscais, cadastrais e operacionais da empresa separadamente do produto Bóris
- **Workspace do Boris Painel importado** — o app principal foi trazido para `spaces/boris/areas/produto/workspaces/boris-painel/` com histórico Git preservado, conectando a área `produto` ao código real do sistema
- **WhatsApp pessoal formalizado no AgentOS** — criada a área `spaces/pessoal/areas/comunicacao/`, o agente `whatsapp-manager`, a skill `send-personal-whatsapp` e a workspace local `workspaces/evolution-api-agent`, internalizando a estrutura antes mantida fora do repositório
- **Comando `/painel`** — criado slash command para operar `status`, `commit`, `push` e `pull` do repo `boris-admin-core` a partir do workspace oficial dentro do AgentOS
- **Memória oficial de reuniões do Bóris** — criada a guideline `spaces/boris/guidelines/meeting-intelligence.md` e o acervo `spaces/boris/resources/reunioes/` para consolidar transcrições, resumos, decisões e próximos passos de calls relevantes

### Alterado
- **Kernel orientado a contexto vivo** — `KERNEL.md`, o loader `.Codex/agents/pessoal--dia--day-manager.md`, a guideline `spaces/pessoal/guidelines/gestao-do-dia.md` e o agente `day-manager` agora tratam a memória viva da área `pessoal/dia` como fonte operacional primária para rotina, prioridades e follow-ups
- **Source of truth de runtime** — `KERNEL.md`, `README.md`, `docs/architecture.md`, `system/protocols/sync.md`, `system/scripts/setup.py`, `system/scripts/sync.py`, `system/scripts/validate.py` e hooks agora tratam `.Codex/` como runtime canônico para sync e operação
- **Compatibilidade preservada** — `.gemini/` continua como runtime derivado; `.claude/` permanece apenas como legado/compatibilidade enquanto a migração não é concluída integralmente
- **Comandos do runtime Codex** — loaders e comandos mínimos em `.Codex/` foram ajustados para registrar agentes e bootstrap no novo namespace
- **Biblioteca do Boris reorganizada** — `spaces/boris/resources/` deixou de usar nomes `legacy-*` e passou a expor blocos oficiais `content/`, `editorial/`, `audio/`, `leads/` e `skills/`, com referências internas atualizadas
- **Índices e guidelines do Boris limpos** — documentação do space agora trata o acervo importado como biblioteca operacional local, sem depender da noção de legado
- **Git do Boris Painel regularizado** — `spaces/boris/areas/produto/workspaces/boris-painel/` deixou de ser checkout inline no monorepo e passou a apontar como submódulo para `mateuscrocha/boris-admin-core`, mantendo um único caminho oficial local dentro do AgentOS
- **Teste de produção real** — campanha `cabeça quente` e asset visual `visual-boris-cta.png` foram gerados dentro da nova árvore de `spaces/boris/resources/content/producao`
- **Idioma e prosódia do Boris formalizados** — `spaces/boris/guidelines/language-and-locution.md` e guidelines do space agora tratam português brasileiro, acentuação e locução emocional como regra herdável
- **Roteamento pessoal de comunicação** — `AGENTS.md`, o space `pessoal` e os registries do sistema agora tratam o perfil `pessoal` da Evolution API como canal oficial para tarefas de WhatsApp pessoal, sem depender operacionalmente do projeto externo
## [0.9.0] - 2026-03-30

### Adicionado
- **Protocolo de Sincronização de Runtimes** — processo agnóstico para manter `.claude/` e `.gemini/` sempre atualizados
  - `system/protocols/sync.md` — protocolo completo: direção do sync, quando sincronizar, responsabilidades, transformações aplicadas
  - `system/scripts/sync.py` — script de detecção de drift e correção automática com 3 modos de operação:
    - Modo relatório (default): detecta e lista inconsistências entre runtimes
    - Modo `--fix`: aplica correções automaticamente (agents faltantes, conteúdo divergente, skills faltantes)
    - Modo `--json`: output estruturado para integração com hooks/scripts
  - 5 verificações automáticas: paridade de agents, paridade de commands/skills, completude de system agents, referências ao KERNEL, consistência de versão
- **Hooks de Sync** — enforcement expandido em `enforcement.py` e `config.py`:
  - PostToolUse agora detecta mudanças em `KERNEL.md`, `.claude/agents/*.md` e `.claude/commands/*.md`
  - Emite aviso automático com comando de sync quando esses arquivos são alterados
  - `SYNC_TRIGGER_PATTERNS` em config.py para fácil extensão

### Alterado
- `KERNEL.md` — nova seção "Sincronização de Runtimes" e protocolo de sync na tabela de protocolos
- `CLAUDE.md` — nova seção "Sync de Runtimes" com comandos de verificação
- `GEMINI.md` — nota sobre derivação via sync.py
- `system/scripts/hooks/config.py` — adicionado `SYNC_TRIGGER_PATTERNS` para detecção de mudanças que requerem sync
- `system/scripts/hooks/enforcement.py` — nova função `get_sync_reminder()` integrada ao `process_write()`

### Impacto
- Usuários de Claude Code e Gemini CLI agora têm garantia de paridade — mudanças em um runtime são propagadas para o outro
- Hooks alertam proativamente sobre sync pendente, eliminando o risco de drift silencioso
- Script `sync.py` pode ser integrado em CI/CD ou executado manualmente antes de releases

---

## [0.8.1] - 2026-03-25

### Alterado
- **CLAUDE.md refatorado** — Removida duplicação com KERNEL.md (~210→~35 linhas). Agora segue o mesmo padrão do GEMINI.md: instrução obrigatória para ler KERNEL.md + apenas delta específico do Claude Code (hooks, Agent tool, paths `.claude/`). Single source of truth para regras do kernel.

---

## [0.8.0] - 2026-03-24

### Adicionado
- **Sistema de Hooks** — Enforcement automatizado de protocolos do AgentOS via Claude Code hooks
  - **Fase 1 (Guardrails/PreToolUse):** Bloqueia writes em arquivos estruturais do sistema (`system/protocols/`, `system/scripts/`, `system/agents/*/AGENT.md`, `system/skills/*/SKILL.md`, `.claude/settings.json`) e arquivos de secrets (`.env`, `*.key`, `*.pem`, `credentials.json`)
  - **Fase 2 (Enforcement/PostToolUse+Stop):** Rastreia mudanças estruturais (criação de spaces, areas, teams, agentes) e verifica checklist de manutenção ao final da sessão (CHANGELOG, world.md, bus.md, CLAUDE.md, README.md)
  - Session tracker com estado persistido entre tool calls (`.session_state.json`)
  - Reminder automático para seção "Última Alteração" em `world.md`
- 10 novos arquivos em `system/scripts/hooks/`:
  - `config.py` — Constantes de paths bloqueados/permitidos/secrets/estruturais
  - `utils.py` — Normalização de paths Windows/POSIX, leitura stdin JSON, glob matching
  - `guardrails.py` — 3 checks preventivos (secrets, estrutural, system-dir)
  - `pre_tool_use.py` — Entry point PreToolUse (bloqueia)
  - `enforcement.py` — Detecção de mudanças estruturais + tracking de checklist
  - `session_tracker.py` — CRUD do estado de sessão
  - `post_tool_use.py` — Entry point PostToolUse (warn)
  - `on_stop.py` — Validação final do checklist (warn)
  - `test_hooks.py` — 62 testes unitários cobrindo ambas as fases
- Hooks configurados em `.claude/settings.json` (PreToolUse, PostToolUse, Stop)

### Impacto
- Primeira camada de enforcement real do AgentOS — protocolos agora são verificados automaticamente
- Agentes não podem mais modificar arquivos estruturais do sistema diretamente
- Mudanças estruturais disparam tracking de checklist de manutenção

---

## [0.7.1] - 2026-03-23

### Adicionado
- **Página de documentação interativa** (`docs/index.html`) — HTML autocontido para GTM do AgentOS
  - 12 seções completas: hero, arquitetura, quick start, conceitos, comandos, agentes, memória, protocolos, cenário prático, guia de desenvolvimento, FAQ e changelog
  - Diagramas interativos com Mermaid.js (hierarquia, fluxos, colaboração)
  - Dark/light mode com paleta Meliuz (rosa + preto/cinza)
  - Sidebar navegável com scroll-spy, search, copy-to-clipboard, accordion FAQ
  - Fontes: Syne (headings) + Mulish (corpo)
  - Responsivo (desktop + tablet + mobile)

### Impacto
- Novo arquivo: `docs/index.html`
- Nenhuma mudança em arquivos existentes do sistema

---

## [0.7.0] - 2026-03-23

### Adicionado
- 11 **skills globais** do repositório oficial `anthropics/skills`:
  - `brand-guidelines` — identidade visual Anthropic (cores, tipografia)
  - `canvas-design` — arte visual em PDF/PNG com filosofia de design
  - `doc-coauthoring` — workflow colaborativo de documentos em 3 estágios
  - `docx` — criar, ler, editar documentos Word (.docx) com scripts auxiliares
  - `pptx` — criar, editar apresentações PowerPoint (.pptx) com scripts auxiliares
  - `xlsx` — operações com planilhas Excel (.xlsx, .csv) com scripts auxiliares
  - `pdf` — processamento completo de PDFs com 8 scripts Python
  - `frontend-design` — interfaces frontend production-grade
  - `theme-factory` — toolkit de 10 temas profissionais + temas custom
  - `web-artifacts-builder` — artefatos web React 18 + TypeScript + shadcn/ui
  - `mcp-builder` — construção de servidores MCP (TS/Python) com referências e avaliações
- 11 **agentes de sistema** dedicados (um por skill): brand-guidelines, canvas-design, doc-coauthoring, docx-manager, pptx-manager, xlsx-manager, pdf-manager, frontend-design, theme-factory, web-artifacts-builder, mcp-builder
- 11 **comandos** novos: `/brand-guidelines`, `/canvas-design`, `/doc-coauthoring`, `/docx`, `/pptx`, `/xlsx`, `/pdf`, `/frontend-design`, `/theme-factory`, `/web-artifacts`, `/mcp-builder`
- Dual-write de todos os agentes em `.claude/agents/` e `.gemini/agents/`
- Dual-write de todos os comandos em `.claude/commands/` e `.gemini/skills/`
- Scripts auxiliares incluídos: office utilities (pack, unpack, validate), Python scripts para PDF forms, shell scripts para web artifacts, referências MCP

### Alterado
- `CLAUDE.md` — tabelas de agentes e comandos expandidas com os 11 novos
- Agent registry expandido de 8 para 19 agentes de sistema
- Skill registry expandido com 11 novas skills globais

### Impacto
- Total de agentes de sistema: 8 → 19
- Total de skills globais: 1 → 12
- Capacidades expandidas: office docs (Word, PowerPoint, Excel, PDF), design visual, MCP servers, web artifacts
- Todos os comandos disponíveis em ambos runtimes (Claude Code + Gemini CLI)

---

## [0.6.0] - 2026-03-23

### Adicionado
- Suporte **multi-runtime**: AgentOS agora funciona tanto no Claude Code quanto no Gemini CLI
- `KERNEL.md` — kernel agnóstico de runtime com linguagem genérica
- `GEMINI.md` — thin loader com `@KERNEL.md` import para Gemini CLI
- Diretório `.gemini/agents/` com 8 agent adapters espelhando `.claude/agents/`
- Diretório `.gemini/skills/` com 13 skills (12 commands equivalentes + agent-bootstrap)
- `.gemini/settings.json` — configuração básica do Gemini CLI
- Conceito de **dual-write**: ao criar agente, adapters são escritos em `.claude/agents/` E `.gemini/agents/`

### Alterado
- `CLAUDE.md` — adicionada nota multi-runtime e referência ao interop com `.gemini/agents/`
- Protocolos (`communication.md`, `agent-init.md`, `maintenance.md`) — linguagem genérica ("invocação de subagente" em vez de "Agent tool")
- `agent-manager/AGENT.md` — regras atualizadas para dual-write e runtimes múltiplos
- `agent-manager/memory/standards.md` — seção "Namespace" generalizada para ambos runtimes
- Skills `create-agent` e `evolve-agent` — dual-write obrigatório em ambos runtime dirs
- `health-monitor/AGENT.md` e skill `check-health` — validação de ambos runtime dirs
- `task-runner/AGENT.md` — linguagem genérica para invocação de subagentes
- `.claude/skills/agent-bootstrap/SKILL.md` — processo atualizado para dual-write
- `.claude/commands/health.md` e `new-agent.md` — referências a ambos runtime dirs
- `system/scripts/setup.py` — cria e valida `.gemini/agents/` e `.gemini/skills/`; funções `sync_gemini_agents()` e `sync_gemini_skills()` para gerar `.gemini/` a partir de `.claude/` automaticamente; versão atualizada para v0.6.0
- `system/scripts/validate.py` — valida existência de `.gemini/` dirs e agents
- `docs/getting-started.md` — atualizado para multi-runtime: pré-requisitos, exemplos de invocação, diagramas, FAQ e troubleshooting mencionam ambos Claude Code e Gemini CLI

### Impacto
- Times usando Claude Code e Gemini CLI podem compartilhar o mesmo AgentOS
- ~80% do sistema permanece agnóstico (memória, protocolos, templates, spaces)
- Apenas ~20% é runtime-específico (thin adapters em `.claude/` e `.gemini/`)
- `/setup` agora sincroniza automaticamente `.gemini/` a partir de `.claude/` (instalações existentes ganham suporte Gemini sem ação manual)

---

## [0.5.1] - 2026-03-23

### Corrigido
- HM-004: Skill `agent-bootstrap` registrada no skill-registry.md (skill-manager)
- HM-005: memory-map.md regenerado com tamanhos reais de arquivos (memory-manager)
- HM-006: Handoffs concluídos (HO-001, HO-002) removidos de system/memory/handoff.md (memory-manager)
- HM-007: README.md gerado na raiz do projeto (doc-manager)

---

## [0.5.0] - 2026-03-23

### Adicionado
- Protocolo `system/protocols/agent-init.md` — inicialização centralizada de agentes (sequência de leitura, regras comuns, acesso a agentes do sistema)
- Script `system/scripts/generate-registries.py` — geração automática de registries a partir do filesystem (elimina drift manual)

### Alterado
- **CLAUDE.md** otimizado: seções duplicadas de protocolos (Comunicação, Memória, Guidelines) substituídas por resumos com referência aos arquivos de protocolo. Redução de ~200 para ~130 linhas
- **Thin loaders** (`.claude/agents/*.md`) simplificados: blocos de inicialização repetidos substituídos por referência ao `agent-init.md`. ~10 linhas por loader
- **AGENT.md** de todos os 8 agentes de sistema: removidas seções "Contexto Rápido", "Matriz de Colaboração" e simplificadas "Memória" e "Skills". Redução de ~50%
- **Template de agente** simplificado: removidas seções "Acesso a Agentes do Sistema", "Matriz de Colaboração" e "Guidelines" (movidas para `agent-init.md`). De 57 para ~30 linhas
- **Skills** create-space, create-area, create-team, create-agent comprimidas: substituição de placeholders e templates inline por referências, passos de finalização consolidados
- **Commands** (`.claude/commands/*.md`) comprimidos de ~25 para ~12 linhas cada
- **communication.md**: seção de handoff substituída por referência a `system/protocols/handoff.md`
- Registries agora gerados automaticamente por `generate-registries.py`

### Impacto
- Redução total de ~41% em linhas de configuração do sistema (~1566 → ~920 linhas)
- Economia de tokens em toda interação (CLAUDE.md mais enxuto)
- Manutenção simplificada (informação não duplicada em múltiplos arquivos)

---

## [0.4.0] - 2026-03-23

### Adicionado
- Sistema de **guidelines** — documentação de processos, playbooks e padrões em cada escopo
- Diretório `guidelines/` criado automaticamente em space, area e time
- Template `system/templates/guidelines/GUIDELINES.md.template`
- Herança de guidelines em cascata: space → area → time
- Cross-references entre guidelines de escopos diferentes
- Seção Guidelines nos templates de space, area, team e agent
- Passo de leitura de guidelines no protocolo de inicialização de agentes
- Seção `## Guidelines` no CLAUDE.md e no protocolo de memória

### Alterado
- Skills create-space, create-area, create-team agora criam `guidelines/` automaticamente
- Skill create-agent: thin loader inclui leitura de guidelines do escopo
- Protocolo de inicialização de agentes expandido de 3 para 4 passos (inclui guidelines)
- `setup.py` atualizado para v0.4.0 (refs corrigidas: `users/`→`spaces/`, `projects/`→`spaces/`, 8 agentes, comandos atuais, validação de guidelines template)
- CLAUDE.md atualizado com hierarquia e protocolo de guidelines

---

## [0.3.0] - 2026-03-21

### Adicionado
- Agente de sistema **health-monitor** — diagnóstico de integridade (check-health, check-handoffs, generate-report)
- Agente de sistema **task-runner** — orquestração de workflows multi-agente (run-workflow, create-workflow, resume-workflow)
- Agente de sistema **workflow-planner** — planejamento de execução (plan-action, estimate-impact)
- Diretório `system/workflows/` para definições reutilizáveis de workflows
- Comandos `/health`, `/plan`, `/run`, `/workflows`
- 8 novas skills de sistema (3 health-monitor + 3 task-runner + 2 workflow-planner)
- Regra de roteamento para requests complexos (workflow-planner antes de task-runner)

### Alterado
- Protocolo de roteamento no CLAUDE.md expandido de 8 para 11 regras
- Total de agentes de sistema: 5 → 8

---

## [0.2.0] - 2026-03-21

### Adicionado
- Nova hierarquia **Space > Area > Team** substituindo a estrutura `users/`
- Conceito de **Area** — subdivisão temática dentro de um space
- Template `AREA.md.template` em `system/templates/area/`
- Skill `create-area` para o agent-manager
- Skill `create-space` (substituindo `create-project`)
- Comando `/new-space` (substituindo `/new-project`)
- Comando `/new-area` para criar areas dentro de spaces
- Escopo de memória **Area** (`spaces/{space}/areas/{area}/memory/`)
- Evento `area.created` no message bus
- Evento `space.created` (substituindo `project.created`)

### Alterado
- Diretório `users/` renomeado para `spaces/`
- Template `PROJECT.md.template` renomeado para `SPACE.md.template`
- Namespace de agentes: `user--{projeto}--{agente}` → `{space}--{area}--{agente}` / `{space}--{area}--{team}--{agente}`
- Times agora vivem dentro de areas: `spaces/{space}/areas/{area}/teams/{team}/`
- Agentes podem existir no nível de area ou team
- Todos os protocolos, skills, commands e docs atualizados para nova hierarquia
- Comandos `/new-agent`, `/new-team`, `/new-skill` agora recebem space e area como argumentos
- Tabela de escopos de memória expandida para 5 níveis (sistema, space, area, time, agente)

### Removido
- Estrutura `users/{projeto}/` (substituída por `spaces/{space}/`)
- Skill `create-project` (substituída por `create-space`)
- Comando `/new-project` (substituído por `/new-space`)

---

## [0.1.1] - 2026-03-20

### Adicionado
- Protocolo de manutenção (`system/protocols/maintenance.md`) — define cleanup, changelog, auditoria e rotação
- `CHANGELOG.md` para rastreio permanente de evolução do sistema
- Seção "Contexto Rápido" em todos os 5 AGENT.md — regras essenciais inline
- Seção "Resumo de Regras" no topo dos 4 protocolos para consulta rápida
- Seção "Última Alteração" obrigatória em `world.md`
- Tabela de protocolos e seção de rastreio de evolução no `CLAUDE.md`

### Alterado
- `.claude/agents/*.md` enxugados de ~45 para ~20 linhas — agora são thin loaders que delegam ao AGENT.md
- Inicialização de agentes reduzida de 4-6 arquivos para 3
- Documentação atualizada (architecture, protocols, memory-system, system-agents, development-guide)

---

## [0.1.0] - 2026-03-20

### Adicionado
- Bootstrap do sistema com 5 agentes de sistema (agent-manager, skill-manager, memory-manager, team-manager, doc-manager)
- 3 protocolos de comunicação (memória, comunicação, handoff)
- Sistema de skills com skill-creator (Anthropic) como skill global
- Templates para agentes, projetos, skills e times
- Documentação completa (9 arquivos em `docs/`)
- Message bus para eventos do sistema (`system/memory/bus.md`)
- 7 comandos slash: `/setup`, `/new-project`, `/new-agent`, `/new-team`, `/new-skill`, `/status`, `/handoff`
- Scripts de setup e validação (`system/scripts/`)
