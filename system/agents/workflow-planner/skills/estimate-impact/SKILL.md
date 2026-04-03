---
name: estimate-impact
description: Lista arquivos e diretórios que serão criados ou modificados pela execução de um plano
agent: workflow-planner
version: 1.0
---

# Skill: estimate-impact

## O que esta skill faz

Analisa um plano de execução e lista todos os arquivos e diretórios que serão criados ou modificados, permitindo ao usuário avaliar o impacto antes de aprovar.

## Quando usar

- Como parte do plan-action (chamada automaticamente)
- Quando o usuário quer entender o impacto de um workflow antes de executar

## Inputs

- `$STEPS`: Lista de passos do plano com agentes e ações

## Processo

1. **Para cada passo do plano:**
   - Inferir quais arquivos/diretórios serão criados baseado na skill invocada
   - Ex: `create-space "meu-space"` → cria `spaces/meu-space/`, `spaces/meu-space/SPACE.md`, `spaces/meu-space/memory/`
   - Ex: `create-agent "x"` → cria diretório do agente, AGENT.md, memory/, `.claude/agents/`

2. **Inferir registros atualizados:**
   - Cada criação de agente → atualiza registry.md
   - Cada criação de skill → atualiza skill-registry.md
   - Cada criação de time → atualiza team-registry.md
   - Toda operação → atualiza bus.md e world.md

3. **Compilar lista** organizada por tipo:
   - Diretórios novos
   - Arquivos novos
   - Arquivos modificados

## Output

```markdown
### Impacto Estimado

**Diretórios novos:** X
- spaces/meu-space/
- spaces/meu-space/memory/
- ...

**Arquivos novos:** X
- spaces/meu-space/SPACE.md
- ...

**Registros atualizados:** X
- system/agents/agent-manager/memory/registry.md
- system/memory/world.md
- system/memory/bus.md
```
