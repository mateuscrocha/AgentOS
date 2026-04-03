---
name: check-health
description: Scan completo de integridade do sistema — verifica consistência entre registros e filesystem
agent: health-monitor
version: 1.0
---

# Skill: check-health

## O que esta skill faz

Executa um diagnóstico completo do AgentOS, verificando se o estado real do filesystem corresponde ao que os registros dizem.

## Quando usar

- Quando o usuário executa `/health`
- Quando o kernel inclui resumo de saúde no `/status`
- Após múltiplas operações estruturais (criação de agentes, spaces, etc.)

## Processo

1. **Ler registros mestres:**
   - `system/agents/agent-manager/memory/registry.md` — lista de agentes
   - `system/agents/skill-manager/memory/skill-registry.md` — lista de skills
   - `system/agents/team-manager/memory/team-registry.md` — lista de times
   - `system/agents/memory-manager/memory/memory-map.md` — mapa de memória

2. **Verificar agentes (sistema + usuário):**
   - Para cada agente no registry.md:
     - Verificar se o diretório do agente existe
     - Verificar se AGENT.md existe e é válido
     - Verificar se `memory/` existe
     - Verificar se `.claude/agents/{nome}.md` e `.gemini/agents/{nome}.md` existem e apontam para o AGENT.md correto
   - Para cada arquivo em `.claude/agents/*.md` e `.gemini/agents/*.md`:
     - Verificar se o agente correspondente existe no registry.md
     - Verificar consistência entre os dois diretórios de runtime

3. **Verificar skills:**
   - Para cada skill no skill-registry.md:
     - Verificar se o diretório da skill existe
     - Verificar se SKILL.md existe

4. **Verificar times:**
   - Para cada time no team-registry.md:
     - Verificar se o diretório do time existe
     - Verificar se TEAM.md existe
     - Verificar se membros listados existem como agentes

5. **Verificar memória:**
   - Contar entradas em `system/memory/bus.md` — alertar se > 50
   - Para cada `history.md` encontrado — alertar se > 100 entradas
   - Verificar se todos os `world.md` têm seção "Última Alteração"

6. **Verificar handoffs** (invocar skill `check-handoffs`)

7. **Compilar resultados** e invocar skill `generate-report`

8. **Criar handoffs** para agentes responsáveis se problemas encontrados

9. **Registrar** evento `health.checked` em `system/memory/bus.md`

10. **Atualizar** próprio `history.md`

## Output

Relatório de saúde com categorias:
- OK: Verificações que passaram
- WARN: Problemas menores (thresholds próximos)
- ERROR: Inconsistências que precisam de correção
