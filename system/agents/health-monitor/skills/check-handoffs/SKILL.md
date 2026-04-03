---
name: check-handoffs
description: Detecta handoffs stale (Pendente por muito tempo) em todos os escopos do sistema
agent: health-monitor
version: 1.0
---

# Skill: check-handoffs

## O que esta skill faz

Varre todos os arquivos handoff.md do sistema para detectar handoffs que estão Pendente ou Em Progresso há muito tempo sem resolução.

## Quando usar

- Como parte do check-health (scan completo)
- Quando o usuário quer verificar especificamente o estado dos handoffs

## Processo

1. **Ler todos os handoff.md:**
   - `system/memory/handoff.md`
   - `spaces/*/memory/handoff.md`
   - `spaces/*/areas/*/memory/handoff.md`
   - `spaces/*/areas/*/teams/*/memory/handoff.md`

2. **Para cada handoff encontrado:**
   - Extrair: Origem, Destino, Data, Status, Prioridade
   - Se Status = "Pendente": marcar como stale
   - Se Status = "Em Progresso": marcar como potencialmente travado
   - Se Status = "Concluído": marcar para cleanup (deveria ter sido removido)

3. **Verificar se o agente destino existe** no registry.md
   - Se não existe: marcar como handoff órfão

4. **Compilar lista** de handoffs problemáticos com recomendação de ação

## Output

Lista de handoffs problemáticos:
- Stale (Pendente): X handoffs
- Travados (Em Progresso): X handoffs
- Órfãos (destino inexistente): X handoffs
- Pendentes de cleanup (Concluído não removido): X handoffs
