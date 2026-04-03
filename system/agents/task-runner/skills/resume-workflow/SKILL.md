---
name: resume-workflow
description: Retoma um workflow pausado ou que falhou no meio da execução
agent: task-runner
version: 1.0
---

# Skill: resume-workflow

## O que esta skill faz

Retoma a execução de um workflow que parou — seja por falha em um passo ou por pausa manual.

## Quando usar

- Após um workflow falhar e o problema ser corrigido
- Quando o usuário executa `/run resume <nome>`

## Inputs

- `$WORKFLOW_ID`: Identificador do workflow em `active-workflows.md`

## Processo

1. **Ler** `active-workflows.md` e localizar o workflow pelo ID

2. **Verificar estado:**
   - Identificar último passo concluído
   - Identificar próximo passo a executar
   - Verificar se o passo que falhou agora tem condições de sucesso

3. **Retomar execução** a partir do próximo passo pendente:
   - Seguir o mesmo processo de `run-workflow` a partir do ponto de retomada
   - Manter o progresso anterior (não re-executar passos concluídos)

4. **Atualizar** `active-workflows.md` com novo status

5. **Se concluir com sucesso:**
   - Seguir processo de conclusão normal de `run-workflow`

## Output

Relatório de retomada:
- Workflow: {nome}
- Retomado a partir do passo: X
- Status final: Concluído / Falhou novamente no passo Y
