# Intake Comercial por Transcricao Loom

## Objetivo

Padronizar como transcricoes de reunioes do Loom entram na operacao comercial do Boris.

## Quando Usar

Use este fluxo sempre que houver:

- reuniao comercial gravada no Loom
- transcricao manual copiada pelo usuario
- resumo de conversa extraido de audio ou video

## Entrada Esperada

O usuario pode fornecer:

- texto integral da transcricao
- resumo da reuniao
- link do Loom acompanhado da transcricao

## Decisoes que Precisam Sair

Ao analisar a transcricao, definir:

1. se e lead novo ou nao
2. se a conta ja existe no CRM atual
3. se a conta ja existe na base legado ou em fila ativa
4. qual trilho da operacao deve receber essa conta
5. qual estagio do pipeline melhor representa o momento
6. qual deve ser o proximo passo
7. se precisa criar nota de conta, atualizar fila ou preparar mensagem

## Trilhagem

### Vai para entradas novas quando

- veio de indicacao, WhatsApp, site ou reuniao nova
- nao faz parte da campanha planejada sobre a base legado
- precisa de resposta rapida e registro no CRM

### Vai para campanha base legado quando

- a conta ja pertence a base antiga
- a reuniao e parte de uma reativacao
- a conversa retomou oportunidade historica

### Vai para manutencao de conta existente quando

- a conta ja esta no CRM
- a reuniao so muda contexto, estagio ou proximo passo

## Saida Padrao

Para cada transcricao, devolver:

- `classificacao`: lead novo, reativacao, conta em andamento, cliente, no-fit
- `trilho`: entradas novas, campanha base legado, manutencao de conta existente
- `crm`: criar, atualizar ou nao mexer
- `pipeline`: estagio recomendado
- `proximo_passo`: acao minima verdadeira
- `mensagem`: follow-up sugerido, quando aplicavel
- `registro_agentos`: onde refletir a decisao

## Regra Operacional

- nunca assumir que a pessoa e lead novo sem checar CRM e legado
- nunca assumir que a pessoa ja esta no CRM sem reconciliar nome, empresa e contexto
- toda reuniao precisa virar proximo passo operacional
- se houver acao por WhatsApp, preferir a skill `evolution-whatsapp-sender`

## Fluxo Recomendado

1. ler a transcricao
2. identificar nome, empresa, origem e dor
3. cruzar com CRM atual
4. cruzar com legado ou fila ativa quando fizer sentido
5. classificar a conta no trilho correto
6. recomendar atualizacao de CRM e proximo passo
7. redigir follow-up, se necessario
