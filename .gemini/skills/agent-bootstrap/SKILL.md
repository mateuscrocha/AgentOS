---
name: agent-bootstrap
description: Skill do sistema para bootstrapar novos agentes do usuário, criando toda a estrutura de arquivos e registros
---

# Agent Bootstrap

Skill interna do sistema para criar a estrutura completa de um novo agente do usuário.

## Processo

1. Receber parâmetros: `space_name`, `area_name`, `agent_name` (e opcionalmente `team_name`)
2. Determinar caminho base:
   - Se `team_name` fornecido: `spaces/{space_name}/areas/{area_name}/teams/{team_name}/agents/{agent_name}/`
   - Senão: `spaces/{space_name}/areas/{area_name}/agents/{agent_name}/`
3. Criar diretório no caminho base
4. Criar subdiretórios: `memory/`, `skills/`
5. Copiar template de `system/templates/agent/AGENT.md.template` para `AGENT.md`
6. Substituir placeholders no template
7. Criar `memory/history.md` vazio com header
8. Criar adapters de runtime (dual-write):
   - `.claude/agents/{namespace}.md` — frontmatter com name, description, model, color + corpo com persona e referência ao AGENT.md
   - `.gemini/agents/{namespace}.md` — frontmatter com name, description + corpo com persona e referência ao AGENT.md
   - Namespace:
     - Agente de area: `{space_name}--{area_name}--{agent_name}.md`
     - Agente de team: `{space_name}--{area_name}--{team_name}--{agent_name}.md`
9. Atualizar `system/agents/agent-manager/memory/registry.md` com novo agente
10. Atualizar `AREA.md` (ou `TEAM.md`) com novo agente
11. Registrar evento `agent.created` em `system/memory/bus.md`
