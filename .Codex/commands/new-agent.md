---
description: Cria um novo agente dentro de uma area
argument-hint: <space> <area> <nome-do-agente>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Parse $ARGUMENTS: space (1o), area (2o), nome do agente (3o).

Valide que `spaces/{space}/areas/{area}/` existe.

Invoque `agent-manager` via Agent tool para criar o agente usando skill `create-agent`. O agent-manager deve perguntar ao usuário sobre persona, capacidades e regras.

Confirme: agente em `spaces/{space}/areas/{area}/agents/{agente}/`, registrado em `.Codex/agents/{space}--{area}--{agente}.md` e `.gemini/agents/{space}--{area}--{agente}.md`.
