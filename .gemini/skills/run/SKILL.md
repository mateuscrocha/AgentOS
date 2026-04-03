---
name: run
description: Executa um workflow multi-agente
---

Invoque `@task-runner` para executar skill `run-workflow` com: "$ARGUMENTS"

- Se for nome de workflow → carregar de `system/workflows/`
- Se for "resume <id>" → usar skill `resume-workflow`

O task-runner deve: carregar/validar, registrar em active-workflows.md, executar passos em ordem, registrar resultado em history.md e bus.md, reportar ao usuário.
