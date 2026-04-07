# Inteligência de Reuniões do Boris

## Objetivo

Formalizar que reuniões com cliente, lead, prospect, parceiro ou qualquer conversa que possa gerar conteúdo, atividade operacional, decisão comercial, aprendizado de suporte ou melhoria de produto para o Bóris devem ser tratadas como insumo oficial do sistema.

## Regra Herdável

Toda reunião relevante para o Bóris deve gerar memória persistente no AgentOS.

Isso vale para:

- call de vendas
- descoberta com lead
- reunião com cliente
- alinhamento de piloto
- revisão de operação
- reunião de produto
- conversa de suporte com aprendizado recorrente

## Entrada Esperada

Sempre que possível, a entrada deve chegar em um destes formatos:

- transcrição completa
- resumo bruto da reunião
- áudio com contexto suficiente para transcrição
- anotações soltas do usuário logo após a call

Mesmo quando a informação vier incompleta, ela deve ser consolidada em vez de ser descartada.

## Saída Obrigatória

Quando uma reunião relevante for trazida para o AgentOS, o sistema deve:

1. armazenar a reunião em local oficial da biblioteca do Bóris
2. extrair contexto persistente útil
3. registrar próximos passos claros
4. atualizar os artefatos mais adequados do domínio afetado

## Local Oficial de Armazenamento

O acervo primário de reuniões do Bóris fica em:

`spaces/boris/resources/reunioes/`

Convenção recomendada:

- uma pasta ou arquivo por reunião
- nome iniciado por data ISO quando houver data conhecida
- incluir empresa, contato ou tema principal no nome

Exemplos:

- `2026-04-06-bilheteria-digital-piloto-whatsapp/`
- `2026-04-06-bilheteria-digital-guilherme-marra-matheus-prado.md`
- `2026-04-07-revisao-painel-analytics-boris.md`

## Consolidação Mínima

Cada reunião relevante deve procurar registrar, quando possível:

- participantes
- tipo de reunião
- contexto
- dores explicitadas
- objeções e riscos
- oportunidades
- decisões tomadas
- próximos passos
- impacto esperado em comercial, produto, suporte, operação ou conteúdo

## Regra de Propagação

Além de armazenar a reunião em `resources/reunioes/`, o sistema deve refletir os aprendizados no lugar certo, quando fizer sentido:

- conta ou oportunidade comercial em `spaces/boris/resources/comercial/`
- guideline ou hipótese de produto em `spaces/boris/areas/produto/`
- pauta editorial ou tese de conteúdo em `spaces/boris/resources/content/` ou `spaces/boris/resources/editorial/`
- fluxo operacional ou recorrência de suporte nas áreas correspondentes

## Regra de Prioridade

Se houver dúvida sobre a relevância, considerar a reunião como relevante por padrão quando ela puder:

- gerar tarefa
- alterar leitura de ICP
- mudar direção de produto
- virar conteúdo
- alimentar proposta comercial
- revelar dor recorrente
- expor gargalo operacional

## Aplicação Prática Neste Workspace

Quando o usuário disser que vai enviar uma transcrição depois, isso deve ser tratado como pendência real de memória e consolidação, não como contexto descartável.

No caso de contas já abertas, como Bilheteria Digital, a reunião deve depois alimentar também o arquivo da conta e o próximo passo comercial correspondente.
