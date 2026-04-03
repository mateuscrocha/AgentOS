---
description: Cria um handoff entre dois agentes
argument-hint: <agente-origem> <agente-destino> <descrição-da-tarefa>
allowed-tools: Read, Write, Edit, Glob, Grep
---

Parse $ARGUMENTS: origem, destino e descrição da tarefa.

Determine o escopo do handoff.md pelo relacionamento entre agentes:
- Mesmo time → `teams/{time}/memory/handoff.md`
- Mesma area → `areas/{area}/memory/handoff.md`
- Mesmo space → `spaces/{space}/memory/handoff.md`
- Escopos diferentes → `system/memory/handoff.md`

Adicione entrada com formato: Origem, Destino, Data, Prioridade: Normal, Status: Pendente, Contexto, Tarefa, Resultado (pendente).
