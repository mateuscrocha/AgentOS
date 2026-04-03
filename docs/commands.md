# Referência de Comandos

O AgentOS é controlado por comandos que começam com `/`. O kernel (`CLAUDE.md`) intercepta esses comandos e os roteia para os agentes ou ações corretas.

---

## `/setup`

**Ação:** Executa o bootstrap do sistema (primeira vez)
**Agente:** kernel

Inicializa o AgentOS, verificando que a estrutura de diretórios do sistema está correta e todos os agentes de sistema estão registrados.

**Uso:**
```
/setup
```

**Quando usar:** Somente na primeira vez que o sistema é configurado, ou após uma reinstalação.

---

## `/new-space <nome>`

**Ação:** Cria um novo space do usuário
**Agente:** agent-manager (skill: create-space)

Cria a estrutura completa de um novo space em `spaces/{nome}/`, incluindo diretórios, memória inicial e registro no sistema.

**Uso:**
```
/new-space meu-space
/new-space analise-dados
/new-space automacao-vendas
```

**Resultado:**
```
spaces/{nome}/
├── SPACE.md
├── memory/
│   ├── world.md
│   └── handoff.md
└── areas/
```

**Regras:**
- Nome deve ser kebab-case (letras minúsculas e hífens)
- Nome deve ser único (não pode existir outro space com o mesmo nome)

---

## `/new-area <space> <nome>`

**Ação:** Cria uma nova área dentro de um space
**Agente:** agent-manager (skill: create-area)

Cria a estrutura completa de uma área em `spaces/{space}/areas/{nome}/`, incluindo diretórios para agentes, times e memória.

**Uso:**
```
/new-area meu-space backend
/new-area meu-space frontend
/new-area analise-dados coleta
```

**Resultado:**
```
spaces/{space}/areas/{nome}/
├── AREA.md
├── memory/
│   ├── world.md
│   └── handoff.md
├── agents/
└── teams/
```

**Regras:**
- O space deve existir antes de criar a área
- Nome deve ser kebab-case
- Nome deve ser único dentro do space

---

## `/new-agent <space> <area> <nome>`

**Ação:** Cria um novo agente dentro de uma área
**Agente:** agent-manager (skill: create-agent)

Cria a estrutura completa de um agente em `spaces/{space}/areas/{area}/agents/{nome}/` e o arquivo de integração `.claude/agents/{space}--{area}--{nome}.md`.

**Uso:**
```
/new-agent meu-space backend analista
/new-agent meu-space backend executor
/new-agent analise-dados coleta coletor-dados
```

**Resultado:**
```
spaces/{space}/areas/{area}/agents/{nome}/
├── AGENT.md
├── memory/
│   └── history.md
└── skills/

.claude/agents/{space}--{area}--{nome}.md
```

**Regras:**
- O space e a área devem existir antes de criar o agente
- Nome deve ser kebab-case
- Nome deve ser único dentro da área
- O agent-manager perguntará sobre persona e capacidades durante a criação

---

## `/new-team <space> <area> <nome>`

**Ação:** Cria um novo time dentro de uma área
**Agente:** team-manager (skill: create-team)

Cria a estrutura de um time em `spaces/{space}/areas/{area}/teams/{nome}/`, com memória compartilhada e configuração de comunicação.

**Uso:**
```
/new-team meu-space backend time-analise
/new-team analise-dados coleta squad-coleta
```

**Resultado:**
```
spaces/{space}/areas/{area}/teams/{nome}/
├── TEAM.md
└── memory/
    ├── world.md
    └── handoff.md
```

**Regras:**
- O space e a área devem existir
- Todo time precisa de um agente líder
- Membros do time devem ser agentes existentes na área

---

## `/new-skill <space/area/agente> <nome>`

**Ação:** Cria uma nova skill para um agente
**Agente:** skill-manager

Cria a definição de uma nova skill em `spaces/{space}/areas/{area}/agents/{agente}/skills/{nome}/SKILL.md`.

**Uso:**
```
/new-skill meu-space/backend/analista analisar-dados
/new-skill meu-space/backend/executor gerar-relatorio
```

**Resultado:**
```
spaces/{space}/areas/{area}/agents/{agente}/skills/{nome}/
└── SKILL.md
```

**Processo:** O skill-manager usa o `skill-creator` (skill global) para guiar a criação com entrevista, draft, testes e avaliação.

---

## `/status`

**Ação:** Mostra visão geral do sistema
**Agente:** kernel

Exibe o estado atual do AgentOS, incluindo:
- Versão e status do sistema
- Agentes de sistema e seus status
- Spaces criados
- Áreas e times ativos
- Estatísticas gerais

**Uso:**
```
/status
```

---

## `/handoff <de> <para> <tarefa>`

**Ação:** Cria um handoff entre agentes
**Agente:** kernel

Registra uma transferência formal de tarefa de um agente para outro, escrevendo no arquivo `handoff.md` do escopo correto.

**Uso:**
```
/handoff analista executor "processar os dados analisados"
/handoff agent-manager memory-manager "inicializar memória do novo space"
```

**Escopo do handoff:**
- Agentes do mesmo time → `spaces/{space}/areas/{area}/teams/{time}/memory/handoff.md`
- Agentes da mesma área → `spaces/{space}/areas/{area}/memory/handoff.md`
- Agentes do mesmo space (áreas diferentes) → `spaces/{space}/memory/handoff.md`
- Cross-boundary (sistema <> usuário) → `system/memory/handoff.md`

---

## Convenções de nomes

Todos os nomes de spaces, áreas, agentes, times e skills devem seguir o padrão **kebab-case**:

| Correto | Incorreto |
|---|---|
| `meu-space` | `MeuSpace` |
| `analista-dados` | `analista_dados` |
| `time-pesquisa` | `TimePesquisa` |
| `gerar-relatorio` | `gerarRelatorio` |

---

## Documentação relacionada

- [Começando com o AgentOS](getting-started.md) — tutorial passo a passo
- [Criando spaces, áreas e agentes](creating-projects.md) — guia detalhado
- [Agentes do sistema](system-agents.md) — quem executa cada comando
