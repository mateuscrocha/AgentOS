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
| Boris Essencial | Operacoes pequenas ou primeiras entradas com poucos grupos | Acompanhamento direto do Boris em grupos prioritarios com leitura operacional recorrente | mensalidade recorrente por grupo | R$ 350 por grupo por mes | ativo | Faixa padrao para 1 a 9 grupos. E a ancora principal de valor do produto. |
| Boris Escala | Operacoes com varios grupos, maior volume e necessidade de previsibilidade | Mesma logica do Boris, com desconto progressivo por volume e leitura em escala | mensalidade recorrente por grupo | R$ 320 a R$ 250 por grupo por mes | ativo | Usar a regua oficial de volume. Nao tratar como outro produto; e o mesmo Boris em escala. |
| Boris Patrocinado | Grupos selecionados em que uma marca parceira subsidia a operacao | Resumo e leitura do Boris com insercoes contextuais curtas e controladas | cota mensal de patrocinio | R$ 750 a R$ 1.500 por grupo patrocinado por mes | ativo | Nao comunicar como gratis. E modelo subsidiado, seletivo e dependente de fit entre grupo, contexto e patrocinador. |
| Conta estrategica customizada | Franquias, operadores com varios grupos, ecossistemas parceiros e contas com efeito multiplicador | Escopo adaptado por conta, com proposta customizada | sob proposta | a partir da regua oficial, com excecoes justificadas | ativo | Nao tratar como oferta padrao de caixa rapido. |

## Custos

Registrar aqui apenas custos que impactam decisao comercial, margem ou precificacao.

| Item de custo | Tipo | Valor | Periodicidade | Relacao com a oferta | Observacoes |
|---|---|---|---|---|---|
| Infra ou ferramentas essenciais do Boris | fixo | preencher | mensal | todas | Usar esta linha para os custos-base que sustentam a operacao. |
| Custo operacional recorrente por grupo | variavel | R$ 100 por grupo | mensal | Boris Essencial e Boris Escala | Lastro operacional adotado como referencia oficial atual. |
| Custo operacional do patrocinado | variavel | usar como minimo a cobertura do equivalente a 1 grupo mensal | mensal | Boris Patrocinado | O patrocinio nao deve nascer abaixo da sustentabilidade da operacao equivalente. |

## Premissas de custo atuais

- media observada de volume: 100 mensagens por grupo
- custo medio estimado originalmente: R$ 70 por grupo
- referencia operacional adotada no Boris: R$ 100 por grupo para manter lastro de laboratorio

## Leitura operacional atual

- preco padrao atual: R$ 350 por grupo por mes
- custo de referencia atual: R$ 100 por grupo por mes
- sobra bruta de referencia por grupo: R$ 250 por grupo por mes
- modelo patrocinado: deve nascer acima da assinatura direta, porque embute distribuicao contextual e presenca qualificada da marca
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

## Regua do patrocinado

Regra recomendada atual para o modelo subsidiado por marca.
Objetivo: impedir que o patrocinado ensine o mercado a ler Boris como "gratis" e preservar a logica de midia contextual.

| Faixa patrocinada | Preco sugerido | Leitura comercial |
|---|---|---|
| Entrada / piloto estrategico | R$ 750 por grupo por mes | Ancora oficial inicial para teste, piloto ou entrada estrategica. |
| Preco padrao recomendado | R$ 900 por grupo por mes | Referencia principal de venda do patrocinado. |
| Grupo premium ou nicho muito valioso | R$ 1.200 a R$ 1.500 por grupo por mes | Usar quando houver alta aderencia, nicho valioso e maior valor comercial para o patrocinador. |

### Pacotes sugeridos do patrocinado

| Escala patrocinada | Preco sugerido | Leitura comercial |
|---|---|---|
| 1 grupo patrocinado | R$ 900 por mes | Pacote base recomendado para venda recorrente. |
| 3 grupos patrocinados | R$ 2.400 a R$ 2.700 por mes | Pacote com leve ganho de escala, mantendo premio de contexto. |
| 5 grupos patrocinados | R$ 3.750 a R$ 4.250 por mes | Pacote comercial mais robusto para presenca em varios grupos aderentes. |
| 10+ grupos patrocinados | sob proposta | Negociacao customizada conforme nicho, aderencia e volume. |

### Regra de leitura do patrocinado

- o patrocinado nao deve ser apresentado como plano gratis
- o patrocinado deve valer mais que a assinatura direta equivalente, porque inclui distribuicao contextual
- usar R$ 750 apenas como ancora de entrada, piloto ou excecao estrategica
- usar R$ 900 por grupo como referencia principal de venda
- reservar a faixa de R$ 1.200 a R$ 1.500 para grupos premium ou nichos muito valiosos
- usar o patrocinado apenas quando houver aderencia clara entre audiencia, tema do grupo e interesse do patrocinador
- se o patrocinador pedir escala acima de 5 grupos, tratar como proposta mais estruturada; acima de 10 grupos, sempre customizada

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
- a conta quiser excecao forte de preco fora da regua
- a oportunidade tiver peso estrategico relevante para prova, marca ou distribuicao

## Tabela comercial pronta para proposta

Usar esta tabela quando for preciso responder rapido com uma ancora comercial completa.

| Modelo | Faixa de grupos | Mensalidade ou cota | Total mensal de referencia | Modelo recomendado |
|---|---|---|---|---|
| Boris Essencial | 1 grupo | R$ 350 por grupo | R$ 350 | oferta padrao |
| Boris Escala | 10 grupos | R$ 320 por grupo | R$ 3.200 | oferta padrao com volume |
| Boris Escala | 20 grupos | R$ 300 por grupo | R$ 6.000 | oferta padrao com volume |
| Boris Escala | 30 grupos | R$ 285 por grupo | R$ 8.550 | oferta padrao com volume |
| Boris Escala | 50 grupos | R$ 270 por grupo | R$ 13.500 | proposta ampliada |
| Boris Estrategico | 100 grupos | R$ 250 por grupo | R$ 25.000 | proposta customizada estrategica |
| Boris Patrocinado | 1 grupo patrocinado | R$ 900 por grupo patrocinado | R$ 900 | patrocinado seletivo |
| Boris Patrocinado | 3 grupos patrocinados | cota mensal de R$ 2.400 a R$ 2.700 | R$ 2.400 a R$ 2.700 | patrocinado seletivo |
| Boris Patrocinado | 5 grupos patrocinados | cota mensal de R$ 3.750 a R$ 4.250 | R$ 3.750 a R$ 4.250 | patrocinado seletivo |

### Como apresentar

- primeiro ancorar pelo numero de grupos
- depois mostrar o valor por grupo
- em seguida mostrar o total mensal
- se for patrocinado, explicar que a logica e de cota de patrocinio e nao de assinatura simples do operador

### Exemplo de leitura

- conta pequena: entra no Boris Essencial, com mensalidade direta por grupo
- conta media: entra no Boris Escala, com desconto progressivo por volume
- conta com patrocinador aderente: entra no Boris Patrocinado, desde que preserve a experiencia do grupo
- conta grande: pede proposta mais estruturada, mesmo que a logica por grupo continue servindo de ancora

## Regras comerciais

- Se existir conflito entre memoria solta, conversa antiga e este arquivo, este arquivo vale mais como referencia operacional.
- Nao inventar preco, desconto ou escopo fora do que estiver registrado aqui.
- Se uma proposta precisar ser excepcional, registrar a excecao aqui ou na pasta da proposta antes de tratar como padrao.
- Propostas especificas continuam vivendo em `spaces/boris/resources/leads/docs/propostas/`, mas a definicao padrao das ofertas fica aqui.

## Estado atual

Hoje este arquivo define o local canonico.
Os valores abaixo passam a valer como referencia comercial oficial atual:

- Boris Essencial: R$ 350 por grupo por mes
- Boris Escala: R$ 320 a R$ 250 por grupo por mes, conforme volume
- Boris Patrocinado: R$ 750 por grupo patrocinado por mes como ancora de entrada, R$ 900 por grupo como referencia principal, e R$ 1.200 a R$ 1.500 para grupos premium ou nichos muito valiosos

## Observacao pratica

Se no futuro a operacao ficar mais analitica, os detalhes transacionais podem ir para `resources/`, planilha ou banco.
Mas a definicao compartilhada do que o Boris vende e quanto custa deve continuar apontando para este arquivo.
