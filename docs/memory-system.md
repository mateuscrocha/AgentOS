# Sistema de Memória

O sistema de memória do AgentOS é baseado em arquivos markdown. Toda a memória é persistida em arquivos texto com estrutura definida, seguindo regras rígidas de escopo.

---

## Conceito fundamental

A memória no AgentOS funciona como uma hierarquia de contextos:

```
system/memory/world.md          ← Estado global (todos leem)
    └── spaces/{space}/memory/world.md    ← Estado do space
            └── spaces/{space}/areas/{area}/memory/world.md  ← Estado da área
                    └── spaces/{space}/areas/{area}/teams/{time}/memory/world.md  ← Estado do time
                            └── {agente}/memory/history.md         ← Histórico do agente
```

Cada agente lê do mais específico ao mais geral antes de agir.

---

## Escopos de memória

| Escopo | Localização | Quem lê | Quem escreve |
|---|---|---|---|
| Sistema | `system/memory/` | Todos os agentes | Apenas agentes do sistema |
| Space | `spaces/{space}/memory/` | Agentes do space + sistema | Agentes do space + sistema |
| Área | `spaces/{space}/areas/{area}/memory/` | Agentes da área + sistema | Agentes da área + sistema |
| Time | `spaces/{space}/areas/{area}/teams/{time}/memory/` | Membros do time + sistema | Membros do time + sistema |
| Agente | `{agente}/memory/` | O próprio agente + memory-manager | O próprio agente |

**Regra crítica:** Um agente nunca escreve fora do seu escopo. Um agente de área não pode escrever em `system/memory/`.

---

## Tipos de arquivo de memória

### world.md

**Propósito:** Estado atual do escopo. É um snapshot — não um log.

**Quem lê:** Todos os agentes do escopo, ao iniciar qualquer tarefa.

**Quem escreve:** Qualquer agente do escopo, ao mudar estado relevante.

**Comportamento:** Pode ser reescrito completamente — contém o estado atual, não histórico.

**Onde existe:**
- `system/memory/world.md` — estado global do OS
- `spaces/{space}/memory/world.md` — estado do space
- `spaces/{space}/areas/{area}/memory/world.md` — estado da área
- `spaces/{space}/areas/{area}/teams/{time}/memory/world.md` — estado do time

**Regra obrigatória:** Ao reescrever qualquer `world.md`, sempre incluir a seção `## Última Alteração` com a data, o que mudou e o agente responsável. Isso é exigido pelo protocolo de manutenção (`system/protocols/maintenance.md`).

**Exemplo de conteúdo (`system/memory/world.md`):**
```markdown
# AgentOS — Estado Global

## Sistema
- Versão: 0.1.0
- Status: Ativo

## Agentes do Sistema
| Agente | Status |
|---|---|
| agent-manager | Ativo |

## Spaces
Nenhum space criado ainda.

## Última Alteração

- **Data:** 2026-03-20
- **O que mudou:** Descrição breve da mudança
- **Agente:** nome-do-agente
```

---

### handoff.md

**Propósito:** Tarefas transferidas de um agente para outro.

**Quem lê:** Agentes do escopo, especialmente o agente destino.

**Quem escreve:** Qualquer agente que precise transferir trabalho.

**Comportamento:** Entradas são adicionadas (append). O `memory-manager` remove handoffs com `Status: Concluído` no cleanup periódico.

**Onde existe:**
- `system/memory/handoff.md` — cross-boundary e entre agentes de sistema
- `spaces/{space}/memory/handoff.md` — cross-area (entre áreas do mesmo space)
- `spaces/{space}/areas/{area}/memory/handoff.md` — entre agentes da mesma área
- `spaces/{space}/areas/{area}/teams/{time}/memory/handoff.md` — dentro de um time

**Formato de entrada:**
```markdown
## Handoff: [Origem] → [Destino]
**Data:** YYYY-MM-DD HH:MM
**Prioridade:** Alta / Normal / Baixa
**Status:** Pendente

### Contexto
...

### Tarefa
...

### Resultado (preenchido pelo destino)
...
```

---

### history.md

**Propósito:** Log cronológico de ações do agente. É o diário do agente.

**Quem lê:** O próprio agente (para contexto antes de agir) e o `memory-manager`.

**Quem escreve:** Apenas o próprio agente.

**Comportamento:** Só adiciona ao final (append). Nunca substituir entradas.

**Onde existe:** `{agente}/memory/history.md`

**Formato de entrada:**
```markdown
| Data | Ação | Detalhes |
|---|---|---|
| 2026-03-20 | agent.created | Agente inicializado |
| 2026-03-20 | tarefa.concluida | Descrição do que foi feito |
```

---

### bus.md

**Propósito:** Log de eventos broadcast do sistema. Qualquer agente pode publicar; qualquer agente pode ler.

**Quem lê:** Qualquer agente que queira se atualizar sobre o que aconteceu no sistema.

**Quem escreve:** Agentes do sistema ao registrar eventos relevantes.

**Comportamento:** Só adiciona ao final (append). O `memory-manager` pode arquivar entradas antigas.

**Onde existe:** `system/memory/bus.md` (único arquivo, escopo global)

**Formato:**
```markdown
| Timestamp | Origem | Evento | Escopo | Dados |
|---|---|---|---|---|
| 2026-03-20 10:00 | agent-manager | space.created | system | {space: "meu-space"} |
| 2026-03-20 10:05 | agent-manager | area.created | space:meu-space | {area: "backend"} |
```

---

### registry.md / skill-registry.md / team-registry.md

**Propósito:** Registros mestres mantidos pelos agentes de sistema.

**Quem lê:** Qualquer agente que precise descobrir recursos (agentes, skills, times).

**Quem escreve:** Apenas o agente de sistema responsável pelo registro.

**Onde existe:**
- `system/agents/agent-manager/memory/registry.md` — todos os agentes
- `system/agents/skill-manager/memory/skill-registry.md` — todas as skills
- `system/agents/team-manager/memory/team-registry.md` — todos os times
- `system/agents/doc-manager/memory/doc-registry.md` — todos os documentos gerados
- `system/agents/memory-manager/memory/memory-map.md` — mapa de toda a memória

---

## Mapa de memória atual

O `memory-manager` mantém um mapa completo de todos os locais de memória em `system/agents/memory-manager/memory/memory-map.md`.

### Memória do sistema

| Arquivo | Tipo | Propósito |
|---|---|---|
| `system/memory/world.md` | world | Estado global do OS |
| `system/memory/handoff.md` | handoff | Handoffs cross-boundary |
| `system/memory/bus.md` | bus | Log de eventos do sistema |

### Memória dos agentes do sistema

| Agente | Arquivo | Tipo |
|---|---|---|
| agent-manager | `memory/registry.md` | registry |
| agent-manager | `memory/standards.md` | reference |
| agent-manager | `memory/history.md` | history |
| skill-manager | `memory/skill-registry.md` | registry |
| skill-manager | `memory/history.md` | history |
| memory-manager | `memory/memory-map.md` | reference |
| memory-manager | `memory/history.md` | history |
| team-manager | `memory/team-registry.md` | registry |
| team-manager | `memory/history.md` | history |
| doc-manager | `memory/doc-registry.md` | registry |
| doc-manager | `memory/history.md` | history |

---

## Protocolo de acesso (obrigatório para todos os agentes)

### Antes de agir

```
1. Ler {agente}/memory/history.md
2. Ler {escopo}/memory/world.md
3. Ler system/memory/world.md
```

### Depois de agir

```
1. Atualizar {agente}/memory/history.md
2. Se estado mudou → atualizar {escopo}/memory/world.md
3. Se precisa passar trabalho → escrever em {escopo}/memory/handoff.md
4. Se evento relevante → registrar em system/memory/bus.md
```

---

## Gerenciamento de memória

O `memory-manager` é o agente responsável por:

- **Inicializar** memória para novos recursos (agentes, spaces, áreas, times) ao serem criados
- **Limpar** handoffs concluídos periodicamente
- **Arquivar** históricos antigos quando ficam grandes
- **Auditar** violações de escopo
- **Manter** o `memory-map.md` atualizado

Para operações de limpeza, use:
```
"limpe a memória do space {nome}"
"limpe a memória da área {nome} do space {space}"
"arquive o histórico do agente {nome}"
```

---

## Documentação relacionada

- [Protocolos](protocols.md) — protocolo de memória detalhado
- [Agentes do sistema](system-agents.md) — memory-manager
- [Arquitetura](architecture.md) — estrutura de diretórios
