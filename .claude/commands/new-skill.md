---
description: Cria uma nova skill para um agente
argument-hint: <space/area/agente> <nome-da-skill>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Parse $ARGUMENTS: caminho `space/area/agente` (1o), nome da skill (2o).

Valide que `spaces/{space}/areas/{area}/agents/{agente}/` existe.

Invoque `skill-manager` via Agent tool para criar a skill usando skill `create-skill`. Pergunte ao usuário o que a skill faz, quando usar e os passos.

Confirme: skill em `spaces/{space}/areas/{area}/agents/{agente}/skills/{skill}/SKILL.md`, registrada no skill-registry.
