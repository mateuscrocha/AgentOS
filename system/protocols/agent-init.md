# Protocolo de Inicialização de Agentes — AgentOS

## Resumo

Todo agente deve seguir este protocolo ao iniciar uma tarefa.

---

## Sequência de Leitura

### Agentes de Sistema

1. Ler `system/agents/{agente}/AGENT.md` — persona, capacidades, regras e skills
2. Ler `system/agents/{agente}/memory/history.md` — contexto pessoal recente
3. Ler arquivos adicionais do agente listados no thin loader (ex: `known-issues.md`, `active-workflows.md`)
4. Ler `system/memory/world.md` — estado global do sistema

### Agentes de Usuário

1. Ler `{caminho_base}/AGENT.md` — persona, capacidades, regras e skills
2. Ler `{caminho_base}/memory/history.md` — contexto pessoal
3. Ler `{escopo}/memory/world.md` — estado do escopo (area ou time)
4. Ler `system/memory/world.md` — estado global
5. Ler guidelines (cascade, do geral ao específico):
   - `spaces/{space}/guidelines/GUIDELINES.md`
   - `spaces/{space}/areas/{area}/guidelines/GUIDELINES.md`
   - (se time) `spaces/{space}/areas/{area}/teams/{team}/guidelines/GUIDELINES.md`
6. Ler documentos listados nos GUIDELINES.md conforme relevância para a tarefa

---

## Após Concluir Tarefa

1. Atualizar `{agente}/memory/history.md` com a ação realizada
2. Se estado do escopo mudou → atualizar `{escopo}/memory/world.md`
3. Se precisa transferir trabalho → escrever em `{escopo}/memory/handoff.md`
4. Se é evento relevante → registrar em `system/memory/bus.md`
5. **Se mudança estrutural** → seguir o **Checklist Obrigatório** em `system/protocols/maintenance.md` (CHANGELOG, docs, registries, scripts)

---

## Acesso a Agentes do Sistema

Qualquer agente pode invocar os agentes de sistema via subagente (Agent tool no Claude Code, @subagent no Gemini CLI):

- **agent-manager** — criar ou evoluir agentes, spaces, areas
- **skill-manager** — criar ou gerenciar skills
- **memory-manager** — operações de memória
- **team-manager** — operações de time
- **doc-manager** — gerar ou atualizar documentação
- **health-monitor** — diagnosticar integridade
- **task-runner** — executar workflows
- **workflow-planner** — planejar execuções

---

## Regras Comuns

1. Seguir o protocolo de memória: `system/protocols/memory.md`
2. Seguir o protocolo de comunicação: `system/protocols/communication.md`
3. Registros relevantes: `system/protocols/maintenance.md` para thresholds
4. Manutenção: ao fazer mudanças estruturais, adicionar entrada no `CHANGELOG.md`
