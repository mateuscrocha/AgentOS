# Avaliacao do backup `backup_public_2025-08-19 (1).dump`

## Origem
Arquivo analisado: `/Users/eu.rochamateus/Downloads/backup_public_2025-08-19 (1).dump`

Tipo: PostgreSQL custom dump

Data do backup: `2025-08-19 17:54:43 -03`

## Extracao bruta gerada

Arquivos criados em `data/raw/postgres_backup_2025-08-19/`:

- `full_data.sql`
- `groups.csv`
- `members.csv`
- `subscriber_groups.csv`
- `subscribers.csv`

## Volumes identificados

- `groups`: 268
- `members`: 69.507
- `subscriber_groups`: 70
- `subscribers`: 33

## Estruturas mais relevantes para leads

### `subscribers`
Contem contatos mais proximos de uma base opt-in:
- `name`
- `email`
- `phone`
- `created_at`
- `active`

### `members`
Contem membros de grupos com telefone e papeis operacionais:
- `name`
- `phone`
- `group_id`
- `isadmin`
- `issuperadmin`
- `ismanager`
- `last_active_at`

### `groups`
Contem o contexto do grupo:
- `name`
- `description`
- `payment_status`
- `niche`
- `expectation`
- `subject`
- `link`

### `subscriber_groups`
Relaciona subscribers aos grupos e ajuda a preservar contexto de origem.

## Leitura operacional

- Esta fonte e valiosa para enriquecimento e descoberta de novos contatos.
- `subscribers` e o caminho mais limpo para importacao direta de leads.
- `members` tem alto volume e nao deve entrar em massa na base mestra sem recorte.
- O melhor recorte inicial para `members` e focar em `isadmin`, `issuperadmin` e `ismanager`.

## Sinais iniciais

- `members` com telefone: 69.503
- `members` marcados como admin: 631
- `members` marcados como super admin: 140
- `members` marcados como manager: 580
- `subscribers` com email: 33
- `subscribers` com telefone: 22

## Sobreposicao com a base mestra atual

- `members`: 62.055 telefones unicos, com 197 ja presentes em `data/master/leads_master.csv`
- `subscribers`: 22 telefones unicos, com 4 ja presentes em `data/master/leads_master.csv`

## Recomendacao de proximo passo

1. Normalizar `subscribers` em `data/processed/`.
2. Gerar uma lista separada de `members` admins/managers em `data/processed/`.
3. Consolidar primeiro os contatos com maior sinal comercial e contexto de grupo preservado.
