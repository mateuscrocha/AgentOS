# Protocolo de Handoff — AgentOS

## Resumo de Regras

1. Um handoff por entrada — cada bloco é uma tarefa independente
2. Usar o handoff.md do escopo mais específico possível
3. Status obrigatório: Pendente → Em Progresso → Concluído
4. Agente destino DEVE preencher a seção Resultado ao concluir
5. Handoffs concluídos são removidos pelo memory-manager (cleanup)

---

## Definição

Handoff é a transferência formal de uma tarefa de um agente para outro. É o mecanismo principal de comunicação assíncrona no AgentOS.

---

## Regras

1. **Um handoff por entrada** — cada bloco `## Handoff:` é uma tarefa independente
2. **Escopo correto** — use o handoff.md do escopo mais específico possível:
   - Dentro de um time → `spaces/{space}/areas/{area}/teams/{team}/memory/handoff.md`
   - Dentro de uma area → `spaces/{space}/areas/{area}/memory/handoff.md`
   - Dentro de um space → `spaces/{space}/memory/handoff.md`
   - Cross-boundary → `system/memory/handoff.md`
3. **Status obrigatório** — todo handoff deve ter um status explícito
4. **Resultado obrigatório** — o agente destino DEVE preencher a seção Resultado ao concluir
5. **Cleanup** — handoffs concluídos são removidos periodicamente pelo memory-manager

---

## Formato

```markdown
## Handoff: [Nome do Agente Origem] → [Nome do Agente Destino]
**Data:** YYYY-MM-DD HH:MM
**Prioridade:** Alta / Normal / Baixa
**Status:** Pendente / Em Progresso / Concluído

### Contexto
Descrição do que estava sendo feito e por que este handoff é necessário.

### Tarefa
Descrição clara e específica do que o agente destino deve fazer.

### Inputs
- Arquivo: `caminho/para/arquivo`
- Dado: informação relevante

### Resultado (preenchido pelo destino)
Output produzido pelo agente destino.
```

---

## Status

| Status | Significado |
|---|---|
| **Pendente** | Handoff criado, aguardando processamento |
| **Em Progresso** | Agente destino iniciou o trabalho |
| **Concluído** | Tarefa finalizada, resultado preenchido |

---

## Fluxo

```
Agente A                    handoff.md                  Agente B
   │                            │                           │
   ├── escreve handoff ────────►│                           │
   │   (Status: Pendente)       │                           │
   │                            │◄── lê handoff ────────────┤
   │                            │    (Status: Em Progresso)  │
   │                            │                           │
   │                            │◄── preenche Resultado ────┤
   │                            │    (Status: Concluído)     │
   │◄── lê resultado ──────────│                           │
   │                            │                           │
```
