---
name: create-agent
description: Cria um novo agente do usuário dentro de uma area ou team existente
agent: agent-manager
version: 3.0
---

# Skill: create-agent

## Inputs

- `space_name`: Nome do space
- `area_name`: Nome da area
- `agent_name`: Nome do novo agente (kebab-case)
- `team_name` (opcional): Nome do time

## Processo

1. **Validar** que a area existe e que o nome do agente é único no escopo
2. **Consultar** `memory/standards.md` para padrões de criação
3. **Determinar** caminho base (area ou team) e criar diretório com subdiretórios `memory/` e `skills/`
4. **Aplicar** template `system/templates/agent/AGENT.md.template` — substituir placeholders conforme template
5. **Perguntar ao usuário** sobre persona, capacidades e regras para preencher o AGENT.md
6. **Criar** `memory/history.md` com header inicial
7. **Criar adapters de runtime** (dual-write):
   - `.claude/agents/{namespace}.md` — com metadata (name, description, model, color) + referência ao AGENT.md + protocolo de init
   - `.gemini/agents/{namespace}.md` — com metadata (name, description) + referência ao AGENT.md + protocolo de init
   - Namespace: `{space}--{area}--{agent}` ou `{space}--{area}--{team}--{agent}`
8. **Finalizar:** atualizar `registry.md`, `AREA.md` (ou `TEAM.md`), registrar `agent.created` em `bus.md`, atualizar `history.md`

## Output

Confirmação com caminho do agente, caminhos de runtime (`.claude/agents/` e `.gemini/agents/`) e registro atualizado
