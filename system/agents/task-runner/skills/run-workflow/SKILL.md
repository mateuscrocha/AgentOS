---
name: run-workflow
description: Executa um workflow multi-agente — sequencial ou com dependências paralelas
agent: task-runner
version: 1.0
---

# Skill: run-workflow

## O que esta skill faz

Executa um workflow completo, invocando agentes na ordem correta, rastreando progresso e lidando com falhas.

## Quando usar

- Quando o kernel roteia uma operação multi-passo para o task-runner
- Quando o usuário executa `/run <workflow>`
- Quando o workflow-planner produz um plano aprovado pelo usuário

## Inputs

- `$WORKFLOW`: Nome de um workflow salvo em `system/workflows/` OU plano ad-hoc com lista de passos
- `$PARAMS`: Parâmetros do workflow (ex: nome do space, area, agentes)

## Processo

1. **Carregar workflow:**
   - Se é um nome: ler `system/workflows/{nome}.md`
   - Se é plano ad-hoc: usar os passos fornecidos diretamente

2. **Validar pré-condições:**
   - Verificar que todos os agentes referenciados existem
   - Verificar que os parâmetros necessários estão presentes
   - Verificar que não há workflow ativo com o mesmo nome

3. **Registrar início** em `active-workflows.md`:
   ```markdown
   ## Workflow: {nome}-{timestamp}
   **Status:** Em Progresso
   **Passo atual:** 1/{total}
   **Passos:**
   - [ ] Passo 1: {descrição} → {agente}
   - [ ] Passo 2: {descrição} → {agente}
   ```

4. **Executar passos sequencialmente:**
   - Para cada passo:
     a. Verificar se dependências foram concluídas
     b. Invocar o agente alvo via Agent tool com os inputs do passo
     c. Capturar resultado
     d. Atualizar `active-workflows.md` (marcar passo como concluído)
     e. Se o passo falhou: parar, registrar falha, reportar

5. **Passos paralelos** (quando marcados como independentes):
   - Invocar múltiplos agentes simultaneamente via Agent tool
   - Aguardar todos concluírem antes de avançar

6. **Ao concluir com sucesso:**
   - Remover workflow de `active-workflows.md`
   - Registrar em `history.md`
   - Registrar `workflow.completed` em bus.md
   - Reportar resultado ao usuário

7. **Em caso de falha:**
   - Manter workflow em `active-workflows.md` com status "Falhou"
   - Registrar `workflow.failed` em bus.md
   - Reportar ponto de falha e sugerir `/run resume {nome}` para retomar

## Output

Relatório de execução:
- Workflow: {nome}
- Status: Concluído / Falhou no passo X
- Passos executados: X/Y
- Resultados por passo
