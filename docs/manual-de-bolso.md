# AgentOS — Manual de Bolso

Este guia é o atalho para relembrar rapidamente o que o AgentOS faz, o que você pode pedir e por onde começar.

Se quiser a visão completa, consulte também:

- `KERNEL.md` — regras centrais do sistema
- `README.md` — visão geral do projeto
- `docs/commands.md` — referência de comandos
- `docs/system-agents.md` — referência dos agentes de sistema

---

## Como pensar o AgentOS

O AgentOS funciona como um sistema operacional para agentes.

A lógica é:

1. Você pede algo em linguagem natural ou com um comando `/...`
2. O kernel entende a intenção
3. Ele executa diretamente, roteia para um agente do sistema ou chama um agente do usuário
4. O resultado volta para você já dentro do contexto certo

Em termos práticos, você pode usar o AgentOS de três jeitos:

- como **painel de organização** do sistema
- como **fábrica de agentes, áreas, times e skills**
- como **camada operacional** para tocar tarefas reais dentro dos spaces

---

## O que você pode pedir

### 1. Entender o estado do sistema

Use quando quiser saber "o que existe hoje?".

Exemplos:

```text
/status
/health
/agora
```

Ou em linguagem natural:

```text
Me mostra um panorama do AgentOS
Quais spaces e agentes eu tenho hoje?
Faz um diagnóstico de saúde do sistema
```

### 2. Criar estrutura nova

Use quando quiser expandir o sistema.

Exemplos:

```text
/new-space nome-do-space
/new-area nome-do-space nome-da-area
/new-agent nome-do-space nome-da-area nome-do-agente
/new-team nome-do-space nome-da-area nome-do-time
/new-skill nome-do-space/nome-da-area/nome-do-agente nome-da-skill
```

Ou em linguagem natural:

```text
Cria um novo space para finanças
Cria uma área de operações no meu space
Quero um agente para revisar propostas comerciais
Cria uma skill para o agente gerar relatórios
```

### 3. Planejar antes de executar

Use quando a tarefa ainda está confusa ou envolve várias partes.

Exemplos:

```text
/plan montar operação comercial do Bóris
```

Ou:

```text
Me ajuda a estruturar essa operação antes de sair executando
Que agentes entrariam nessa tarefa?
```

### 4. Rodar workflows e coordenação

Use quando quiser orquestrar mais de uma etapa ou mais de um agente.

Exemplos:

```text
/workflows
/run nome-do-workflow
/handoff agente-a agente-b "descrição da tarefa"
```

Ou:

```text
Passa essa tarefa do agente X para o agente Y
Executa o workflow de documentação
```

### 5. Pedir entregas especializadas

O AgentOS já tem agentes e comandos voltados para entregas específicas:

- documentos Word (`/docx`)
- apresentações (`/pptx`)
- planilhas (`/xlsx`)
- PDFs (`/pdf`)
- frontend (`/frontend-design`)
- artefatos web React/TS (`/web-artifacts`)
- temas visuais (`/theme-factory`)
- identidade visual (`/brand-guidelines`)
- arte visual (`/canvas-design`)
- construção de MCP (`/mcp-builder`)

Você pode pedir de forma direta, por exemplo:

```text
Cria uma apresentação em PPTX com esse conteúdo
Monta uma planilha para acompanhar leads
Gera um PDF bonito com esse material
Desenha uma interface para o painel
```

### 6. Operar capacidades já ligadas aos spaces atuais

Hoje, olhando o runtime atual, você já tem pelo menos estes agentes de negócio registrados:

- `boris--comercial--sales-operator`
- `boris--comercial--enap-opportunity-manager`
- `boris--conteudo--editorial-strategist`
- `boris--operacoes--operations-manager`
- `boris--produto--product-manager`
- `boris--suporte--support-manager`
- `pessoal--comunicacao--whatsapp-manager`
- `pessoal--dia--day-manager`
- `pessoal--financas--household-finance-manager`

Isso significa que você pode pedir coisas como:

```text
Usa o product-manager do Bóris para pensar a estrutura de uma tela
Usa o editorial-strategist para transformar isso em pauta
Usa o whatsapp-manager para preparar uma mensagem
Usa o day-manager para me ajudar com organização do dia
Usa o household-finance-manager para consolidar minhas contas da casa
Usa /agora captura preciso decidir o pagamento do casamento
```

---

## Quando usar comando e quando usar linguagem natural

Use **comando** quando:

- você já sabe exatamente a operação
- quer consistência
- quer acionar um fluxo estrutural do sistema

Use **linguagem natural** quando:

- a demanda ainda está mal definida
- você quer ajuda para decidir o caminho
- a tarefa mistura estratégia, execução e contexto

Exemplos bons de linguagem natural:

```text
Quero organizar melhor o space do Bóris
Preciso de um agente para tocar propostas comerciais
Qual é o melhor jeito de separar produto, conteúdo e operação aqui?
```

---

## Mapa mental rápido

Se você quer...

- **ver o que existe**: `/status`
- **checar problemas**: `/health`
- **criar um novo contexto de trabalho**: `/new-space`
- **abrir uma frente dentro de um space**: `/new-area`
- **criar um novo agente**: `/new-agent`
- **dar procedimento a um agente**: `/new-skill`
- **montar um time**: `/new-team`
- **planejar antes**: `/plan`
- **ver workflows disponíveis**: `/workflows`
- **executar workflow**: `/run`
- **passar tarefa entre agentes**: `/handoff`
- **registrar ou consultar o que está rolando agora**: `/agora`
- **operar o repositório do painel do Bóris**: `/painel`

---

## Regras práticas para não se perder

- Pense em **space** como um domínio maior, como `boris` ou `pessoal`
- Pense em **area** como uma frente de trabalho, como `produto`, `conteudo` ou `comunicacao`
- Pense em **agent** como uma função especializada
- Pense em **skill** como um procedimento repetível que o agente aprende
- Use nomes em **kebab-case**
- Quando a tarefa parecer grande demais, peça primeiro um plano

---

## Perguntas úteis para fazer sempre

Quando bater dúvida, estas perguntas costumam funcionar bem:

```text
Que agente deveria cuidar disso?
Vale criar um agente novo ou usar um dos que já existem?
Essa demanda deveria virar uma skill?
Qual a melhor estrutura para esse novo space?
Me mostra os comandos que fazem sentido para esse caso
```

---

## Ponto de partida recomendado

Se a ideia for só se reorientar rapidamente no sistema, a ordem mais útil é:

1. `/status`
2. Ler este arquivo
3. Consultar `docs/commands.md` se a dúvida for operacional
4. Consultar `docs/system-agents.md` se a dúvida for "quem faz o quê?"

Se quiser, o próximo passo natural é eu transformar este manual em uma **home de navegação do AgentOS**, com índice ainda mais visual no `README.md`.
