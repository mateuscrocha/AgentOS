# Protocolos do AgentOS

O AgentOS define quatro protocolos que governam como agentes se comunicam, como a memória é gerenciada e como o sistema é mantido.

---

## Protocolo de Comunicação

**Arquivo:** `system/protocols/communication.md`

**Resumo de regras:** Invocação direta para resultado imediato; handoff para trabalho assíncrono; message bus para broadcast. Agentes de sistema não invocam agentes de usuário diretamente. Agentes de spaces diferentes não se comunicam.


Agentes se comunicam através de três padrões:

### 1. Invocação Direta (síncrona)

Usado quando o resultado é necessário imediatamente no mesmo turno de conversação.

**Como funciona:**
- O agente chamador usa o Agent tool do Claude Code
- O agente invocado executa e retorna o resultado diretamente
- O agente chamador é responsável por salvar o resultado se necessário

**Quem pode chamar quem:**

| De | Para | Permitido? |
|---|---|---|
| Agente de sistema | Agente de sistema | Sim |
| Agente de usuário | Agente de sistema | Sim |
| Agente de sistema | Agente de usuário | Somente via handoff |
| Agente de usuário | Agente da mesma área | Sim |
| Agente de usuário | Agente do mesmo space (área diferente) | Via handoff de space |
| Agente de usuário | Agente de space diferente | Não |

### 2. Handoff (assíncrono)

Usado para passar trabalho entre agentes, especialmente de escopos diferentes.

**Hierarquia de arquivos de handoff:**

| Escopo | Arquivo |
|---|---|
| Dentro de um time | `spaces/{space}/areas/{area}/teams/{time}/memory/handoff.md` |
| Dentro de uma área | `spaces/{space}/areas/{area}/memory/handoff.md` |
| Dentro de um space (cross-area) | `spaces/{space}/memory/handoff.md` |
| Cross-boundary (sistema <> usuário) | `system/memory/handoff.md` |

**Formato de um handoff:**

```markdown
## Handoff: [Agente Origem] → [Agente Destino]
**Data:** YYYY-MM-DD HH:MM
**Prioridade:** Alta / Normal / Baixa
**Status:** Pendente / Em Progresso / Concluído

### Contexto
O que estava sendo feito e por que o handoff é necessário.

### Tarefa
O que o agente destino deve fazer.

### Inputs
- Arquivo: `caminho/para/arquivo`
- Dado: informação relevante

### Resultado (preenchido pelo destino)
Output produzido pelo agente destino.
```

**Ciclo de vida de um handoff:**
1. Agente A escreve o handoff com `Status: Pendente`
2. Agente B lê e muda para `Status: Em Progresso`
3. Agente B conclui, preenche Resultado e muda para `Status: Concluído`
4. Agente A lê o resultado
5. O `memory-manager` remove handoffs concluídos no cleanup

### 3. Message Bus (eventos broadcast)

Usado para comunicar eventos que múltiplos agentes podem querer saber.

**Arquivo:** `system/memory/bus.md`

**Formato:**

```markdown
| Timestamp | Origem | Evento | Escopo | Dados |
|---|---|---|---|---|
| 2026-03-20 10:00 | agent-manager | agent.created | space:meu-space:area:backend | {agent: "analista"} |
```

**Eventos padrão do sistema:**

| Evento | Quando ocorre |
|---|---|
| `space.created` | Novo space criado |
| `area.created` | Nova área criada |
| `agent.created` | Novo agente criado |
| `agent.evolved` | Agente atualizado |
| `agent.deprecated` | Agente desativado |
| `team.created` | Novo time criado |
| `team.member.added` | Membro adicionado ao time |
| `team.member.removed` | Membro removido do time |
| `skill.created` | Nova skill criada |
| `memory.cleaned` | Memória limpa pelo garbage collector |
| `docs.generated` | Documentação gerada/atualizada |

### 4. Descoberta de agentes

Agentes descobrem uns aos outros através de:
- `system/agents/agent-manager/memory/registry.md` — registro mestre de todos os agentes
- `spaces/{space}/SPACE.md` — lista de áreas do space
- `spaces/{space}/areas/{area}/AREA.md` — lista de agentes e times da área
- `spaces/{space}/areas/{area}/teams/{time}/TEAM.md` — lista de membros do time

---

## Protocolo de Handoff

**Arquivo:** `system/protocols/handoff.md`

**Resumo de regras:** Um handoff por entrada; usar o `handoff.md` do escopo mais específico; status obrigatório (Pendente → Em Progresso → Concluído); agente destino deve preencher a seção Resultado; handoffs concluídos são removidos pelo memory-manager.

Complementa o protocolo de comunicação com regras específicas para handoffs.

### Regras

1. **Um handoff por entrada** — cada bloco `## Handoff:` é uma tarefa independente
2. **Escopo correto** — use o arquivo `handoff.md` do escopo mais específico possível
3. **Status obrigatório** — todo handoff deve ter um status explícito
4. **Resultado obrigatório** — o agente destino deve preencher a seção Resultado ao concluir
5. **Cleanup** — handoffs concluídos são removidos periodicamente pelo `memory-manager`

### Fluxo visual

```
Agente A                    handoff.md                  Agente B
   │                            │                           │
   ├── escreve handoff ────────►│                           │
   │   (Status: Pendente)       │                           │
   │                            │◄── lê handoff ────────────┤
   │                            │    (Status: Em Progresso) │
   │                            │                           │
   │                            │◄── preenche Resultado ────┤
   │                            │    (Status: Concluído)    │
   │◄── lê resultado ──────────│                           │
   │                            │                           │
```

---

## Protocolo de Memória

**Arquivo:** `system/protocols/memory.md`

**Resumo de regras:** Ler própria memória + `world.md` antes de agir; atualizar `history.md`, `world.md` (se mudou) e `bus.md` (se evento) depois; nunca escrever fora do escopo; `world.md` é snapshot (reescrita total); `history.md` e `bus.md` são append-only; incluir seção "Última Alteração" ao atualizar qualquer `world.md`.

Define como a memória é acessada e atualizada por todos os agentes.

### Protocolo de acesso (todo agente deve seguir)

**Antes de agir:**
1. Ler `{agente}/memory/history.md` — contexto pessoal
2. Ler `{escopo}/memory/world.md` — contexto do escopo atual
3. Ler `system/memory/world.md` — contexto global

**Depois de agir:**
1. Atualizar `{agente}/memory/history.md` com a ação realizada
2. Se o estado do escopo mudou → atualizar `{escopo}/memory/world.md`
3. Se precisa transferir trabalho → escrever em `{escopo}/memory/handoff.md`
4. Se é evento relevante → registrar em `system/memory/bus.md`

### Regras de memória

1. **Nunca escreva fora do seu escopo** — um agente de área não escreve em `system/memory/`
2. **Sempre leia antes de escrever** — para não sobrescrever informação de outros agentes
3. **Append, não replace** — ao atualizar `history.md` e `bus.md`, adicione ao final
4. **`world.md` é estado atual** — pode ser reescrito (não é log, é snapshot)
5. **Handoffs concluídos serão removidos** — não dependa deles para persistência
6. **Incluir seção "Última Alteração"** ao atualizar qualquer `world.md`

### Escopos de memória

| Escopo | Localização | Quem lê | Quem escreve |
|---|---|---|---|
| Sistema | `system/memory/` | Todos os agentes | Apenas agentes do sistema |
| Space | `spaces/{space}/memory/` | Agentes do space + sistema | Agentes do space + sistema |
| Área | `spaces/{space}/areas/{area}/memory/` | Agentes da área + sistema | Agentes da área + sistema |
| Time | `spaces/{space}/areas/{area}/teams/{time}/memory/` | Membros do time + sistema | Membros do time + sistema |
| Agente | `{agente}/memory/` | O próprio agente + memory-manager | O próprio agente |

---

## Protocolo de Manutenção

**Arquivo:** `system/protocols/maintenance.md`

**Resumo de regras:** Cleanup quando `bus.md` ultrapassar 50 entradas; atualizar `CHANGELOG.md` apenas para mudanças estruturais; auditar docs após 3+ recursos novos sem auditoria; incluir seção "Última Alteração" ao atualizar qualquer `world.md`.

Define quando e como realizar tarefas de manutenção para manter o AgentOS saudável e rastreável.

### Tarefas de manutenção

| Tarefa | Responsável | Quando |
|---|---|---|
| Limpeza de memória | memory-manager (`cleanup-memory`) | `bus.md` > 50 entradas, ou quando solicitado |
| Atualização do CHANGELOG | Agente que realizou a mudança | Ao criar agentes, spaces, áreas, protocolos ou alterar estrutura do sistema |
| Auditoria de documentação | doc-manager (`audit-docs`) | Após 3+ recursos novos sem auditoria, ou quando solicitado |
| Rotação de históricos | memory-manager | `history.md` > 100 entradas |

### Thresholds de rotação

| Arquivo | Threshold | Ação |
|---|---|---|
| `bus.md` | > 50 entradas | Arquivar para `bus-archive.md`, manter últimas 50 |
| `history.md` | > 100 entradas | Podar, manter últimas 50 |
| `bus-archive.md` | Sem limite | Arquivo permanente |

### CHANGELOG.md

Localizado na raiz do projeto (`CHANGELOG.md`). Segue o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/), em português.

**O que registrar:** Criação de agentes, spaces, áreas, times, skills, protocolos, mudanças na estrutura ou capacidades do sistema.

**O que não registrar:** Operações rotineiras (cleanup, leituras, consultas).

### Seção "Última Alteração" no world.md

Ao reescrever qualquer `world.md`, sempre incluir a seção:

```markdown
## Última Alteração

- **Data:** YYYY-MM-DD
- **O que mudou:** Breve descrição
- **Agente:** nome-do-agente
```

---

## Documentação relacionada

- [Sistema de memória](memory-system.md) — tipos de arquivo e escopos detalhados
- [Agentes do sistema](system-agents.md) — memory-manager e team-manager
- [Arquitetura](architecture.md) — visão geral da estrutura
- [Guia de desenvolvimento](development-guide.md) — como manter o sistema
