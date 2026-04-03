# Protocolo de Memória — AgentOS

## Resumo de Regras

1. Ler própria memória + world.md + guidelines antes de agir
2. Atualizar history.md + world.md (se mudou) + bus.md (se evento) depois de agir
3. Nunca escrever fora do seu escopo
4. world.md é snapshot (reescrever); history.md e bus.md são append-only
5. Incluir seção "Última Alteração" ao atualizar world.md
6. Handoffs concluídos serão removidos — não dependa deles para persistência

---

## Visão Geral

A memória no AgentOS é file-based e segue regras rígidas de escopo. Cada agente, time, area, space e o próprio sistema têm seus espaços de memória definidos.

---

## Escopos

| Escopo | Localização | Leitura | Escrita |
|---|---|---|---|
| **Sistema** | `system/memory/` | Todos os agentes | Apenas agentes do sistema |
| **Space** | `spaces/{space}/memory/` | Agentes do space + sistema | Agentes do space + sistema |
| **Area** | `spaces/{space}/areas/{area}/memory/` | Agentes da area + sistema | Agentes da area + sistema |
| **Time** | `spaces/{space}/areas/{area}/teams/{team}/memory/` | Membros do time + sistema | Membros do time + sistema |
| **Agente** | `{agente}/memory/` | O próprio agente + memory-manager | O próprio agente |

---

## Tipos de Arquivo de Memória

### world.md
**Propósito:** Estado atual do escopo. Contexto compartilhado.
**Quem lê:** Todos os agentes do escopo, ao iniciar qualquer tarefa.
**Quem escreve:** Qualquer agente do escopo, ao mudar estado relevante.
**Obrigatório:** Incluir seção `## Última Alteração` ao final com Data, O que mudou e Agente responsável.

### handoff.md
**Propósito:** Tarefas transferidas entre agentes.
**Quem lê:** Agentes do escopo, especialmente o agente destino do handoff.
**Quem escreve:** Qualquer agente que precise transferir trabalho.
**Cleanup:** memory-manager remove handoffs concluídos.

### history.md
**Propósito:** Log cronológico de ações do agente.
**Quem lê:** O próprio agente e o memory-manager.
**Quem escreve:** Apenas o próprio agente.

### bus.md (somente sistema)
**Propósito:** Log de eventos broadcast do sistema.
**Quem lê:** Qualquer agente que queira se atualizar.
**Quem escreve:** Agentes do sistema ao registrar eventos.

### registry.md / skill-registry.md / team-registry.md
**Propósito:** Registros mestres mantidos pelos agentes de sistema.
**Quem lê:** Qualquer agente que precise descobrir recursos.
**Quem escreve:** Apenas o agente de sistema responsável.

---

## Guidelines

Guidelines são documentos de referência escritos por humanos que descrevem processos, padrões e ferramentas.
NÃO são memória de agente — são documentação estável.

### Localização

| Escopo | Localização |
|---|---|
| Space | `spaces/{space}/guidelines/` |
| Area | `spaces/{space}/areas/{area}/guidelines/` |
| Time | `spaces/{space}/areas/{area}/teams/{team}/guidelines/` |

### Regras de Guidelines

1. Guidelines são **somente leitura** para agentes — apenas humanos editam
2. Leitura em cascata: space → area → time (geral → específico)
3. Ler `GUIDELINES.md` primeiro — indica quais documentos existem e cross-references
4. Nível mais específico prevalece em caso de conflito
5. Cross-references listados no GUIDELINES.md devem ser lidos como guidelines locais

---

## Protocolo de Acesso

### Ao iniciar uma tarefa (todo agente deve):
1. Ler `{agente}/memory/history.md` — contexto pessoal
2. Ler `{escopo}/memory/world.md` — contexto do escopo
3. Ler `system/memory/world.md` — contexto global
4. Ler guidelines do escopo (cascade): space → area → time
   - Ler `GUIDELINES.md` de cada nível
   - Ler documentos listados conforme relevância para a tarefa

### Ao concluir uma tarefa (todo agente deve):
1. Atualizar `{agente}/memory/history.md` com a ação realizada
2. Se estado do escopo mudou → atualizar `{escopo}/memory/world.md`
3. Se precisa transferir trabalho → escrever em `{escopo}/memory/handoff.md`
4. Se é evento relevante pro sistema → registrar em `system/memory/bus.md`

---

## Regras

1. **Nunca escreva fora do seu escopo** — um agente de area não escreve em `system/memory/`
2. **Sempre leia antes de escrever** — para evitar sobrescrever informação de outros agentes
3. **Append, não replace** — ao atualizar history.md e bus.md, adicione ao final
4. **world.md é estado atual** — pode ser reescrito (não é log, é snapshot)
5. **Handoffs concluídos serão removidos** — não dependa deles para persistência
