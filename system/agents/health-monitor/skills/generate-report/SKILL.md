---
name: generate-report
description: Produz relatório estruturado de saúde do sistema em last-report.md
agent: health-monitor
version: 1.0
---

# Skill: generate-report

## O que esta skill faz

Compila os resultados das verificações em um relatório estruturado e salva em `memory/last-report.md`.

## Quando usar

- Ao final de um check-health completo
- Quando o usuário solicita um relatório de saúde

## Processo

1. **Receber resultados** das verificações (check-health, check-handoffs)

2. **Classificar cada item** em:
   - **OK** — Verificação passou sem problemas
   - **WARN** — Problema menor ou threshold próximo do limite
   - **ERROR** — Inconsistência que precisa de correção

3. **Gerar relatório** no formato:

```markdown
# Relatório de Saúde — AgentOS
**Data:** YYYY-MM-DD HH:MM
**Status Geral:** Saudável / Atenção / Crítico

## Resumo
- Verificações OK: X
- Avisos (WARN): X
- Erros (ERROR): X

## Detalhes

### Agentes
| Agente | Status | Detalhe |
|---|---|---|

### Skills
| Skill | Status | Detalhe |
|---|---|---|

### Memória
| Escopo | Status | Detalhe |
|---|---|---|

### Handoffs
| Escopo | Status | Detalhe |
|---|---|---|

## Ações Recomendadas
- [ ] {ação} → {agente responsável}
```

4. **Salvar** em `memory/last-report.md` (sobrescreve o anterior)

5. **Atualizar known-issues.md** com novos problemas encontrados

6. **Apresentar resumo** ao usuário no formato:
   - Uma linha com status geral
   - Contagem de OK/WARN/ERROR
   - Lista de ações recomendadas (se houver)

## Output

Relatório completo salvo em `memory/last-report.md` e resumo apresentado ao usuário.
