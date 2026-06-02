# Inteligência do Cliente do Bóris

Este diretório concentra a camada de inteligência transversal do Bóris.

Ele não substitui `reunioes/` nem `comercial/contas/`. Ele existe para organizar o que vira leitura estratégica recorrente a partir desses materiais.

## Estrutura

- `pesquisas/`: benchmarks, análises de mercado, comparativos, notas de discovery e estudos externos
- `sinteses/`: memos consolidados com leitura acionável para produto, comercial, conteúdo, suporte e operações
- `radar-de-dores-e-oportunidades.md`: documento-mestre com padrões recorrentes de dores, objeções, soluções propostas e hipóteses estratégicas

## Regra de uso

- matéria-prima de reunião continua em `../reunioes/`
- contexto comercial específico de conta continua em `../comercial/`
- quando o aprendizado extrapolar uma única call ou precisar informar decisão do Bóris, ele deve aparecer aqui em forma de síntese
- quando um padrão começar a se repetir, ele deve subir para o `radar-de-dores-e-oportunidades.md`

## Protocolo padrão para transcrições

Salvo orientação contrária do usuário, toda nova transcrição enviada para o AgentOS deve disparar este fluxo:

1. reunião consolidada em `../reunioes/`
2. síntese estratégica em `./sinteses/`
3. criação ou atualização do dossiê da conta em `../comercial/contas/`
4. atualização do radar quando houver padrão novo ou repetido
5. regeneração da base do dashboard quando a transcrição alterar a inteligência consumida pelo painel

## Ponto de partida

- guarde reuniões e transcrições em `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/reunioes/`
- guarde pesquisas em `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/inteligencia-cliente/pesquisas/`
- use o agente `customer-intelligence-manager` para transformar o material em síntese oficial
- consolide padrões recorrentes em `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/inteligencia-cliente/radar-de-dores-e-oportunidades.md`
