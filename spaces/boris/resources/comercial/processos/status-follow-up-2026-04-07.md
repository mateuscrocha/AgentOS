# Status follow-up Boris

Data: 2026-04-07

## Objetivo

Dar uma leitura operacional simples dos leads trabalhados hoje, separando:

- bloqueados
- aguardando resposta
- respondeu / conversa manual
- observacoes operacionais

## Regras de leitura

- `bloqueado`: nao volta para lote
- `aguardando_resposta`: ja recebeu mensagem e entra em espera ativa
- `respondeu`: sai da logica de lote e vira conversa manual
- `numero_invalido`: sai da fila ate correcao do contato

## Bloqueados

- `BL-00222` — `AI ALLIANCE COMMUNITY` — perdido
- `BL-01782` — `Alessandra` — cancelado / sem interesse
- `BL-01777` — contexto `Árvore Dos Saberes - Eletrônica e Hardware` — numero invalido no WhatsApp

## Aguardando resposta

### Lote 1

- `BL-00702` — `ADS GROUP - TRÁFEGO PAGO`
- `BL-01736` — `Marilza Schausse`
- `BL-01770` — `Ana Laura Suporte`
- `BL-00792` — `Blacksisters In Law`
- `BL-00161` — `Lucas Dantas`
- `BL-00245` — `Li Saito`
- `BL-01129` — `Felipe Bedin`
- `BL-00559` — `Felipe Lucarelli`
- `BL-00841` — `Jefferson Cabral`

### Lote 2

- `BL-01045` — `Bruna Carvalho`
- `BL-00198` — contexto `AVanguarda`
- `BL-01098` — contexto `AQUECIMENTO DE CHIP WHATSAPP`
- `BL-01119` — contexto `AGORA noticias 70`
- `BL-01830` — contexto `ALERTA DE VOOS - MANAUS`
- `BL-01114` — `Agora no vale Noticias`
- `BL-01818` — `Alec Nunes`
- `BL-00602` — `Amilton`
- `BL-00737` — `Anderson Marinelli`
- `BL-01617` — `Bezaleel Lucas`

### Lote 3

- `BL-00338` — `Carlos`
- `BL-01261` — `Prof Junior Cardoso`
- `BL-00858` — `Biula`
- `BL-00308` — `Giovanne Saraiva`
- `BL-00766` — `Daniel Escaleira`
- `BL-01404` — `Rocha Denis Rocha`
- `BL-00818` — `Ighor Miranda`
- `BL-00268` — `Fabiola Oliveira`
- `BL-01424` — `Denis`
- `BL-00686` — `Lucas Furlan`

## Respondeu / conversa manual

- `BL-01782` — `Alessandra` — respondeu que nao usa mais o Bóris, sem interesse, cancelado

## Resumo do dia

- `30` leads avaliados para acao imediata
- `29` mensagens aceitas pela Evolution API
- `1` falha operacional por numero inexistente
- `3` leads ja classificados como bloqueados
- bloco principal agora e `aguardando_resposta`

## Observacoes operacionais

- a duplicidade de mensagens virou risco real durante os disparos de hoje
- o fluxo de WhatsApp foi ajustado para bloquear:
- mensagem identica para o mesmo destinatario dentro da janela longa
- nova abertura para o mesmo destinatario dentro da janela curta
- daqui para frente, todo lead enviado hoje deve ser lido primeiro nesta lista antes de entrar em novo lote
