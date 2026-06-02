# Loop de Inteligência do Cliente do Bóris

## Objetivo

Formalizar o caminho oficial para transformar materiais brutos do mercado e dos clientes em inteligência que influencia decisões técnicas e estratégicas.

## Matéria-prima aceitada

- transcrição de reunião
- resumo pós-call
- pesquisa de mercado
- benchmark
- insight solto do fundador
- padrão percebido em onboarding, suporte, vendas ou comunidade

## Regra de organização

1. Reunião, call e transcrição bruta vão para `spaces/boris/resources/reunioes/`.
2. Pesquisa e benchmark vão para `spaces/boris/resources/inteligencia-cliente/pesquisas/`.
3. O que virar leitura acionável e transversal vai para `spaces/boris/resources/inteligencia-cliente/sinteses/`.
4. O que começar a se repetir como padrão sobe para `spaces/boris/resources/inteligencia-cliente/radar-de-dores-e-oportunidades.md`.

## Perguntas obrigatórias da consolidação

Toda síntese deve tentar responder:

- o que foi dito ou observado de fato
- o que isso sugere
- qual dor, desejo, objeção ou risco apareceu
- isso muda algo em produto, comercial, conteúdo, suporte ou operações
- qual próximo passo vale executar agora

## Regra de propagação

Se um aprendizado impactar um domínio específico, ele não deve ficar só na síntese central.

Exemplos:

- objeção de venda recorrente deve alimentar comercial
- pedido de feature ou fricção de uso deve alimentar produto
- linguagem viva do cliente deve alimentar conteúdo
- gargalo de onboarding deve alimentar suporte e operações

## Regra de qualidade

- separar fato de interpretação
- registrar ambiguidades quando a transcrição estiver ruim
- preferir clareza operacional a excesso de teoria
- evitar acúmulo passivo de material sem síntese

## Padrão Oficial para Toda Nova Transcrição

Sempre que o usuário enviar uma nova transcrição de call, reunião, áudio ou conversa com cliente, o fluxo padrão passa a ser este, salvo instrução explícita em contrário:

1. Consolidar a reunião em `spaces/boris/resources/reunioes/`
2. Gerar uma síntese estratégica em `spaces/boris/resources/inteligencia-cliente/sinteses/`
3. Criar ou atualizar o dossiê da conta em `spaces/boris/resources/comercial/contas/`
4. Atualizar o `radar-de-dores-e-oportunidades.md` quando houver padrão novo ou repetição relevante
5. Regenerar a base do dashboard quando a transcrição impactar a inteligência operacional consumida pela interface
6. Devolver ao usuário uma leitura curta da call com:
   - tese principal
   - dores
   - objeções
   - sinais de interesse
   - próximos passos

## Checklist Obrigatório por Transcrição

Para considerar o trabalho completo, cada nova transcrição deve responder pelo menos:

- quem é a conta e qual o contexto
- o que foi dito de fato
- qual foi a principal dor percebida
- quais objeções, riscos ou travas apareceram
- o que gerou aderência ou sinal de valor
- qual hipótese comercial isso sugere
- qual próximo passo vale tomar agora
- se isso muda algo em produto, comercial, conteúdo, suporte ou operações

## Regra de Atualização do Dashboard

Se a transcrição gerar ou alterar:

- uma nova conta
- uma nova síntese
- um novo dossiê comercial
- ou campos que alimentam score, dores, objeções, soluções e timeline

então o fluxo padrão inclui regenerar a base do dashboard em `spaces/boris/projects/customer-intelligence-dashboard/`.

## Exceções

O protocolo acima só não deve ser seguido integralmente quando o usuário pedir explicitamente algo mais restrito, por exemplo:

- “só resume”
- “não registra isso ainda”
- “não atualiza o dashboard”
- “quero apenas análise verbal”
