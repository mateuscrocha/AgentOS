# Snapshot do CRM Atual

Data de consulta: 2026-04-06

## Origem

Este snapshot reflete o CRM real do painel do Boris consultado em:

- `spaces/boris/areas/produto/workspaces/boris-painel`
- tabela `public.crm_accounts`

## Volume Atual

- contas totais no CRM: `81`

## Distribuicao por Estagio

- `new_lead`: `8`
- `meeting`: `34`
- `proposal`: `1`
- `approval_pending`: `0`
- `customer`: `32`
- `lost`: `6`

## Leitura Operacional

- contas comerciais ativas fora de `customer/lost`: `43`
- contas em inicio ou ainda nao claramente trabalhadas: `8`
- contas ja em conversa, reuniao, proposta ou follow-up: `35`
- contas com `next_step`: `22`
- contas com `next_action_at`: `11`
- contas com `last_contact_at`: `19`
- acoes vencidas no momento da consulta: `7`

## Observacao Importante

O tipo de estagio `qualification` ainda existe no codigo, mas a operacao atual normaliza esse estagio para `meeting`.

Na pratica, o pipeline vivo do painel hoje esta mais proximo de:

- `new_lead`
- `meeting`
- `proposal`
- `approval_pending`
- `customer`
- `lost`

## Proxies de Follow-Up

Ainda nao existe um campo unico oficial de `follow_up_pending` no CRM atual.

Os melhores sinais operacionais hoje sao:

- `next_step` preenchido
- `next_action_at` preenchido
- `last_contact_at` recente
- texto de `next_step` indicando retomada, follow-up, reativacao ou contato

No momento da consulta, havia um proxy de `6` contas com follow-up pendente por texto de `next_step`.
