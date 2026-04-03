---
name: new-area
description: Cria uma nova area dentro de um space
---

Parse $ARGUMENTS: space (1o), nome da area (2o).

Valide que `spaces/{space}/` existe.

Invoque `@agent-manager` para criar a area usando skill `create-area`. Pergunte ao usuário sobre o propósito da area.

Confirme: area em `spaces/{space}/areas/{area}/`, sugira `/new-agent` ou `/new-team`.
