# Operação de Leads do Boris

## Objetivo
Transformar a bagunça de contatos antigos em uma base operacional simples, priorizada e acionável.

## Arquivo-base
Modelo criado:
- [boris-base-leads-template.csv](/Users/eu.rochamateus/Documents/Codex/Bóris%20-%20Enkrateia/tmp/boris-base-leads-template.csv)

## Como usar a base
Cada linha é um lead.

O objetivo da base não é ser perfeita.
O objetivo da base é permitir que você:
- veja quem vale atacar agora
- não esqueça contexto
- saiba o próximo passo de cada contato
- pare de depender da memória

## Ordem prática de preenchimento
Não tente preencher tudo de uma vez.

Preencha nesta ordem:
1. `nome`
2. `empresa`
3. `tipo_de_lead`
4. `origem`
5. `viu_o_boris_onde`
6. `dor_principal`
7. `decisor`
8. `status`
9. `prioridade`
10. `proximo_passo`

O resto pode ser refinado depois.

## Significado das colunas

### Identificação
- `nome`
- `empresa`
- `whatsapp`
- `email`
- `instagram`

### Contexto comercial
- `segmento`
- `tipo_de_lead`
- `origem`
- `viu_o_boris_onde`

### Contexto de uso
- `usa_grupos_whatsapp`
- `quantidade_de_grupos`
- `volume_de_mensagens`
- `tem_grupo_ativo`

### Dor e oportunidade
- `dor_principal`
- `objetivo_principal`
- `decisor`
- `urgencia_0_a_10`

### Pontuação
- `fit_icp_0_a_10`
- `potencial_ticket_0_a_10`
- `potencial_estrategico_0_a_10`

### Operação
- `temperatura`
- `status`
- `prioridade`
- `ultimo_contato`
- `proximo_passo`
- `data_proximo_passo`
- `observacoes`

## Tipos de lead
Padronize usando só estes valores:

- `lead-antigo-quente`
- `ex-cliente`
- `quase-cliente`
- `estrategico`
- `fechamento-rapido`
- `ponte`
- `indicacao`

## Origens possíveis
Padronize para facilitar filtro depois:

- `grupo`
- `site`
- `whatsapp-direto`
- `indicacao`
- `networking`
- `evento`
- `cliente-antigo`
- `parceiro`
- `conteudo`
- `outro`

## Temperatura
Use:

- `quente`
- `morno`
- `frio`

Regra simples:
- `quente`: já viu valor, já falou com você ou já mostrou intenção real
- `morno`: conhece, mas não está ativo agora
- `frio`: contato possível, mas sem conversa recente ou sem contexto forte

## Status
Use só estes:

- `mapeado`
- `abordar`
- `abordado`
- `respondeu`
- `qualificado`
- `conversa-marcada`
- `proposta`
- `follow-up`
- `fechado`
- `pausado`
- `sem-fit`

## Prioridade
Use:

- `P1`
- `P2`
- `P3`

### Regra para P1
Marque como `P1` quando o lead tiver pelo menos 3 destes:
- dor clara
- grupo ativo
- decisor acessível
- já viu o Boris
- potencial de compra rápida
- potencial estratégico real

### Regra para P2
Marque como `P2` quando:
- existe fit
- mas falta timing, contexto ou acesso

### Regra para P3
Marque como `P3` quando:
- é só uma possibilidade futura
- precisa de cultivo
- ainda não merece foco imediato

## Recomendação de preenchimento por lote
Não tente organizar todos os leads de uma vez.

Faça em lotes:
- lote 1: leads antigos quentes
- lote 2: ex-clientes e quase-clientes
- lote 3: estratégicos
- lote 4: pontes e indicações

## Primeira varredura recomendada
Comece com 30 a 50 nomes.

Se você começar com tudo ao mesmo tempo, vai travar.

## Estrutura operacional da semana

### Segunda
- adicionar nomes na base
- classificar
- marcar prioridade

### Terça
- abordar `P1`

### Quarta
- seguir `P1`
- iniciar `P2`

### Quinta
- follow-up dos que não responderam

### Sexta
- revisar aprendizados
- atualizar status
- preparar próxima rodada

## Regras para não se perder
- nenhum lead sem `status`
- nenhum lead sem `proximo_passo`
- nenhum `P1` sem data de ação
- se respondeu, registrar no mesmo dia
- se não faz sentido agora, pausar conscientemente

## Atalhos de leitura

### Quem atacar primeiro
Filtrar:
- `prioridade = P1`
- `status = mapeado` ou `abordar`

### Quem precisa de follow-up
Filtrar:
- `status = abordado`
- `status = proposta`
- `status = follow-up`

### Quem pode destravar mercado
Filtrar:
- `tipo_de_lead = estrategico`
- ou `potencial_estrategico_0_a_10 >= 8`

### Quem pode fechar rápido
Filtrar:
- `tipo_de_lead = fechamento-rapido`
- ou `fit_icp_0_a_10 >= 8` e `urgencia_0_a_10 >= 7`

## Regra de ouro
Base boa não é a base mais completa.
Base boa é a base que te faz agir.

## Próximo passo recomendado
Preencher a primeira lista com:
- leads antigos quentes
- ex-clientes
- contas estratégicas óbvias

Meta inicial:
- subir os primeiros 30 nomes
- classificar
- escolher os 10 primeiros `P1`
