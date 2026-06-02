# Incidente de Duplicidade — 2026-04-28

## Resumo

O lote `01` da prospecção por WhatsApp enviou mensagens para pelo menos alguns leads que não deveriam ter voltado para a fila de primeira abordagem.

Isso violou a regra principal da operação:

- lead com histórico anterior não pode entrar em prospecção nova
- lead já enviado nesta jornada não pode receber novo disparo da mesma campanha

## Causa Raiz

O filtro usado antes do lote `01` se apoiou demais em:

- `last_contact_at is null`
- ausência de duplicidade exata por telefone no recorte do CRM

Esse critério foi insuficiente porque parte da base legado contém dois tipos de registro para a mesma pessoa:

- um registro `canônico` com histórico anterior de contato, resposta ou interesse
- um registro `espelho` vindo de linha de `manager/admin/grupo`, muitas vezes com telefone sujo, dígito extra ou versão alternativa do mesmo número

Na prática, alguns leads entraram como se fossem novos porque o registro espelho estava com `last_contact_at` vazio, mesmo existindo outro registro da mesma pessoa já contatado antes.

## Casos Confirmados

Casos confirmados como indevidos no lote `01`:

- `Carlos`
- `Lucas`
- `Fabiola`
- `Giovanne`

Casos que permanecem bloqueados para esta jornada mesmo sem confirmação final de histórico anterior:

- `Bruna`
- `Amilton`
- `Matteo`
- `Rodrigo`
- `Gleison`
- `Roberto`

## Regra Nova de Bloqueio

Nenhum novo lote pode sair sem passar por estas travas ao mesmo tempo:

1. bloquear qualquer lead já enviado nesta jornada
2. bloquear qualquer lead com `last_contact_at` em qualquer registro canônico correspondente
3. bloquear qualquer lead com sinais de contato anterior em `quick_notes`, `typebot`, `INTERESSADO`, `subscriber`, `qualified` ou `avaliar follow_up`
4. bloquear qualquer registro `manager/admin/grupo` quando existir espelho da mesma pessoa/telefone em linha de lead já qualificada ou já tocada
5. bloquear qualquer telefone que só difira por sufixo artificial como `0`, `00` ou variação de normalização

## Consequência Operacional

- prospecção pausada até revalidação do próximo lote
- lote `02` não deve ser montado com o filtro antigo
- `sent-registry.json` passa a ser trava explícita de não reenvio nesta campanha

## Revalidação Dura da Fila

Na revalidação feita depois do incidente, a fila aparentemente “segura” só continuava existindo porque ainda aceitava registros com este perfil:

- `lead_source_detail` como `Manager` ou `Contato de grupo (manager)`
- `quick_notes` vindo de `v_group_with_managers_rows`
- `next_step` placeholder como `Triar legado e definir 1º contato`
- `next_step` placeholder como `validar se contato administrativo vira lead acionavel`

Quando essas classes foram bloqueadas explicitamente junto com os sinais de contato anterior e o `sent-registry.json`, a fila segura real caiu para `0`.

Conclusão prática:

- não existe lote `02` pronto hoje
- a campanha só pode voltar quando houver leads realmente limpos no CRM
- `contato de grupo`, `manager` e placeholders de triagem não contam como base segura de prospecção nova
