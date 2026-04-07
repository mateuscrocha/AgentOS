# Migracao Enkrateia -> Boris Comercial

## Objetivo

Trazer para o AgentOS o processo comercial herdado da Enkrateia sem transformar o legado em um bloco solto ou confuso.

## Regra de Migracao

- manter estrutura e logica util
- adaptar linguagem para o Boris
- remover trechos genericos demais
- separar metodo de operacao viva
- guardar fonte original quando fizer sentido

## Checklist

- [x] reunir documentos do legado relacionados a comercial
- [x] separar o que e processo, o que e material de apoio e o que e estado atual
- [x] resumir cada documento em 5 a 10 bullets
- [x] decidir o destino de cada item
- [ ] atualizar guidelines da area quando virar regra estavel
- [x] salvar fonte ou resumo em `processos/`
- [x] mover listas e pipeline para `leads/`
- [ ] criar notas de contas relevantes em `contas/`
- [x] atualizar `world.md` com foco comercial atual

## Mapa de Destino

- playbook de qualificacao -> `guidelines/qualificacao-e-avanco.md`
- cadencia de follow-up -> `guidelines/cadencia-follow-up.md`
- processo comercial geral -> `guidelines/processo-comercial-boris.md`
- documentos-fonte e resumos -> `resources/comercial/processos/`
- lista de leads e exportacoes -> `resources/comercial/leads/`
- notas por empresa e oportunidade -> `resources/comercial/contas/`
- pipeline atual e prioridades -> `areas/comercial/memory/world.md`

## Template de Resumo por Documento

### Nome do documento

- origem:
- tipo:
- objetivo:
- partes aproveitaveis:
- ajustes necessarios para Boris:
- destino no AgentOS:
- status da migracao:

## Materiais Ja Mapeados

### Boris - Enkrateia / `boris-operacao-leads.md`

- origem: `Boris - Enkrateia`
- tipo: playbook operacional
- objetivo: organizar, priorizar e atacar a base antiga em lotes
- partes aproveitaveis: tipos de lead, prioridade P1/P2/P3, rotina semanal, status e filtros operacionais
- ajustes necessarios para Boris: alinhar nomes de status com o pipeline principal do `sales-operator`
- destino no AgentOS: `resources/comercial/processos/boris-operacao-leads-enkrateia.md`
- status da migracao: importado

### Boris - Leads / `boris-leads-operacao.md`

- origem: `Boris - Leads`
- tipo: desenho de base mestra
- objetivo: estruturar a camada de dados de leads em bruto, processado e consolidado
- partes aproveitaveis: campos minimos, status operacionais, regras de origem e separacao entre dado bruto e consolidado
- ajustes necessarios para Boris: reconciliar o modelo de status com a operacao comercial atual
- destino no AgentOS: `resources/comercial/processos/boris-leads-operacao-legado.md`
- status da migracao: importado

### Boris - Enkrateia / `boris-base-leads-template.csv`

- origem: `Boris - Enkrateia`
- tipo: template de base
- objetivo: servir como planilha operacional inicial para consolidacao e priorizacao
- partes aproveitaveis: colunas de contexto, dor, urgencia, fit, temperatura, status e proximo passo
- ajustes necessarios para Boris: decidir se esse template vira padrao unico ou se sera mantido apenas como ponte de migracao
- destino no AgentOS: `resources/comercial/leads/boris-base-leads-template.csv`
- status da migracao: importado

### Mentoria comercial Boris / `playbook-comercial-30d.md`

- origem: `Boris - Enkrateia/docs/mentoria-comercial-boris`
- tipo: playbook estrategico-operacional
- objetivo: estruturar a sprint comercial do Boris em 30 dias
- partes aproveitaveis: ICP prioritario, tese comercial, ordem das frentes e regra de trial
- ajustes necessarios para Boris: alinhar com o CRM atual baseado em `crm_accounts`
- destino no AgentOS: `resources/comercial/processos/playbook-comercial-30d-legado.md`
- status da migracao: importado

### Mentoria comercial Boris / `primeiras-abordagens-quase-clientes.md`

- origem: `Boris - Enkrateia/docs/mentoria-comercial-boris`
- tipo: mensagens de execucao
- objetivo: usar abordagens prontas para reativar quase-clientes
- partes aproveitaveis: abertura de conversa, contexto de reentrada e tom de retomada
- ajustes necessarios para Boris: ligar cada mensagem a uma conta real no CRM ou em `contas/`
- destino no AgentOS: `resources/comercial/processos/primeiras-abordagens-quase-clientes-legado.md`
- status da migracao: importado
