---
description: Cria um novo space no AgentOS
argument-hint: <nome-do-space>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Valide que $ARGUMENTS contém o nome do space.

Invoque `agent-manager` via Agent tool para criar o space usando sua skill `create-space`.

Confirme: space criado em `spaces/{nome}/`, sugira `/new-area {nome} <area>`.
