---
name: init-memory
description: Inicializa memória para um novo recurso (agente, space, area ou time)
agent: memory-manager
version: 2.0
---

# Skill: init-memory

## O que esta skill faz

Cria e inicializa os arquivos de memória para um novo recurso no AgentOS.

## Inputs

- `resource_type`: Tipo do recurso (`agent`, `space`, `area`, `team`)
- `resource_path`: Caminho base do recurso (ex: `spaces/meu-space/areas/backend/agents/meu-agente`)
- `resource_name`: Nome do recurso

## Processo por Tipo

### Para Agente (`agent`):
1. Criar `{resource_path}/memory/` se não existir
2. Criar `{resource_path}/memory/history.md` com header:
   ```markdown
   # Histórico — {resource_name}

   | Data | Ação | Detalhes |
   |---|---|---|
   | {data_atual} | agent.created | Agente inicializado |
   ```
3. Atualizar `memory-map.md` com nova entrada

### Para Space (`space`):
1. Criar `{resource_path}/memory/` se não existir
2. Criar `{resource_path}/memory/world.md` com estado inicial
3. Criar `{resource_path}/memory/handoff.md` com header
4. Atualizar `memory-map.md` com novas entradas

### Para Area (`area`):
1. Criar `{resource_path}/memory/` se não existir
2. Criar `{resource_path}/memory/world.md` com estado inicial
3. Criar `{resource_path}/memory/handoff.md` com header
4. Atualizar `memory-map.md` com novas entradas

### Para Time (`team`):
1. Criar `{resource_path}/memory/` se não existir
2. Criar `{resource_path}/memory/world.md` com estado inicial do time
3. Criar `{resource_path}/memory/handoff.md` com header
4. Atualizar `memory-map.md` com novas entradas

## Output

Confirmação dos arquivos criados e memory-map atualizado.
