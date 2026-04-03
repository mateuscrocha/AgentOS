# AgentOS — Arquitetura

## Duas Camadas

O AgentOS é organizado em duas camadas distintas:

```
AgentOS/
├── CODEX.md               ← Kernel do runtime principal
├── system/                ← Camada do sistema (core do OS)
│   ├── agents/            ← Agentes do sistema
│   ├── memory/            ← Memória global
│   ├── protocols/         ← Protocolos de comunicação e memória
│   ├── skills/            ← Skills globais disponíveis para todos
│   └── templates/         ← Templates para criar recursos
├── spaces/                ← Camada do usuário (spaces isolados)
│   └── {space}/
│       ├── SPACE.md
│       ├── memory/        ← Memória do space
│       └── areas/         ← Áreas do space
│           └── {area}/
│               ├── AREA.md
│               ├── memory/    ← Memória da área
│               ├── agents/    ← Agentes da área
│               └── teams/     ← Times da área
│                   └── {time}/
│                       ├── TEAM.md
│                       ├── memory/
│                       └── agents/  ← Agentes do time
└── docs/                  ← Documentação do sistema
```

### Camada do sistema (`system/`)

O core do AgentOS. Contém os agentes de sistema, protocolos, templates e memória global. Esta camada **não deve ser modificada diretamente pelo usuário** — use os agentes do sistema para fazer alterações.

### Camada do usuário (`spaces/`)

Spaces criados pelo usuário. Cada space é um namespace isolado. Agentes de spaces diferentes não se comunicam diretamente.

Dentro de cada space, **áreas** agrupam agentes e times relacionados. A hierarquia é: **Space > Area > Team**.

---

## Três Níveis de Skills

Skills são capacidades executáveis que agentes possuem. O sistema tem três níveis:

| Nível | Localização | Escopo |
|---|---|---|
| Skills globais do sistema | `system/skills/` | Disponíveis para qualquer agente |
| Skills de agente do sistema | `system/agents/{agente}/skills/` | Específicas do agente de sistema |
| Skills de agente do usuário | `spaces/{space}/areas/{area}/agents/{agente}/skills/` | Específicas do agente do usuário |

Skills globais instaladas:
- **skill-creator** (`system/skills/skill-creator/`) — processo completo para criar, testar e iterar skills

---

## Namespace de Agentes no Codex

O Codex lê agentes do diretório `.Codex/agents/`. O AgentOS usa uma convenção de nomes para distinguir agentes do sistema e do usuário:

| Tipo | Convenção | Exemplo |
|---|---|---|
| Agente de sistema | `{nome}.md` | `agent-manager.md` |
| Agente de área | `{space}--{area}--{agente}.md` | `meu-space--backend--analista.md` |
| Agente de time | `{space}--{area}--{time}--{agente}.md` | `meu-space--backend--squad-api--dev.md` |

O separador `--` (dois hífens) é o delimitador de namespace.

---

## Estrutura de um Agente

Todo agente (sistema ou usuário) tem a seguinte estrutura:

```
{agente}/
├── AGENT.md        ← Definição: persona, capacidades, regras, colaboração
├── memory/
│   ├── history.md  ← Log cronológico de ações
│   └── ...         ← Outros arquivos de memória (registry, etc.)
└── skills/
    └── {skill}/
        └── SKILL.md ← Definição da skill: processo, inputs, outputs
```

O `AGENT.md` tem frontmatter YAML obrigatório:

```yaml
---
name: nome-do-agente
scope: system | user
space: nome-do-space  (apenas para agentes de usuário)
area: nome-da-area    (apenas para agentes de usuário)
team: nome-do-time    (apenas para agentes de time)
description: o que este agente faz
version: 1.0
created: YYYY-MM-DD
---
```

---

## Estrutura de um Space

```
spaces/{space}/
├── SPACE.md            ← Definição: propósito, áreas
├── memory/
│   ├── world.md        ← Estado atual do space
│   └── handoff.md      ← Handoffs cross-area
└── areas/
    └── {area}/
        ├── AREA.md         ← Definição: propósito, agentes, times
        ├── memory/
        │   ├── world.md    ← Estado atual da área
        │   └── handoff.md  ← Handoffs entre agentes da área
        ├── agents/
        │   └── {agente}/   ← Estrutura de agente (veja acima)
        └── teams/
            └── {time}/
                ├── TEAM.md     ← Definição: membros, papéis, líder
                ├── memory/
                │   ├── world.md
                │   └── handoff.md
                └── agents/
                    └── {agente}/  ← Agentes do time
```

---

## Protocolo de Roteamento do Kernel

Quando uma solicitação chega ao kernel (`CODEX.md`), ela é roteada seguindo esta lógica:

1. Começa com `/`? → Executa o comando correspondente
2. Envolve criar/gerenciar agentes ou spaces? → Invoca `agent-manager`
3. Envolve criar/gerenciar skills? → Invoca `skill-manager`
4. Envolve memória do sistema? → Invoca `memory-manager`
5. Envolve times? → Invoca `team-manager`
6. Envolve documentação? → Invoca `doc-manager`
7. É para um agente específico do usuário? → Identifica e invoca via Agent tool
8. Caso contrário → Responde diretamente como kernel

---

## Protocolos

O sistema define quatro protocolos em `system/protocols/`:

| Protocolo | Arquivo | Propósito |
|---|---|---|
| Memória | `system/protocols/memory.md` | Escopos, acesso e regras de memória |
| Comunicação | `system/protocols/communication.md` | Invocação direta, handoff, message bus |
| Handoff | `system/protocols/handoff.md` | Formato e ciclo de vida de handoffs |
| Manutenção | `system/protocols/maintenance.md` | Cleanup, changelog, auditoria, rotação |

Cada protocolo tem um **Resumo de Regras** no topo para consulta rápida sem precisar ler o documento inteiro.

---

## Rastreio de Evolução

O AgentOS mantém três camadas de rastreio para evoluções do sistema:

| Mecanismo | Arquivo | Propósito |
|---|---|---|
| Changelog | `CHANGELOG.md` | Registro permanente de mudanças estruturais (formato Keep a Changelog) |
| Message Bus | `system/memory/bus.md` | Log granular de eventos (podado a 50 entradas pelo memory-manager) |
| Estado global | `system/memory/world.md` | Snapshot do estado atual, inclui seção obrigatória "Última Alteração" |

O `CHANGELOG.md` é atualizado apenas para mudanças estruturais (novos agentes, protocolos, features). Operações rotineiras como cleanup e consultas não são registradas nele.

---

## Sistema de Hooks (v0.8.0)

O AgentOS possui um sistema de hooks automáticos que enforça os protocolos em tempo de execução. Os hooks são configurados em `.Codex/settings.json` e executam scripts Python localizados em `system/scripts/hooks/`.

### Três tipos de hook

| Hook | Evento | Comportamento | Script |
|---|---|---|---|
| **Guardrails** | `PreToolUse` (Write/Edit) | Bloqueia writes em arquivos protegidos | `guardrails.py` / `pre_tool_use.py` |
| **Enforcement** | `PostToolUse` (Write/Edit) | Rastreia mudanças estruturais e monitora o checklist de manutenção | `enforcement.py` / `post_tool_use.py` |
| **Validation** | `Stop` | Verifica ao final da sessão se o checklist de manutenção foi cumprido | `on_stop.py` |

### Arquivos protegidos pelos Guardrails

O hook `PreToolUse` bloqueia qualquer tentativa de write ou edit nos seguintes caminhos:

- `system/protocols/` — protocolos do sistema
- `system/scripts/` — scripts do sistema
- `system/agents/*/AGENT.md` — definições de agentes de sistema
- `system/skills/*/SKILL.md` — definições de skills globais
- `.Codex/settings.json` — configuração do runtime Codex
- Arquivos de secrets: `.env`, `*.key`, `*.pem`

**Caminhos em `system/` que são editáveis:** `system/memory/*.md` e `system/agents/*/memory/*.md`.

### Scripts em `system/scripts/hooks/`

| Arquivo | Responsabilidade |
|---|---|
| `config.py` | Configuração central dos hooks |
| `utils.py` | Utilitários compartilhados |
| `guardrails.py` | Lógica de proteção de arquivos |
| `pre_tool_use.py` | Ponto de entrada do hook PreToolUse |
| `enforcement.py` | Lógica de rastreio de mudanças estruturais |
| `session_tracker.py` | Estado da sessão (checklist, eventos) |
| `post_tool_use.py` | Ponto de entrada do hook PostToolUse |
| `on_stop.py` | Ponto de entrada do hook Stop |
| `test_hooks.py` | 62 testes unitários |

---

## Diagrama de Dependências

```
Kernel (CODEX.md)
    │
    ├── agent-manager ──── memory-manager
    │       │           └── skill-manager
    │       └── team-manager
    │
    ├── skill-manager
    ├── memory-manager
    ├── team-manager
    └── doc-manager

Agentes do usuário
    │
    ├── Podem chamar → agentes do sistema (direto)
    ├── Podem chamar → agentes da mesma área (direto)
    └── Comunicam com → agentes de outras áreas/spaces (via handoff system)
```

---

## Documentação relacionada

- [Sistema de memória](memory-system.md) — escopos e tipos de memória
- [Protocolos](protocols.md) — comunicação entre agentes
- [Agentes do sistema](system-agents.md) — detalhe de cada agente
- [Guia de desenvolvimento](development-guide.md) — como estender o sistema
