# Segmentacao operacional inicial

Data: 2026-03-13
Base analisada: `data/master/leads_master.csv`

## Segmentos gerados

- `data/segments/follow_up_prioritario.csv`: 447 registros
- `data/segments/reativacao_nao_pagos.csv`: 20 registros
- `data/segments/contatos_grupo_admin.csv`: 1220 registros

## Regras aplicadas

### Follow-up prioritario
Entram contatos com `lead_status = qualified` e perfil de lead direto.
Tipos aceitos:
- `Lead`
- `Base antiga do Bóris`

### Reativacao de nao pagos
Entram contatos com `lead_status = follow_up_pending`.
Esses contatos foram priorizados na importacao por indicarem potencial de retomada comercial.

### Contatos de grupo e admin
Entram contatos com qualquer um destes tipos:
- `Contato de grupo (manager)`
- `Manager de grupo`
- `Super Admin`
- `Manager`

## Observacoes

- Um mesmo telefone pode aparecer em mais de um segmento se carregar mais de um contexto operacional.
- `follow_up_prioritario` foi mantido separado de managers/admins para evitar campanha errada em contatos operacionais.
- `contatos_grupo_admin` deve ser tratado como base de relacionamento, comunidade ou parceria, nao como funil comercial direto.
