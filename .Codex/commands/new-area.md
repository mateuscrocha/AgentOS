---
description: Cria uma nova area dentro de um space
argument-hint: <space> <nome-da-area>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Parse $ARGUMENTS: space (1o), nome da area (2o).

Valide que `spaces/{space}/` existe.

Invoque `agent-manager` via Agent tool para criar a area usando skill `create-area`. Pergunte ao usuário sobre o propósito da area.

Confirme: area em `spaces/{space}/areas/{area}/`, sugira `/new-agent` ou `/new-team`.
