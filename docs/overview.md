# AgentOS — Visão Geral

## O que é o AgentOS

O AgentOS é um sistema operacional de agentes de IA construído sobre o Claude Code. Ele fornece uma infraestrutura padronizada para criar, gerenciar e coordenar agentes de IA em spaces do usuário.

A ideia central é simples: assim como um sistema operacional gerencia processos, memória e comunicação entre programas, o AgentOS gerencia agentes, memória e comunicação entre eles.

---

## Por que usar o AgentOS

- **Padronização** — Todos os agentes seguem o mesmo formato e convenções, tornando o sistema previsível e fácil de manter.
- **Isolamento** — Cada space é um namespace isolado. Agentes de spaces diferentes não interferem entre si.
- **Organização** — Áreas subdividem spaces em domínios lógicos, agrupando agentes e times relacionados.
- **Memória persistente** — Agentes têm memória estruturada que persiste entre sessões.
- **Colaboração** — Agentes podem se comunicar de forma síncrona (invocação direta) e assíncrona (handoff e bus de eventos).
- **Extensibilidade** — Novos agentes, skills e times podem ser adicionados a qualquer momento.

---

## Hierarquia: Space > Área > Time

O AgentOS organiza recursos do usuário em três níveis:

| Nível | Descrição | Manifesto |
|---|---|---|
| **Space** | Namespace isolado de nível superior | `SPACE.md` |
| **Área** | Subdivisão temática dentro de um space | `AREA.md` |
| **Time** | Grupo de agentes colaborativos dentro de uma área | `TEAM.md` |

Agentes podem existir no nível de área ou dentro de times.

---

## Enforcement automático — Sistema de Hooks

A partir da v0.8.0, o AgentOS possui hooks automáticos configurados no Claude Code que enforçam os protocolos em tempo de execução:

- **Guardrails (PreToolUse):** bloqueia writes em arquivos protegidos do sistema (protocolos, scripts, definições de agentes e skills, configurações, secrets).
- **Enforcement (PostToolUse):** rastreia criações estruturais (spaces, áreas, times, agentes) e monitora se o checklist de manutenção foi seguido.
- **Validation (Stop):** ao final de cada sessão, verifica se o checklist de manutenção foi cumprido.

Scripts em `system/scripts/hooks/`. Configurados em `.claude/settings.json`. Veja detalhes em [Arquitetura](architecture.md#sistema-de-hooks-v080).

---

## Status atual do sistema

| Componente | Status |
|---|---|
| Versão | 0.8.0 |
| Instalado em | 2026-03-20 |
| Status geral | Ativo |
| Agentes do sistema | 19 ativos (8 core + 11 skills Anthropic) |
| Skills globais | 12 instaladas |
| Spaces | 0 |

### Agentes do sistema ativos

**Core:**

| Agente | Responsabilidade |
|---|---|
| agent-manager | Criar e gerenciar agentes, spaces e áreas |
| skill-manager | Criar e validar skills |
| memory-manager | Gerenciar memória do sistema |
| team-manager | Criar e gerenciar times |
| doc-manager | Gerar e manter documentação |
| health-monitor | Diagnosticar problemas de integridade |
| task-runner | Orquestrar workflows multi-agente |
| workflow-planner | Traduzir intenção em planos de execução |

**Skills Anthropic:**

| Agente | Responsabilidade |
|---|---|
| brand-guidelines | Identidade visual Anthropic |
| canvas-design | Arte visual em PDF/PNG |
| doc-coauthoring | Workflow colaborativo de documentos |
| docx-manager | Documentos Word (.docx) |
| pptx-manager | Apresentações PowerPoint (.pptx) |
| xlsx-manager | Planilhas Excel (.xlsx, .csv) |
| pdf-manager | Processamento de PDFs |
| frontend-design | Interfaces frontend production-grade |
| theme-factory | Toolkit de temas profissionais |
| web-artifacts-builder | Artefatos web React/TS |
| mcp-builder | Construção de servidores MCP |

---

## Como o AgentOS funciona

1. O usuário interage com o **kernel** (o próprio Claude Code com `CLAUDE.md` carregado).
2. O kernel roteia cada solicitação para o agente ou comando correto.
3. Agentes de sistema gerenciam a infraestrutura (criação de agentes, memória, skills, times, docs).
4. Agentes do usuário vivem dentro de spaces (organizados em áreas e times) e executam as tarefas do negócio.
5. Toda a comunicação é registrada no message bus (`system/memory/bus.md`).

---

## Próximos passos

- [Começando com o AgentOS](getting-started.md) — como criar seu primeiro space
- [Arquitetura](architecture.md) — entenda a estrutura do sistema
- [Agentes do sistema](system-agents.md) — conheça cada agente e suas capacidades
- [Comandos](commands.md) — referência completa de comandos disponíveis
