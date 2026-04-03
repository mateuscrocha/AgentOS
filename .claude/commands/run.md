---
description: Executa um workflow multi-agente
allowed-tools: Read, Glob, Grep, Write, Edit, Agent, Bash
---

Invoque `task-runner` via Agent tool para executar skill `run-workflow` com: "$ARGUMENTS"

- Se for nome de workflow → carregar de `system/workflows/`
- Se for "resume <id>" → usar skill `resume-workflow`

O task-runner deve: carregar/validar, registrar em active-workflows.md, executar passos em ordem, registrar resultado em history.md e bus.md, reportar ao usuário.
