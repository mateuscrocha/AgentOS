---
name: manage-calendar-events
description: Cria, atualiza, remarca e cancela eventos no Google Calendar com segurança operacional e datas explícitas
agent: day-manager
project: pessoal
version: 1.0
created: 2026-04-06
---

# Skill: manage-calendar-events

## O que esta skill faz

Escreve no Google Calendar a partir de pedidos em linguagem natural, criando, atualizando, remarcando ou cancelando eventos com horários explícitos e checagem básica de ambiguidades.

## Quando usar

- quando o usuário pedir para criar um evento, compromisso, consulta, lembrete ou bloco de foco
- quando for preciso remarcar ou ajustar horário, título, descrição, local ou participantes de um evento existente
- quando o usuário pedir para cancelar ou remover um compromisso do calendário

## Ferramenta preferida

Usar preferencialmente a rota de agenda que consiga respeitar a política herdada do space `pessoal`, especialmente calendário de destino quando isso fizer parte da regra do evento.

O Google Calendar conectado do runtime continua sendo a primeira opção para leitura, busca, atualização, remarcação e remoção.

Para criação, usar o fluxo que melhor preserve a política de agenda. Se o conector nativo não permitir escolher o calendário certo, preferir o fluxo alternativo por script/OAuth.

Script local de criação alinhado ao AgentOS:

```bash
python3 spaces/pessoal/areas/dia/agents/day-manager/skills/manage-calendar-events/scripts/create_event.py \
  --title "Evento externo - Embrapa" \
  --start "2026-04-09T08:30:00-03:00" \
  --end "2026-04-09T12:00:00-03:00" \
  --location "EMBRAPA, Asa Norte, Brasília" \
  --event-kind external-work
```

## Processo

1. Entender se o pedido é de criação, atualização, remarcação, cancelamento ou apenas consulta.
2. Converter referências relativas como "amanhã", "sexta" ou "depois do almoço" em data e hora absolutas no fuso do usuário.
3. Para criação, definir pelo menos: título, início, fim ou duração, e fuso horário.
4. Aplicar a política herdada em `spaces/pessoal/guidelines/gestao-de-agenda.md` para decidir o calendário de destino quando couber.
5. Para edição ou cancelamento, localizar o evento correto no Google Calendar antes de escrever.
6. Preservar dados existentes que o usuário não pediu para mudar.
7. Executar a operação no calendário e devolver confirmação com data, hora e calendário usados.

## Inputs

- `$ARGUMENTS`: pedido em linguagem natural com título, data, hora, duração, local, descrição, participantes, recorrência ou instrução de edição/cancelamento

## Outputs

Resultado operacional curto, com:
- ação executada
- título final do evento
- data e horário exatos
- calendário usado
- link do evento quando disponível

## Regras

1. O Google Calendar é a fonte de verdade dos compromissos com horário marcado.
2. Sempre responder e operar com datas absolutas e fuso explícito.
3. Se o pedido de criação estiver claro, assumir duração padrão de 60 minutos quando o fim não for informado.
4. Se houver múltiplos eventos candidatos para editar ou cancelar, pedir desambiguação antes de escrever.
5. Não apagar nem alterar eventos em lote sem pedido explícito.
6. Ao criar blocos pessoais de foco, preferir evento sem convidados, salvo instrução diferente.
7. Ao remarcar, preservar título, descrição, local e convidados, salvo quando o usuário pedir mudança.
8. Ao criar evento de trabalho, preferir a agenda `Catapulta Digital`, salvo instrução explícita em contrário.
9. Ao criar evento externo de trabalho, usar a agenda `Catapulta Digital` e deixar a cor padrão do calendário prevalecer.
10. Quando a ferramenta disponível não permitir cumprir a política completa, informar a limitação antes de encerrar a operação.

## Exemplos de uso

- "Cria consulta com dermatologista amanhã às 15h por 1 hora"
- "Bloqueia foco na sexta das 9h às 11h"
- "Remarca a reunião com João de hoje 16h para amanhã 10h"
- "Cancela a consulta de quarta às 14h"
