# Protocolo de Comunicação — AgentOS

## Resumo de Regras

1. Invocação direta (subagente) para resultado imediato no mesmo turno
2. Handoff (arquivo handoff.md) para trabalho assíncrono entre agentes
3. Message bus (bus.md) para broadcast de eventos do sistema
4. Agentes de sistema NÃO invocam agentes de usuário diretamente — usar handoff
5. Agentes de usuário de spaces diferentes NÃO se comunicam
6. Descoberta de agentes via `registry.md` do agent-manager

---

## Visão Geral

Agentes no AgentOS se comunicam através de três padrões:

1. **Invocação Direta** — síncrona, via invocação de subagente
2. **Handoff** — assíncrona, via arquivo handoff.md
3. **Message Bus** — broadcast de eventos via bus.md

---

## 1. Invocação Direta

**Quando usar:** Quando o resultado é necessário imediatamente no mesmo turno de conversação.

**Como funciona:**
- O agente chamador invoca o subagente (Agent tool no Claude Code, @subagent no Gemini CLI)
- O agente invocado executa e retorna o resultado diretamente
- Não há persistência automática — o agente chamador é responsável por salvar o resultado se necessário

**Quem pode chamar quem:**
- Agente de sistema → Agente de sistema: SIM
- Agente de usuário → Agente de sistema: SIM
- Agente de sistema → Agente de usuário: SOMENTE via handoff
- Agente de usuário → Agente de usuário (mesma area): SIM
- Agente de usuário → Agente de usuário (mesmo space, area diferente): SIM via handoff de space
- Agente de usuário → Agente de usuário (space diferente): NÃO

---

## 2. Handoff

**Quando usar:** Para passar trabalho de um agente a outro, especialmente quando são de escopos diferentes.

Para formato completo, hierarquia de arquivos e ciclo de vida, ver `system/protocols/handoff.md`.

---

## 3. Message Bus

**Quando usar:** Para broadcast de eventos que múltiplos agentes podem querer saber.

**Arquivo:** `system/memory/bus.md`

**Formato:**

```markdown
| Timestamp | Origem | Evento | Escopo | Dados |
|---|---|---|---|---|
| YYYY-MM-DD HH:MM | agent-manager | agent.created | space:meu-space:area:backend | {agent: "nome"} |
```

**Eventos padrão:**
- `agent.created` — novo agente criado
- `agent.evolved` — agente atualizado
- `agent.deprecated` — agente desativado
- `space.created` — novo space criado
- `area.created` — nova area criada
- `team.created` — novo time criado
- `team.member.added` — membro adicionado ao time
- `team.member.removed` — membro removido do time
- `skill.created` — nova skill criada
- `memory.cleaned` — memória limpa pelo garbage collector
- `health.checked` — diagnóstico de saúde executado
- `workflow.started` — workflow multi-agente iniciado
- `workflow.completed` — workflow multi-agente concluído com sucesso
- `workflow.failed` — workflow multi-agente falhou em um passo

---

## 4. Descoberta de Agentes

Agentes descobrem uns aos outros através de:
- `system/agents/agent-manager/memory/registry.md` — registro mestre de TODOS os agentes
- `spaces/{space}/SPACE.md` — lista areas do space
- `spaces/{space}/areas/{area}/AREA.md` — lista agentes e times da area
- `spaces/{space}/areas/{area}/teams/{team}/TEAM.md` — lista membros do time
