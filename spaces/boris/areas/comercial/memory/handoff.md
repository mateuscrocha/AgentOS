# Handoffs: comercial

## Handoff: Codex -> sales-operator
**Data:** 2026-04-06 14:00
**Prioridade:** Alta
**Status:** Pendente

### Contexto
O usuario decidiu migrar a operacao comercial ativa do Boris para o AgentOS a partir de 2026-04-06.

O trabalho anterior foi conduzido no projeto `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia`, onde a metodologia comercial foi organizada e parte da base foi priorizada. A definicao de `mensagem inicial`, `follow-up` e cadencia ja existe. O ponto de parada nao foi estrategia de copy, e sim execucao disciplinada da fila e continuidade operacional.

### Tarefa
Assumir a continuidade do comercial do Boris a partir do estado atual ja definido no legado, sem recomeçar do zero.

O agente deve:
- entender o estado atual da operacao comercial herdada da Enkrateia
- absorver a logica de `mensagem inicial` e `follow-up` ja definida
- usar isso como base para a rotina de outreach, reativacao e pipeline do Boris dentro do AgentOS
- decidir a proxima leva de execucao com foco em leads quentes e follow-ups pendentes

### Inputs
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/docs/mentoria-comercial-boris/playbook-comercial-30d.md`
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/docs/mentoria-comercial-boris/primeiras-abordagens-quase-clientes.md`
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/docs/mentoria-comercial-boris/operacao-leads.md`
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/docs/mentoria-comercial-boris/quase-clientes-proposal-crm-2026-03-19.md`
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/tmp/leads_master_cortes/leads_master_resumo.txt`
- Arquivo: `/Users/eu.rochamateus/Documents/Codex/Bóris - Enkrateia/tmp/leads_master_operacao/top10_leads_quentes_nao_clientes.csv`

### Estado Atual Herdado
- A primeira mensagem ja foi definida com objetivo de reabrir contato, reativar dor, validar contexto atual e puxar proximo passo.
- O follow-up ja foi definido com objetivo de recuperar timing, evitar morte por omissao e transformar silencio em resposta.
- A cadencia ja estava clara:
- `dia 0`: mensagem inicial
- `dia 2`: follow-up 1
- `dia 4 ou 5`: follow-up 2
- `dia 8 ou 10`: encerramento leve ou pausa
- Ja existem exemplos prontos de abordagem e follow-up para quase-clientes, especialmente `Luanacarolinas` e `Econolivia`.
- A operacao ficou parada na execucao da fila, nao na criacao das mensagens.
- O resumo operacional aponta `15` casos como `follow-up pendente`.
- A fila `PROXIMA_LEVA` inclui varios leads com `next_action = avaliar follow_up inicial`, indicando selecao feita, mas sem trabalho concluido.

### Leitura Operacional
- O lote de quase-clientes em `PROPOSAL` era um dos blocos mais quentes.
- `Luanacarolinas` e `Econolivia` ja estavam marcados como bons para abordar.
- A estrutura semanal previa:
- abordar `P1`
- seguir `P1`
- fazer follow-up dos que nao responderam
- revisar aprendizados e atualizar status

### Proximo Passo Recomendado
- Ler os arquivos-base acima
- Consolidar no AgentOS a versao oficial da regua de abordagem e follow-up
- Escolher a primeira leva de leads a trabalhar a partir dos quentes e dos `follow_up_pending`
- Registrar pipeline e proximos passos no formato operacional do proprio AgentOS

### Resultado (preenchido pelo destino)
Aguardando leitura, absorcao do contexto e tomada da operacao pelo `sales-operator`.
