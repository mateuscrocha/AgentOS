---
name: new-team
description: Cria um novo time dentro de uma area
---

Parse $ARGUMENTS: space (1o), area (2o), nome do time (3o).

Valide que `spaces/{space}/areas/{area}/` existe.

Invoque `@team-manager` para criar o time usando skill `create-team`. Pergunte ao usuário quais agentes incluir e quem é o líder.

Confirme: time em `spaces/{space}/areas/{area}/teams/{time}/`, memória inicializada, membros adicionados.
