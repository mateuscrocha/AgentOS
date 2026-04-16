# Fila de Execucao Comercial

Data de preparacao: 2026-04-06

## Objetivo

Definir a primeira fila oficial de execucao comercial do Boris dentro do AgentOS.

Esta fila combina:

- CRM atual do painel como operacao viva
- legado como reservatorio da proxima leva

## Trilhos Oficiais

### Trilho A: Entradas Novas

- leads que chegam por WhatsApp
- indicacoes
- site
- outras entradas novas

Leitura operacional:

- precisam de resposta rapida
- entram direto no CRM
- devem ser tratadas sem depender da fila da base legado

### Trilho B: Campanha Base Legado

- leads antigos reativados em ondas
- follow-ups de contatos antigos
- quentes historicos ainda nao puxados para o CRM atual

Leitura operacional:

- entram por fila planejada
- devem ser puxados aos poucos
- precisam nascer no CRM com contexto e `next_step`

## Regra de Prioridade

1. contas do CRM com acao vencida ou follow-up ja em curso
2. contas do CRM com `next_action_at` definida para os proximos dias
3. leads quentes do legado ainda nao puxados para o CRM

## Regra de Segunda-Feira

Segunda-feira nao e o melhor dia para abrir muito contato frio.

Na pratica:

- priorizar follow-up de quem ja foi tocado e nao respondeu
- retomar propostas e conversas em andamento
- limpar a fila, revisar contexto e preparar mensagens dos proximos dias
- evitar gastar a melhor energia da semana com leads totalmente frios, salvo excecao muito quente

## Leva 1: Entradas Novas e CRM Atual

Foco: resolver atraso, retomar conversa viva e empurrar oportunidade real para reuniao, proposta ou decisao.

### Prioridade maxima

#### Rafael Wajnsztok

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `proposal`
- status: `prospect`
- leitura: oportunidade mais avancada da fila atual
- ultimo contato: `2026-04-01`
- acao registrada: `2026-04-02`
- proximo passo: enviar proposta escalonada, convite da comunidade e opcao de grupo piloto; aguardar validacao interna
- acao recomendada: confirmar se a proposta foi enviada, cobrar retorno e fechar criterio de decisao

#### André Oliveira

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `meeting`
- status: `prospect`
- leitura: conversa quente e recente
- ultimo contato: `2026-04-06`
- acao registrada: `2026-04-07`
- proximo passo: remarcar conversa e aprofundar escopo, volume de grupos e automacoes
- acao recomendada: retomar rapido e transformar em reuniao objetiva com proximo passo fechado

#### Felippe - GM Promo

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `meeting`
- status: `prospect`
- leitura: discovery avancado com potencial de piloto multi-stakeholder
- ultimo contato: `2026-04-02`
- acao registrada: `2026-04-07`
- proximo passo: entregar acesso ao dashboard para avaliacao interna com marketing, CS e possivelmente diretoria; depois marcar nova reuniao para validar piloto, white label `Mia` e proposta customizada
- acao recomendada: conduzir como conta estrategica, facilitar validacao interna e puxar reuniao com stakeholders operacionais em vez de follow-up generico

### Prioridade alta

#### Alan Alves

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: respondeu e precisa de descoberta comercial
- ultimo contato: `2026-03-31`
- acao registrada: `2026-04-03`
- acao recomendada: responder e conduzir descoberta curta

#### Eder Junior

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: mandou audio e pediu resposta contextual
- ultimo contato: `2026-04-01`
- acao registrada: `2026-04-03`
- acao recomendada: responder com modelo comercial do Boris e puxar qualificacao

#### Guilherme Marra BD

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `meeting`
- status: `prospect`
- leitura: discovery avancado com tese forte de piloto orientado por qualidade de atendimento e necessidade formal de NDA antes do piloto
- ultimo contato: `2026-04-06 17:57`
- acao registrada: `2026-04-07`
- proximo passo: formalizar NDA com a Bilheteria Digital antes de iniciar o piloto; depois receber a lista inicial de grupos, ativar o Bóris em modo `spy` em grupos de segmentos diferentes e revisar os achados em nova reuniao
- acao recomendada: conduzir como conta estrategica de piloto, tratando o NDA como dependencia imediata e depois focando em qualidade de atendimento, grupos sem resposta, consolidado por organizacao e proposta customizada para alto volume

#### Jana C. CRAFT

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: conta com base operacional manual que ajuda a vender por contexto
- ultimo contato: `2026-04-02`
- acao registrada: `2026-04-05`
- acao recomendada: mostrar evolucoes do Boris e puxar conversa comercial concreta

#### Jessica Querentino

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: follow-up explicitamente registrado
- ultimo contato: `2026-03-29`
- acao registrada: `2026-04-05`
- acao recomendada: fazer follow-up e oferecer conversa de mapeamento

### Prioridade moderada

#### Paula

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: conversa ainda fria, mas com proximo passo definido
- ultimo contato: `2026-04-02`
- acao registrada: `2026-04-07`
- acao recomendada: marcar papo e validar dor real

#### Marcos

- trilho: entradas novas / CRM atual
- origem: CRM atual
- estagio: `new_lead`
- status: `lead`
- leitura: janela mais longa, nao precisa entrar no primeiro bloco da semana
- ultimo contato: `2026-04-02`
- acao registrada: `2026-04-28`
- acao recomendada: manter fora da urgencia da semana

## Leva 2: Campanha Base Legado

Foco: puxar para o CRM apenas leads quentes com contexto claro ou follow-up pendente.

### Prioridade maxima

#### Carlos

- trilho: campanha base legado
- origem: legado
- lead_id: `BL-00338`
- status legado: `follow_up_pending`
- temperatura: `high`
- motivo: ja aparece como follow-up pendente e ainda nao trabalhado
- proximo passo legado: avaliar follow-up inicial e reativar proposta pendente
- acao recomendada: criar ou localizar conta correspondente no CRM e executar follow-up

#### Felipe Lucarelli

- trilho: campanha base legado
- origem: legado
- lead_id: `BL-00559`
- status legado: `qualified`
- temperatura: `medium`
- motivo: maior `priority_score` da lista importada
- contexto: varios grupos ativos e sinais de interesse
- acao recomendada: nao recolocar em fila; tratar como `lost` apos a ultima rodada de contato, salvo reentrada futura com contexto novo explicito

### Prioridade alta

#### U Marcos Personal

- trilho: campanha base legado
- lead_id: `BL-00226`
- status legado: `qualified`
- acao recomendada: validar se ja existe no CRM e, se nao, migrar para fila ativa

#### Li Saito

- trilho: campanha base legado
- lead_id: `BL-00245`
- status legado: `qualified`
- acao recomendada: puxar para CRM com contexto de comunidade B2Mamy

#### Priscilla Negrao

- trilho: campanha base legado
- lead_id: `BL-00253`
- status legado: `qualified`
- acao recomendada: tratar como `lost`; nao reativar sem reentrada futura com contexto novo explicito

#### RodrigoK

- trilho: campanha base legado
- lead_id: `BL-00267`
- status legado: `qualified`
- acao recomendada: puxar para CRM com mensagem curta de retomada

#### Fabiola Oliveira

- trilho: campanha base legado
- lead_id: `BL-00268`
- status legado: `qualified`
- acao recomendada: tratar como `lost`; nao recolocar em fila sem reentrada futura com contexto novo explicito

#### Felipe Oliveira

- trilho: campanha base legado
- lead_id: `BL-00276`
- status legado: `qualified`
- acao recomendada: reativar com contexto do grupo e dor operacional

#### Vanessa Tozzato

- trilho: campanha base legado
- lead_id: `BL-00280`
- status legado: `qualified`
- acao recomendada: verificar existencia no CRM e puxar para fila

#### Alberto Maia

- trilho: campanha base legado
- lead_id: `BL-00294`
- status legado: `qualified`
- acao recomendada: abordar como lead antigo quente

## Sequencia Recomendada da Semana

### Dia 1

- trilho principal do dia: entradas novas e follow-ups do CRM
- Rafael Wajnsztok
- André Oliveira
- Felippe - GM Promo
- Jessica Querentino
- revisao de contas com `next_action_at` vencida
- preparo das abordagens da proxima leva legado sem disparar lote frio

### Dia 2

- trilho principal do dia: entradas novas com resposta e primeira abertura de campanha legado
- Alan Alves
- Eder Junior
- Guilherme Marra BD
- Jana C. CRAFT

### Dia 3

- trilho principal do dia: mistura controlada entre CRM e legado quente
- Jessica Querentino
- U Marcos Personal
- Li Saito

### Dia 4

- trilho principal do dia: campanha legado
- RodrigoK

### Dia 5

- trilho principal do dia: campanha legado e fechamento da semana
- Felipe Oliveira
- Vanessa Tozzato
- Alberto Maia
- revisao geral da fila

## Observacoes

- nao despejar a fila legado inteira no CRM
- cada lead legado puxado deve entrar ja com `next_step`
- toda conta do CRM tocada nesta semana deve sair com nova data ou com decisao clara
- segunda-feira deve funcionar como dia de follow-up, triagem e preparacao
- sempre olhar primeiro de qual trilho o lead faz parte antes de decidir a acao
