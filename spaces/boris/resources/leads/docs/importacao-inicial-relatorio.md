# Relatorio de importacao inicial

Data do lote: 2026-03-13
Batch: `2026-03-13_initial_import`

## Fontes importadas

- `leads_clientes_boris_TODOS_v2.csv`: 1047 linhas
- `base_unificada_leads (1).xlsx`: 999 linhas
- `leads_atuais_nao_pagos (1).xlsx`: 20 linhas
- `leads_clientes_boris_TODOS_v2.xlsx`: duplicata de formato da base principal

## Consolidacao

- Telefones unicos nas 3 fontes logicas: 1873
- Sobreposicao entre `TODOS_v2` e `base_unificada`: 146
- Sobreposicao entre `TODOS_v2` e `nao_pagos`: 1
- Sobreposicao entre `base_unificada` e `nao_pagos`: 0

## Qualidade dos dados

- `TODOS_v2`: 188 linhas sem nome
- `base_unificada`: 188 linhas sem nome
- `base_unificada`: 46 linhas sem telefone e por isso nao entraram na base mestre
- `nao_pagos`: 0 linhas sem nome

## Status na base mestre

- `new`: 1406
- `qualified`: 447
- `follow_up_pending`: 20

## Arquivos gerados

- `data/processed/leads_clientes_boris_todos_v2_normalized.csv`
- `data/processed/base_unificada_leads_normalized.csv`
- `data/processed/leads_atuais_nao_pagos_normalized.csv`
- `data/master/leads_master.csv`

## Observacoes

- A base mestre foi deduplicada por telefone normalizado.
- Quando o mesmo telefone apareceu em mais de uma fonte, a linha consolidada preservou os rastros de origem em `source_name`, `original_id` e `notes`.
- A lista `leads_atuais_nao_pagos` foi marcada como `follow_up_pending` para facilitar ativacao comercial.
