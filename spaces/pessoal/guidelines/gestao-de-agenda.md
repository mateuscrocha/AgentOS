# Gestão de Agenda

## Objetivo

Definir a política padrão de uso do Google Calendar dentro do space `pessoal`, para que agentes, skills e automações criem e leiam eventos com o calendário correto, sem depender de decisão manual a cada pedido.

## Fonte de verdade

- O Google Calendar é a fonte de verdade dos compromissos com horário marcado.
- Toda operação deve usar datas, horários e fuso explícitos.
- Fuso padrão: `America/Sao_Paulo`.

## Calendários padrão

- Calendário principal pessoal: `primary`
- Calendário compartilhado de trabalho: `qdmv02aj79ha0pnb5q2qcaeutk@group.calendar.google.com`
- Nome operacional do calendário compartilhado de trabalho: `Catapulta Digital`

## Política de criação

- Eventos de trabalho devem ser criados, por padrão, na agenda `Catapulta Digital`.
- Eventos pessoais, consultas, lembretes pessoais e compromissos privados devem ser criados, por padrão, em `primary`.
- Quando o pedido misturar contexto pessoal e profissional, o agente deve confirmar apenas se o destino não estiver claro.

## Eventos externos de trabalho

- Evento externo de trabalho é qualquer compromisso profissional fora da rotina operacional comum, como eventos, feiras, visitas, credenciamento, reuniões presenciais externas ou participação em agenda institucional.
- Eventos externos de trabalho devem usar a agenda `Catapulta Digital`.
- Eventos externos de trabalho devem usar a cor padrão da agenda `Catapulta Digital`, sem exigir cor manual específica.
- Se a ferramenta conectada não permitir escolher explicitamente o calendário, o agente deve preferir o fluxo alternativo que permita respeitar a política.
- Se nenhuma rota de escrita disponível conseguir aplicar a política completa, o agente deve informar a limitação de forma explícita antes de concluir a operação.

## Ordem de preferência técnica

1. Usar a rota de escrita que permita definir explicitamente o calendário de destino.
2. Usar conectores limitados apenas quando a política ainda puder ser respeitada ou quando o usuário aceitar a limitação.

## Leitura e revisão de agenda

- Em revisões operacionais do dia, considerar por padrão `primary` e `Catapulta Digital`.
- Ao consolidar múltiplos calendários, preservar o calendário de origem para contexto.

## Regra de comunicação

- Ao confirmar criação, edição ou remarcação, sempre informar qual calendário foi usado.
- Quando houver fallback por limitação técnica, deixar claro se a política foi seguida integralmente ou apenas parcialmente.
