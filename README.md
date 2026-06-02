# AgentOS

Sistema operacional de agentes de IA construído para rodar com o Codex como runtime principal. O AgentOS fornece uma infraestrutura completa para criar, organizar e orquestrar agentes especializados em namespaces isolados, com memória persistente, skills reutilizáveis e protocolos de comunicação formalizados.

## Portal do AgentOS

Se você abrir este repositório para se reorientar rápido, use este bloco como home de navegação.

### Quero entender o que posso fazer

- [`docs/manual-de-bolso.md`](docs/manual-de-bolso.md) — índice prático com mapa mental, exemplos de pedidos e comandos
- [`docs/commands.md`](docs/commands.md) — referência operacional dos comandos
- [`docs/system-agents.md`](docs/system-agents.md) — quem faz o quê entre os agentes do sistema
- `KERNEL.md` — regras centrais, roteamento, protocolos e arquitetura do kernel

### Quero começar pelo caminho mais curto

1. Rode `/status`
2. Leia [`docs/manual-de-bolso.md`](docs/manual-de-bolso.md)
3. Se a dúvida for "qual comando usar?", abra [`docs/commands.md`](docs/commands.md)
4. Se a dúvida for "qual agente deveria cuidar disso?", abra [`docs/system-agents.md`](docs/system-agents.md)

### Quero navegar por intenção

| Se você quer... | Comece por... |
|---|---|
| Ver o estado atual do sistema | `/status` |
| Checar problemas de integridade | `/health` |
| Planejar antes de executar | `/plan <descrição>` |
| Criar um novo domínio de trabalho | `/new-space <nome>` |
| Abrir uma frente dentro de um space | `/new-area <space> <nome>` |
| Criar um novo agente | `/new-agent <space> <area> <nome>` |
| Ensinar um procedimento a um agente | `/new-skill <space/area/agente> <nome>` |
| Montar um time | `/new-team <space> <area> <nome>` |
| Passar tarefa entre agentes | `/handoff <de> <para> <tarefa>` |
| Registrar ou consultar o que está rolando agora | `/agora [mostrar\|captura\|check-in\|fechamento] [conteúdo]` |
| Rodar um workflow | `/workflows` e depois `/run <workflow>` |
| Trabalhar com docs, PPTX, XLSX, PDF ou frontend | comandos especializados como `/docx`, `/pptx`, `/xlsx`, `/pdf`, `/frontend-design` |

### Quero saber o que já existe hoje

**Spaces atuais**

- `boris`
- `empresa`
- `pessoal`

**Áreas atuais**

- `boris/comercial`
- `boris/conteudo`
- `boris/operacoes`
- `boris/produto`
- `boris/suporte`
- `pessoal/comunicacao`
- `pessoal/dia`
- `pessoal/financas`

**Agentes de negócio já registrados**

- `boris--comercial--sales-operator`
- `boris--comercial--enap-opportunity-manager`
- `boris--conteudo--editorial-strategist`
- `boris--conteudo--youtube-live-producer`
- `boris--operacoes--operations-manager`
- `boris--produto--product-manager`
- `boris--suporte--support-manager`
- `pessoal--comunicacao--whatsapp-manager`
- `pessoal--dia--day-manager`
- `pessoal--financas--household-finance-manager`

### Quero exemplos práticos de pedidos

```text
Me mostra um panorama do AgentOS
Cria um novo agente para revisar propostas comerciais
Qual agente do Bóris deveria tocar essa demanda?
Usa o product-manager do Bóris para estruturar essa tela
Usa o editorial-strategist para transformar isso em pauta
Usa o whatsapp-manager para preparar essa mensagem
Usa /agora captura preciso lembrar de fechar orçamento do casamento
Usa o household-finance-manager para organizar as contas da casa
Me ajuda a planejar essa operação antes de executar
```

### Quero lembrar as regras básicas sem abrir tudo

- Use nomes em `kebab-case`
- Pense em `space` como domínio, `area` como frente, `agent` como função e `skill` como procedimento
- Quando a tarefa parecer grande ou ambígua, peça um plano antes
- Quando o trabalho for estrutural, prefira comandos
- Quando a demanda estiver aberta, prefira linguagem natural
- O idioma padrão do projeto é português do Brasil

---

## Idioma Padrão

Por padrão, todo texto produzido neste projeto deve sair em **português brasileiro**, com acentuação e pontuação corretas, salvo pedido explícito do usuário para outro idioma.

---

## Arquitetura

O sistema é organizado em duas camadas:

- **`system/`** — Core do OS. Contém os agentes de sistema, protocolos, skills globais, templates e memória global. Não deve ser modificado diretamente.
- **`spaces/`** — Espaço do usuário. Cada space é um namespace isolado com suas próprias áreas, agentes, times e memória.

### Hierarquia de recursos

```
spaces/{space}/
├── SPACE.md
├── memory/
└── areas/{area}/
    ├── AREA.md
    ├── workspaces/
    ├── memory/
    ├── agents/{agente}/
    │   ├── AGENT.md
    │   ├── memory/
    │   └── skills/
    └── teams/{time}/
        ├── TEAM.md
        ├── memory/
        └── agents/{agente}/
```

A hierarquia é: **Space > Area > Team > Agent**.

Quando uma area possui um aplicativo ou repositorio principal, ele pode viver em `workspaces/` dentro da propria area, mantendo codigo executavel separado de `guidelines/` e `memory/`.

Agentes de spaces diferentes não se comunicam diretamente. A comunicação entre escopos ocorre via handoffs formalizados.

---

## Agentes do Sistema

O AgentOS tem 19 agentes de sistema — 8 de core e 11 com skills Anthropic:

**Core:**

| Agente | Responsabilidade |
|---|---|
| **agent-manager** | Criar, evoluir e gerenciar agentes, spaces e areas |
| **skill-manager** | Criar, validar e registrar skills |
| **memory-manager** | Inicializar, escopar e limpar memória |
| **team-manager** | Criar times, gerenciar membros e comunicação |
| **doc-manager** | Gerar e manter documentação do sistema |
| **health-monitor** | Diagnosticar problemas de integridade do sistema |
| **task-runner** | Orquestrar workflows multi-agente |
| **workflow-planner** | Traduzir intenção em planos de execução |

**Skills Anthropic:**

| Agente | Responsabilidade |
|---|---|
| **brand-guidelines** | Aplicar identidade visual Anthropic a artefatos |
| **canvas-design** | Criar arte visual sofisticada em PDF/PNG |
| **doc-coauthoring** | Workflow colaborativo de criação de documentos |
| **docx-manager** | Criar, ler, editar documentos Word (.docx) |
| **pptx-manager** | Criar, editar apresentações PowerPoint (.pptx) |
| **xlsx-manager** | Operações com planilhas Excel (.xlsx, .csv) |
| **pdf-manager** | Processamento completo de PDFs |
| **frontend-design** | Interfaces frontend production-grade |
| **theme-factory** | Toolkit de temas profissionais |
| **web-artifacts-builder** | Artefatos web React/TS para claude.ai |
| **mcp-builder** | Construção de servidores MCP (TS/Python) |

Todos estão em `system/agents/` e são invocáveis via Agent tool do Codex ou `@agente` no Gemini CLI.

---

## Quick Start

### 1. Verificar o sistema

```
/status
```

### 2. Criar um space

```
/new-space meu-space
```

### 3. Criar uma area

```
/new-area meu-space backend
```

### 4. Criar um agente

```
/new-agent meu-space backend analista
```

### 5. Adicionar uma skill

```
/new-skill meu-space/backend/analista analisar-dados
```

### 6. Criar um time (opcional)

```
/new-team meu-space backend equipe-analise
```

Após a criação, o agente fica disponível no Codex como subagente. Use o Agent tool para invocá-lo.

---

## Comandos Disponíveis

| Comando | Acao |
|---|---|
| `/setup` | Bootstrap do sistema (primeira vez) |
| `/new-space <nome>` | Cria um novo space |
| `/new-area <space> <nome>` | Cria uma area dentro de um space |
| `/new-agent <space> <area> <nome>` | Cria um agente dentro de uma area |
| `/new-team <space> <area> <nome>` | Cria um time dentro de uma area |
| `/new-skill <space/area/agente> <nome>` | Cria uma skill para um agente |
| `/status` | Visao geral do sistema |
| `/health` | Diagnostico de integridade do sistema |
| `/plan <descricao>` | Gera plano de execucao sem executar |
| `/run <workflow> [params]` | Executa um workflow multi-agente |
| `/workflows` | Lista workflows disponíveis |
| `/handoff <de> <para> <tarefa>` | Cria um handoff entre agentes |
| `/agora [mostrar\|captura\|check-in\|fechamento] [conteúdo]` | Memoria operacional viva do dia |
| `/painel <status\|commit\|push\|pull> [mensagem]` | Opera o Git do Boris Painel pelo workspace oficial dentro do AgentOS |
| `/brand-guidelines` | Aplica identidade visual Anthropic |
| `/canvas-design` | Cria arte visual em PDF/PNG |
| `/doc-coauthoring` | Criação colaborativa de documentos |
| `/docx` | Documentos Word (.docx) |
| `/pptx` | Apresentações PowerPoint (.pptx) |
| `/xlsx` | Planilhas Excel (.xlsx, .csv) |
| `/pdf` | Processamento de PDFs |
| `/frontend-design` | Interfaces frontend production-grade |
| `/theme-factory` | Temas profissionais para artefatos |
| `/web-artifacts` | Artefatos web React/TS bundled |
| `/mcp-builder` | Construção de servidores MCP |

Todos os nomes (spaces, areas, agentes, times, skills) devem seguir o padrao **kebab-case**.

---

## Hooks de Enforcement

O AgentOS possui hooks automaticos que enforcam os protocolos do sistema:

- **Guardrails (PreToolUse)** — Bloqueia writes em arquivos protegidos do sistema (protocolos, scripts, definicoes de agentes, settings, secrets)
- **Enforcement (PostToolUse)** — Rastreia mudancas estruturais e monitora cumprimento do checklist de manutencao
- **Validation (Stop)** — Verifica ao final da sessao se o checklist de manutencao foi cumprido

Scripts em `system/scripts/hooks/`. Configuração em `.Codex/settings.json`.

---

## Sync de Runtimes

O AgentOS garante que `.Codex/` e `.gemini/` permanecem sincronizados:

- **Protocolo:** `system/protocols/sync.md` define quando e como sincronizar
- **Script:** `system/scripts/sync.py` detecta drift e corrige automaticamente
- **Hooks:** PostToolUse avisa quando KERNEL.md, agents ou commands sao alterados

```bash
python3.14 system/scripts/sync.py        # Relatorio de drift
python3.14 system/scripts/sync.py --fix  # Correcao automatica
python3.14 system/scripts/sync.py --json # Output JSON
```

---

## Documentacao

A documentacao completa esta em `docs/`:

| Arquivo | Conteudo |
|---|---|
| [`docs/manual-de-bolso.md`](docs/manual-de-bolso.md) | Guia de consulta rapida: o que pedir, por onde comecar e como se orientar no AgentOS |
| [`docs/overview.md`](docs/overview.md) | Visao geral do AgentOS |
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura detalhada do sistema |
| [`docs/getting-started.md`](docs/getting-started.md) | Tutorial passo a passo |
| [`docs/system-agents.md`](docs/system-agents.md) | Referencia de cada agente de sistema |
| [`docs/commands.md`](docs/commands.md) | Referencia completa de comandos |
| [`docs/protocols.md`](docs/protocols.md) | Protocolos de comunicacao e memoria |
| [`docs/language.md`](docs/language.md) | Regra global de idioma e qualidade de texto |
| [`docs/creating-projects.md`](docs/creating-projects.md) | Guia de criacao de spaces, areas e agentes |
| [`docs/memory-system.md`](docs/memory-system.md) | Sistema de memoria e escopos |
| [`docs/development-guide.md`](docs/development-guide.md) | Guia de desenvolvimento e extensao |

---

## Versao

**v0.9.0** — Instalado em 2026-03-20 | Atualizado em 2026-03-30

## Capacidade Pessoal Registrada

O AgentOS agora trata o WhatsApp pessoal de Mateus como uma capacidade operacional oficial no space `pessoal`, usando a skill local `send-personal-whatsapp` com perfil padrão `pessoal` e a workspace `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent` como fonte de verdade da integração.
