# Revalidação da Fila Segura — 2026-04-28

## Resumo Executivo

A revalidação dura da fila de prospecção mostrou que a campanha não deve continuar hoje.

O motivo é simples:

- a fila antiga parecia ter `109` leads acionáveis
- desses `109`, `106` eram registros de `manager` ou `contato de grupo`
- sobraram `3` registros fora dessa classe
- esses `3` também não são lote seguro hoje

Conclusão: a fila segura real está em `0`.

## Quebra da Base Atual

### Contas em `new_lead`

- total em `new_lead`: `1.553`
- com perfil de fila antiga (`status=lead`, sem `last_contact_at`, `P1/P2`, trilho `entrada_nova/legado/reativacao`): `109`
- desses `109`, com cara de `manager/grupo`: `106`
- desses `109`, fora de `manager/grupo`: `3`

### Composição do `new_lead`

Principais classes hoje:

- `Manager de grupo`: `604`
- `Contato de grupo (manager) | postgres_member_admin / manager`: `258`
- `Base antiga do Bóris`: `202`
- `Contato de grupo (manager) | postgres_member_admin`: `110`
- `postgres_member_admin`: `109`
- `Contato de grupo (manager)`: `104`

### Sinais de Ruído Operacional

No trilho `legado`, hoje existem:

- `1.223` contas com `lead_source_detail` de `manager/grupo`
- `604` contas com nota vinda de `v_group_with_managers_rows`
- `1.517` contas com placeholder operacional em `next_step`

Esses placeholders são:

- `Triar legado e definir 1º contato`
- `validar se contato administrativo vira lead acionavel`

## Os 3 Registros Fora da Classe `manager/grupo`

### 1. Guilherme Amorim / contabilidade

- trilho: `entrada_nova`
- prioridade: `P1`
- problema: já está em fluxo de reunião
- sinal claro: `next_step` fala em confirmar reunião de `22/04/2026 às 15h`

Leitura operacional:

- não é prospecção nova
- deveria estar em etapa de reunião ou equivalente, não em fila de disparo

### 2. `+5511913135066`

- trilho: `reativacao`
- prioridade: `P1`
- `lead_source_detail`: `Super Admin`
- contexto: `AI ALLIANCE COMMUNITY`

Leitura operacional:

- não é lead pronto para lote
- é contato administrativo sem nome confiável
- pede curadoria manual antes de qualquer ação

### 3. `+55351919613361`

- trilho: `reativacao`
- prioridade: `P1`
- `lead_source_detail`: `Super Admin`
- contexto: `AVanguarda`

Leitura operacional:

- mesmo problema do item anterior
- contato administrativo, sem nome útil, sem condição de entrar em disparo seguro

## Regra Operacional Confirmada

Para esta jornada, não entra em fila segura:

- qualquer linha com `Manager`, `Super Admin` ou `Contato de grupo`
- qualquer linha com `quick_notes` vindo de `v_group_with_managers_rows`
- qualquer linha com placeholder de triagem em `next_step`
- qualquer linha com sinal de contato anterior, reunião, proposta, follow-up, cliente ou perda
- qualquer número já usado na jornada e registrado em `sent-registry.json`

## Próximo Passo Correto

Em vez de montar novo lote, a prioridade agora é saneamento:

1. corrigir no CRM os casos que já estão em reunião, follow-up ou perda e ainda aparecem em `new_lead`
2. separar definitivamente `base de relacionamento/comunidade` de `fila comercial direta`
3. só voltar a prospectar quando surgirem leads realmente limpos sob a query endurecida
