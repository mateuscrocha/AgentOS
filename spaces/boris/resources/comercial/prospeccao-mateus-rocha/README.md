# Projeto: Prospecção Mateus Rocha

Base operacional da jornada de prospecção atual conduzida por `Mateus Rocha`.

## Objetivo

Organizar a prospecção por WhatsApp como uma frente viva, com:

- regra clara de abordagem
- lotes controlados de envio
- copy ajustada ao jeito real de falar do usuário
- um painel simples para leitura rápida do andamento

## Regras Operacionais

- canal principal: WhatsApp pessoal via Evolution API
- executor: esta thread como agente principal da prospecção
- tamanho do lote: `10` leads por vez
- fluxo: mostrar lote -> aguardar `pode enviar` -> disparar -> revisar -> montar próximo lote
- estilo da copy: informal, natural e com o jeito de falar do usuário
- nome do remetente: `Mateus Rocha`
- tratamento do lead: usar apenas o primeiro nome
- formato da abordagem: pelo menos `3` mensagens curtas
- memória comercial: sempre reativar o contexto de como o lead conheceu o Bóris quando houver sinal confiável
- proteção de chip: usar delay randômico entre mensagens dentro de cada lote
- cadência de prospecção: depois de aprovado, o lote segue em disparo contínuo respeitando os delays; não existe espera por resposta do lead para continuar a prospecção

## Estrutura Recomendada

- painel web: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-projetos/prospeccao-mateus/index.html`
- estado do painel: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-projetos/prospeccao-mateus/state.json`
- registro de envios e bloqueio da jornada: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/sent-registry.json`
- lote de prospecção real em análise: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/lote-02-prospeccao-real-2026-04-28.md`
- próximo lote reservado para revisão: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/lote-03-prospeccao-real-2026-04-28.md`
- registro do incidente de duplicidade: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/incidente-duplicidade-2026-04-28.md`
- relatório da revalidação dura da fila: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/revalidacao-fila-segura-2026-04-28.md`
- query operacional da fila segura endurecida: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/fila-segura-hardened.sql`
- plano de saneamento do CRM: `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/comercial/prospeccao-mateus-rocha/saneamento-crm-2026-04-28.md`

## Leitura Atual

- fila segura inicial identificada: `105` leads
- fila segura revalidada com trava dura: `0` leads
- lote `01`: `9` envios efetivos e `1` falha por número inexistente
- status atual: campanha pausada porque, depois da revalidação, só sobravam registros do tipo `Contato de grupo (manager)` com placeholder de triagem, o que não atende o critério seguro de prospecção nova
- próximo passo operacional correto: saneamento do CRM antes de qualquer novo lote

## Como Manter

1. Atualizar `state.json` a cada avanço relevante.
2. Registrar todo envio em `sent-registry.json` antes de considerar novos lotes.
3. Bloquear qualquer lead já enviado na jornada, independentemente de recortes futuros do CRM.
4. Usar o painel apenas como leitura rápida; a operação viva continua passando por CRM + esta thread.
5. Não montar lote novo enquanto a fila “segura” for composta apenas por linhas de `Manager` ou `Contato de grupo (manager)`.
6. Tratar `Triar legado e definir 1º contato` e `validar se contato administrativo vira lead acionavel` como placeholders operacionais, nunca como sinal de lead pronto para disparo.

## Observação

Este projeto não substitui o CRM do Bóris.

- CRM = fonte oficial da operação comercial viva
- este projeto = cockpit leve da cadência de prospecção atual
