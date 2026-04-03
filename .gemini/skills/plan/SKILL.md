---
name: plan
description: Gera plano de execução para um request complexo sem executar
---

Invoque `@workflow-planner` para executar skill `plan-action` com: "$ARGUMENTS"

O planner deve:
1. Decompor o request em passos atômicos
2. Consultar registros para estado atual
3. Determinar agentes e skills necessários
4. Executar `estimate-impact`
5. Apresentar plano formatado para aprovação

NÃO execute nada — apenas planeje.
