---
name: evolve-agent
description: Evolui um agente existente — atualiza persona, capacidades, regras ou skills
agent: agent-manager
version: 2.0
---

# Skill: evolve-agent

## O que esta skill faz

Atualiza um agente existente, melhorando sua persona, capacidades, regras ou adicionando novas skills.

## Inputs

- `space_name`: Nome do space
- `area_name`: Nome da area
- `agent_name`: Nome do agente a evoluir
- `team_name` (opcional): Nome do time, se o agente for de um time
- `evolution_type`: Tipo de evolução (persona, capabilities, rules, skills, full)

## Processo

1. **Determinar** caminho base:
   - Se `team_name` fornecido: `spaces/{space}/areas/{area}/teams/{team}/agents/{agent}/`
   - Senão: `spaces/{space}/areas/{area}/agents/{agent}/`
2. **Ler** `{caminho_base}/AGENT.md` (estado atual)
3. **Ler** `{caminho_base}/memory/history.md` (contexto)
4. **Identificar** o que precisa ser evoluído baseado no `evolution_type`
5. **Discutir** com o usuário as mudanças desejadas
6. **Atualizar** o AGENT.md com as novas informações
7. **Incrementar** a versão no frontmatter
8. **Atualizar** `.claude/agents/{namespace}.md` e `.gemini/agents/{namespace}.md` se a descrição mudou
9. **Registrar** evento `agent.evolved` em `system/memory/bus.md`
10. **Atualizar** `memory/history.md` com a evolução

## Output

Confirmação com:
- O que foi alterado
- Versão anterior → nova versão
- Resumo das mudanças
