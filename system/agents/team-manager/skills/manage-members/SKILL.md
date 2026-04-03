---
name: manage-members
description: Adiciona ou remove membros de um time existente
agent: team-manager
version: 2.0
---

# Skill: manage-members

## O que esta skill faz

Gerencia a composição de um time — adiciona novos membros ou remove membros existentes.

## Inputs

- `space_name`: Nome do space
- `area_name`: Nome da area
- `team_name`: Nome do time
- `action`: `add` ou `remove`
- `agent_name`: Nome do agente a adicionar/remover

## Processo

### Para adicionar (`add`):
1. **Validar** que o time existe em `spaces/{space}/areas/{area}/teams/{team}/`
2. **Validar** que o agente existe em `spaces/{space}/areas/{area}/agents/{agent}/`
3. **Validar** que o agente não é já membro do time
4. **Atualizar** `spaces/{space}/areas/{area}/teams/{team}/TEAM.md`:
   - Adicionar agente na lista `members` do frontmatter
   - Adicionar linha na tabela de membros
5. **Atualizar** `spaces/{space}/areas/{area}/agents/{agent}/AGENT.md`:
   - Definir campo `team: {team_name}` no frontmatter
   - Adicionar seção de comunicação do time na Matriz de Colaboração
6. **Registrar** evento `team.member.added` em `system/memory/bus.md`
7. **Atualizar** `memory/team-registry.md`
8. **Atualizar** próprio `memory/history.md`

### Para remover (`remove`):
1. **Validar** que o agente é membro do time
2. **Atualizar** TEAM.md — remover da lista e tabela
3. **Atualizar** AGENT.md do agente — limpar campo `team`
4. **Registrar** evento `team.member.removed` em `system/memory/bus.md`
5. **Atualizar** registries e history

## Output

Confirmação da operação com estado atual do time.
