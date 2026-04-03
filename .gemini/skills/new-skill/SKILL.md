---
name: new-skill
description: Cria uma nova skill para um agente
---

Parse $ARGUMENTS: caminho `space/area/agente` (1o), nome da skill (2o).

Valide que `spaces/{space}/areas/{area}/agents/{agente}/` existe.

Invoque `@skill-manager` para criar a skill usando skill `create-skill`. Pergunte ao usuário o que a skill faz, quando usar e os passos.

Confirme: skill em `spaces/{space}/areas/{area}/agents/{agente}/skills/{skill}/SKILL.md`, registrada no skill-registry.
