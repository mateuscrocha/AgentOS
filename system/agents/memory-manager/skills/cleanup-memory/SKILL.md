---
name: cleanup-memory
description: Limpa memória stale — handoffs concluídos, entradas antigas do bus e históricos extensos
agent: memory-manager
version: 2.0
---

# Skill: cleanup-memory

## O que esta skill faz

Remove dados obsoletos da memória do sistema para manter performance e clareza.

## Processo

1. **Handoffs concluídos**: Ler todos os arquivos `handoff.md` do sistema:
   - `system/memory/handoff.md`
   - `spaces/*/memory/handoff.md`
   - `spaces/*/areas/*/memory/handoff.md`
   - `spaces/*/areas/*/teams/*/memory/handoff.md`
   Para cada handoff com Status: Concluído → remover o bloco

2. **Bus antigo**: Ler `system/memory/bus.md`
   - Manter apenas os últimos 50 eventos
   - Arquivar os restantes em `system/memory/bus-archive.md` (criar se necessário)

3. **Históricos extensos**: Para cada `history.md` com mais de 100 entradas:
   - Manter as últimas 50
   - Registrar que o arquivo foi podado

4. **Atualizar** `memory-map.md` se algum arquivo foi criado/removido
5. **Registrar** evento `memory.cleaned` em `system/memory/bus.md`
6. **Atualizar** próprio `history.md`

## Output

Relatório de limpeza:
- Handoffs removidos: X
- Eventos do bus arquivados: X
- Históricos podados: X
