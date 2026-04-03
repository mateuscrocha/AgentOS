# Criando Spaces, Áreas, Agentes, Skills e Times

Este guia detalha como criar cada tipo de recurso no AgentOS, o que acontece por trás dos bastidores e o que você precisa fornecer.

---

## Criando um Space

### Comando

```
/new-space <nome>
```

### O que o agent-manager faz

1. Valida que não existe space com o mesmo nome em `spaces/`
2. Cria o diretório `spaces/{nome}/`
3. Cria os subdiretórios: `areas/`, `memory/`
4. Cria `SPACE.md` a partir do template `system/templates/space/SPACE.md.template`
5. Pergunta ao usuário sobre o propósito do space
6. Cria `memory/world.md` com o estado inicial
7. Cria `memory/handoff.md` com header inicial
8. Atualiza `system/memory/world.md` com o novo space
9. Registra evento `space.created` no bus

### Estrutura criada

```
spaces/{nome}/
├── SPACE.md                ← Metadados: propósito, áreas
├── memory/
│   ├── world.md            ← Estado atual do space
│   └── handoff.md          ← Canal de handoffs cross-area
└── areas/                  ← Áreas do space (vazio inicialmente)
```

### Formato do SPACE.md

```yaml
---
name: {nome}
description: {descrição}
created: YYYY-MM-DD
owner: {usuário}
---
```

Com seções para: Propósito, Áreas, Memória.

---

## Criando uma Área

### Comando

```
/new-area <space> <nome>
```

### O que o agent-manager faz

1. Valida que o space existe em `spaces/{space}/`
2. Valida que não existe área com o mesmo nome no space
3. Cria diretório `spaces/{space}/areas/{nome}/`
4. Cria subdiretórios: `agents/`, `teams/`, `memory/`
5. Cria `AREA.md` a partir do template `system/templates/area/AREA.md.template`
6. Pergunta ao usuário sobre o propósito da área
7. Cria `memory/world.md` com o estado inicial
8. Cria `memory/handoff.md` com header inicial
9. Atualiza `spaces/{space}/SPACE.md` com a nova área
10. Registra evento `area.created` no bus

### Estrutura criada

```
spaces/{space}/areas/{nome}/
├── AREA.md                 ← Metadados: propósito, agentes, times
├── memory/
│   ├── world.md            ← Estado atual da área
│   └── handoff.md          ← Canal de handoffs entre agentes da área
├── agents/                 ← Agentes da área (vazio inicialmente)
└── teams/                  ← Times da área (vazio inicialmente)
```

### Formato do AREA.md

```yaml
---
name: {nome}
space: {space}
description: {descrição}
created: YYYY-MM-DD
---
```

Com seções para: Propósito, Agentes, Times, Memória.

---

## Criando um Agente

### Comando

```
/new-agent <space> <area> <nome>
```

### O que o agent-manager faz

1. Valida que o space e a área existem em `spaces/{space}/areas/{area}/`
2. Valida que não existe agente com o mesmo nome na área
3. Consulta `standards.md` para padrões de criação
4. Cria diretório `spaces/{space}/areas/{area}/agents/{nome}/`
5. Cria subdiretórios `memory/` e `skills/`
6. Cria `AGENT.md` a partir do template `system/templates/agent/AGENT.md.template`
7. Pergunta ao usuário sobre persona, capacidades e regras
8. Cria `memory/history.md` com header inicial
9. Cria `.claude/agents/{space}--{area}--{nome}.md` para integração com Claude Code
10. Atualiza `memory/registry.md` com o novo agente
11. Atualiza `spaces/{space}/areas/{area}/AREA.md` na tabela de agentes
12. Registra evento `agent.created` no bus

### Estrutura criada

```
spaces/{space}/areas/{area}/agents/{nome}/
├── AGENT.md                ← Persona, capacidades, regras, colaboração
├── memory/
│   └── history.md          ← Log de ações do agente
└── skills/                 ← Skills do agente (vazio inicialmente)

.claude/agents/{space}--{area}--{nome}.md  ← Integração Claude Code
```

### Formato do .claude/agents/

O arquivo de integração com Claude Code segue este formato:

```markdown
---
name: {space}--{area}--{nome}
description: [descrição do agente]
model: sonnet
color: green
---
Você é o agente {nome} da área {area} no space {space} do AgentOS.
Antes de agir, leia:
1. spaces/{space}/areas/{area}/agents/{nome}/AGENT.md
2. spaces/{space}/areas/{area}/agents/{nome}/memory/history.md
3. spaces/{space}/areas/{area}/memory/world.md
4. spaces/{space}/memory/world.md
5. system/memory/world.md
```

Isso garante que o agente sempre leia sua memória antes de agir.

### Formato do AGENT.md

O `AGENT.md` criado tem frontmatter YAML e seções obrigatórias:

```yaml
---
name: {nome}
scope: user
space: {space}
area: {area}
team: {time}        (vazio se não for membro de time)
description: {descrição}
version: 1.0
created: YYYY-MM-DD
---
```

Seções obrigatórias: Persona, Capacidades, Matriz de Colaboração, Acesso a Agentes do Sistema, Memória, Skills, Regras.

---

## Criando uma Skill

### Comando

```
/new-skill <space/area/agente> <nome>
```

### O que o skill-manager faz

1. Lê o `skill-creator` (skill global em `system/skills/skill-creator/SKILL.md`)
2. Conduz uma entrevista para definir a skill:
   - O que ela faz?
   - Quando usar?
   - Quais são os inputs?
   - Qual é o processo passo-a-passo?
   - Qual é o output esperado?
3. Gera um draft de `SKILL.md`
4. Valida o formato usando `validate-skill`
5. Registra no `skill-registry.md`
6. Registra evento `skill.created` no bus

### Estrutura criada

```
spaces/{space}/areas/{area}/agents/{agente}/skills/{nome}/
└── SKILL.md
```

### Formato do SKILL.md

```yaml
---
name: {nome}
description: {descrição}
agent: {agente}
space: {space}
area: {area}
version: 1.0
created: YYYY-MM-DD
---
```

Seções obrigatórias: O que esta skill faz, Quando usar, Processo (passo-a-passo), Inputs, Outputs, Regras.

---

## Criando um Time

### Comando

```
/new-team <space> <area> <nome>
```

### O que o team-manager faz

1. Valida que o space e a área existem
2. Verifica que os agentes a serem adicionados existem na área
3. Cria diretório `spaces/{space}/areas/{area}/teams/{nome}/`
4. Cria `TEAM.md` a partir do template `system/templates/team/TEAM.md.template`
5. Define o agente líder
6. Chama `memory-manager` para inicializar memória do time
7. Cria `memory/world.md` e `memory/handoff.md` do time
8. Atualiza `AGENT.md` de cada membro com o campo `team`
9. Atualiza `spaces/{space}/areas/{area}/AREA.md`
10. Registra no `team-registry.md`
11. Registra evento `team.created` no bus

### Estrutura criada

```
spaces/{space}/areas/{area}/teams/{nome}/
├── TEAM.md                 ← Membros, papéis, líder, workflow
└── memory/
    ├── world.md            ← Estado compartilhado do time
    └── handoff.md          ← Handoffs internos ao time
```

### Formato do TEAM.md

```yaml
---
name: {nome}
space: {space}
area: {area}
description: {descrição}
members: [lista de agentes]
lead: {agente líder}
created: YYYY-MM-DD
---
```

Com seções para: Propósito, Membros e Papéis, Protocolo de Comunicação, Workflow.

---

## Adicionando/Removendo membros de um time

### Comandos

Use o `team-manager` diretamente para gerenciar membros:

```
Adicionar: "adicione o agente {nome} ao time {time} da área {area} no space {space}"
Remover: "remova o agente {nome} do time {time} da área {area} no space {space}"
```

O `team-manager` usa a skill `manage-members` para:
- Validar que o agente existe na área
- Atualizar o `TEAM.md`
- Atualizar o `AGENT.md` do agente (campo `team`)
- Registrar evento `team.member.added` ou `team.member.removed` no bus

---

## Evoluindo um agente existente

Para atualizar a persona, capacidades ou regras de um agente existente:

```
"evolva o agente {nome} da área {area} no space {space}"
```

O `agent-manager` usa a skill `evolve-agent` para:
- Ler o `AGENT.md` atual
- Perguntar sobre as mudanças desejadas
- Atualizar o `AGENT.md` preservando o histórico
- Incrementar a versão
- Registrar evento `agent.evolved` no bus

---

## Documentação relacionada

- [Começando com o AgentOS](getting-started.md) — tutorial básico
- [Agentes do sistema](system-agents.md) — quem executa cada operação
- [Guia de desenvolvimento](development-guide.md) — convenções e padrões
- [Comandos](commands.md) — referência de todos os comandos
