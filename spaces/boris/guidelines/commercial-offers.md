# Commercial Offers

## Objetivo

Este arquivo e a fonte canonica compartilhada do Boris para:

- ofertas ativas
- logica de precificacao
- custos relevantes
- regras de proposta
- definicoes comerciais que todos os agentes devem usar

## Regra de uso

Se um agente do Boris precisar responder sobre oferta, preco, investimento, custo, plano, escopo comercial ou comparacao entre propostas, deve consultar este arquivo primeiro.

## Como manter

Atualize este arquivo sempre que mudar:

- nome de uma oferta
- faixa de preco
- setup
- mensalidade
- criterio de desconto
- custo importante de operacao
- regra comercial que impacta proposta ou fechamento

## Ofertas

As ofertas abaixo refletem o modelo comercial que ja aparece no space `boris`.
Os nomes podem evoluir, mas esta estrutura vira a referencia compartilhada.

| Oferta | ICP principal | Entrega | Modelo de cobranca | Faixa de preco | Status | Observacoes |
|---|---|---|---|---|---|---|
| Trial seletivo de 7 dias | Leads qualificados com dor clara e contexto real de grupo | Acesso guiado, demonstracao contextual e acompanhamento orientado para decisao | gratuito e curado | definir se existe limite ou criterio adicional | ativo | Nao e trial aberto. Deve sempre servir ao fechamento. |
| Implantacao inicial Boris | Operacoes que ja enxergam valor e precisam entrar em uso real | Alinhamento inicial, definicao de grupos prioritarios, configuracao inicial e calibracao | setup unico | ainda nao definido neste arquivo | ativo | Usar como base para proposta de entrada. |
| Acompanhamento mensal Boris | Clientes em operacao apos fase inicial | Acompanhamento da camada Boris, leitura operacional e ajustes da primeira fase ou rotina recorrente | mensalidade recorrente | R$ 350 por grupo por mes | ativo | Mensalidade padrao atual do Boris. Registrar excecoes comerciais quando existirem. |
| Conta estrategica customizada | Franquias, operadores com varios grupos, ecossistemas parceiros e contas com efeito multiplicador | Escopo adaptado por conta, com proposta customizada | sob proposta | preencher regra oficial | ativo | Nao tratar como oferta padrao de caixa rapido. |

## Custos

Registrar aqui apenas custos que impactam decisao comercial, margem ou precificacao.

| Item de custo | Tipo | Valor | Periodicidade | Relacao com a oferta | Observacoes |
|---|---|---|---|---|---|
| Infra ou ferramentas essenciais do Boris | fixo | preencher | mensal | todas | Usar esta linha para os custos-base que sustentam a operacao. |
| Custo operacional de onboarding ou implantacao | variavel | preencher | por entrada | implantacao inicial | Se variar por conta, deixar a regra descrita. |
| Custo operacional recorrente por grupo | variavel | R$ 100 por grupo | mensal | acompanhamento mensal | Lastro operacional adotado como referencia oficial atual. |

## Premissas de custo atuais

- media observada de volume: 100 mensagens por grupo
- custo medio estimado originalmente: R$ 70 por grupo
- referencia operacional adotada no Boris: R$ 100 por grupo para manter lastro de laboratorio

## Leitura operacional atual

- preco padrao atual: R$ 350 por grupo por mes
- custo de referencia atual: R$ 100 por grupo por mes
- sobra bruta de referencia por grupo: R$ 250 por grupo por mes
- sempre que houver proposta fora da logica por grupo, registrar como excecao explicitamente

## Regua de desconto por volume

Regra recomendada atual para contas com varios grupos.
Objetivo: manter simplicidade comercial, previsibilidade e margem saudavel mesmo com desconto progressivo.

| Volume | Preco por grupo | Desconto sobre tabela | Total mensal | Sobra bruta estimada por grupo |
|---|---|---|---|---|
| 1 grupo | R$ 350 | 0% | R$ 350 | R$ 250 |
| 10 grupos | R$ 320 | 8,6% | R$ 3.200 | R$ 220 |
| 20 grupos | R$ 300 | 14,3% | R$ 6.000 | R$ 200 |
| 30 grupos | R$ 285 | 18,6% | R$ 8.550 | R$ 185 |
| 50 grupos | R$ 270 | 22,9% | R$ 13.500 | R$ 170 |
| 100 grupos | R$ 250 | 28,6% | R$ 25.000 | R$ 150 |

### Regra de leitura

- ate 9 grupos, usar tabela cheia de R$ 350 por grupo, salvo excecao estrategica
- a partir de 10 grupos, usar a regua de volume como ancora padrao
- abaixo de R$ 250 por grupo, tratar como excecao que exige justificativa comercial explicita
- contas estrategicas com pedido fora desta regua devem ser registradas como proposta customizada

## Quando usar oferta padrao

Usar oferta padrao quando:

- a conta tem escopo claro e numero de grupos definido
- a necessidade principal e leitura operacional dos grupos
- nao existe pedido forte de customizacao, integracao ou desenho especial
- a negociacao cabe na regua por grupo definida acima

## Quando vira proposta customizada

Tratar como proposta customizada quando:

- a conta pedir integracoes, fluxo especial ou camada extra de servico
- houver muitos grupos com perfis muito diferentes entre si
- a operacao exigir onboarding mais pesado ou desenho por fases
- a conta quiser excecao forte de preco fora da regua
- a oportunidade tiver peso estrategico relevante para prova, marca ou distribuicao

## Regra simples de setup

Enquanto nao houver outra definicao oficial, usar esta logica:

- contas pequenas e diretas: setup opcional, caso a implantacao seja muito leve
- contas com onboarding real, organizacao inicial e calibracao: cobrar setup separado
- contas estrategicas ou com muitos grupos: setup recomendado como padrao

## Regra de decisao sobre setup

- se a venda envolver apenas entrada simples em poucos grupos, avaliar fechar sem setup
- se houver trabalho claro de alinhamento, priorizacao, configuracao e calibracao inicial, cobrar setup
- se a conta tiver 10 grupos ou mais, o setup deve ser considerado na proposta
- se a conta for customizada, registrar o racional do setup na pasta da proposta

## Regua objetiva de setup

Usar esta regua como ancora comercial inicial:

| Faixa de grupos | Setup recomendado | Leitura comercial |
|---|---|---|
| 1 a 9 grupos | R$ 0 a R$ 1.500 | Pode entrar sem setup se a implantacao for muito leve. Se houver onboarding real, usar setup enxuto. |
| 10 a 19 grupos | R$ 3.000 | Ja existe organizacao inicial suficiente para justificar setup separado. |
| 20 a 49 grupos | R$ 6.000 | Conta com onboarding relevante, priorizacao e calibracao mais robusta. |
| 50 a 99 grupos | R$ 12.000 | Implantacao com peso operacional alto e necessidade de desenho mais cuidadoso. |
| 100 grupos ou mais | R$ 20.000+ | Tratar como conta estrategica com setup sob proposta. |

### Regra de uso do setup

- usar o valor da faixa como ponto de partida, nao como teto absoluto
- se a conta exigir muito menos esforco que a faixa sugere, justificar reducao na proposta
- se a conta exigir muito mais esforco, tratar como proposta customizada
- em contas de 100 grupos ou mais, o setup deve ser tratado como negociacao estrategica e nunca como automatismo

## Regras comerciais

- Se existir conflito entre memoria solta, conversa antiga e este arquivo, este arquivo vale mais como referencia operacional.
- Nao inventar preco, desconto ou escopo fora do que estiver registrado aqui.
- Se uma proposta precisar ser excepcional, registrar a excecao aqui ou na pasta da proposta antes de tratar como padrao.
- Propostas especificas continuam vivendo em `spaces/boris/resources/leads/docs/propostas/`, mas a definicao padrao das ofertas fica aqui.

## Estado atual

Hoje este arquivo define o local canonico.
Os valores oficiais ainda precisam ser preenchidos manualmente com base na operacao real.

## Observacao pratica

Se no futuro a operacao ficar mais analitica, os detalhes transacionais podem ir para `resources/`, planilha ou banco.
Mas a definicao compartilhada do que o Boris vende e quanto custa deve continuar apontando para este arquivo.
