---
description: Consulta ou atualiza a memória operacional viva do dia no space pessoal
argument-hint: [mostrar|captura|check-in|fechamento] [conteúdo]
allowed-tools: Read, Write, Edit, Glob, Grep, Agent
---

Use o agente `pessoal--dia--day-manager` via Agent tool.

Antes de qualquer resposta, ele deve ler:
- `spaces/pessoal/areas/dia/memory/agora.md`
- `spaces/pessoal/areas/dia/memory/inbox.md`
- `spaces/pessoal/areas/dia/memory/follow-ups.md`
- `spaces/pessoal/areas/dia/memory/world.md`

Interprete `$ARGUMENTS` assim:
- `mostrar` ou vazio: mostrar o estado vivo atual do dia
- `captura ...`: adicionar a captura em `inbox.md` e refletir impacto em `agora.md` se necessário
- `check-in ...`: atualizar o plano vivo do dia em `agora.md`
- `fechamento ...`: registrar fechamento, pendências e primeiro passo de amanhã em `agora.md`

Regra principal:
- não depender do histórico implícito da conversa para contexto operacional importante do dia a dia
- tratar os arquivos de memória viva como fonte de verdade do estado atual
