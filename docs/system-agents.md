# Agentes do Sistema

O AgentOS tem 19 agentes de sistema — 8 de **core** (infraestrutura) e 11 com **skills Anthropic** (capacidades especializadas). Todos gerenciam infraestrutura, criam conteúdo ou orquestram workflows.

Todos os agentes de sistema estão em `system/agents/` e são invocáveis via Agent tool do Claude Code ou `@agente` no Gemini CLI.

---

## Estrutura dos arquivos de agente

Cada agente de sistema tem dois arquivos relevantes:

| Arquivo | Localização | Função |
|---|---|---|
| `AGENT.md` | `system/agents/{agente}/AGENT.md` | Definição completa: persona, capacidades, regras, colaboração, **Contexto Rápido** |
| Loader | `.claude/agents/{agente}.md` | Thin loader (~20 linhas) que instrui o Claude Code a ler o AGENT.md |

### Contexto Rápido

Todos os `AGENT.md` dos agentes de sistema contêm uma seção **Contexto Rápido** logo no início. Ela resume as regras essenciais inline, para que o agente possa agir corretamente sem precisar consultar os protocolos completos em cada operação. Os protocolos em `system/protocols/` continuam sendo a fonte de verdade para operações específicas.

### Thin loaders

Os arquivos em `.claude/agents/` são intencionalmente enxutos (~20 linhas). Eles apenas identificam o agente, definem o modelo e a cor, e instruem o Claude Code a ler o `AGENT.md` completo como primeiro passo. Toda a lógica real está no `AGENT.md`.

---

---

## agent-manager

**Arquivo:** `system/agents/agent-manager/AGENT.md`
**Claude Code:** `.claude/agents/agent-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia o ciclo de vida completo de agentes, spaces e áreas — criação, evolução, deprecação e registro. É o agente central que coordena a criação de recursos no AgentOS.

### Capacidades

- Criar novos spaces
- Criar novas áreas dentro de spaces
- Criar novos agentes dentro de áreas (ou times)
- Evoluir agentes existentes (atualizar persona, capacidades, regras)
- Deprecar agentes (marcar como inativos)
- Manter o registro mestre de agentes (`registry.md`)
- Manter os padrões de criação (`standards.md`)
- Validar que agentes seguem o formato padrão

### Skills

| Skill | Propósito |
|---|---|
| create-space | Criar novo space com estrutura completa |
| create-area | Criar nova área dentro de um space |
| create-agent | Criar novo agente dentro de uma área ou time |
| evolve-agent | Evoluir agente existente com novas capacidades ou regras |

### Colaboração

Quando cria agentes, o `agent-manager` chama automaticamente:
- `skill-manager` — para criar skills iniciais do agente
- `memory-manager` — para inicializar a memória do agente
- `team-manager` — se o agente vai para um time

### Memória

- `system/agents/agent-manager/memory/registry.md` — registro mestre de todos os agentes
- `system/agents/agent-manager/memory/standards.md` — padrões e regras de criação
- `system/agents/agent-manager/memory/history.md` — log de ações

---

## skill-manager

**Arquivo:** `system/agents/skill-manager/AGENT.md`
**Claude Code:** `.claude/agents/skill-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia skills no AgentOS — criação, validação, registro e descoberta. Garante que cada skill é bem definida, validada e registrada corretamente.

### Capacidades

- Criar novas skills para agentes (sistema ou usuário)
- Validar formato e conteúdo de `SKILL.md`
- Manter o registro mestre de skills (`skill-registry.md`)
- Descobrir skills disponíveis para um agente
- Sugerir skills baseado nas capacidades do agente

### Skills e Ferramentas

| Recurso | Propósito |
|---|---|
| skill-creator (global) | Processo completo de criação: entrevista, draft, testes, avaliação, iteração |
| validate-skill | Validar formato AgentOS de uma skill |

O `skill-manager` usa o `skill-creator` (skill global em `system/skills/skill-creator/`) para criar skills. Após a criação, faz a integração: valida o formato, registra no `skill-registry` e publica evento no bus.

### Memória

- `system/agents/skill-manager/memory/skill-registry.md` — registro mestre de todas as skills
- `system/agents/skill-manager/memory/history.md` — log de ações

---

## memory-manager

**Arquivo:** `system/agents/memory-manager/AGENT.md`
**Claude Code:** `.claude/agents/memory-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia toda a memória do AgentOS — inicialização, escopo, limpeza e mapeamento. É o responsável por garantir que a memória está corretamente estruturada e limpa.

### Capacidades

- Inicializar memória para novos agentes, spaces, áreas e times
- Aplicar e validar regras de escopo de memória
- Limpar handoffs concluídos e entradas antigas do bus
- Manter o mapa de memória (`memory-map.md`)
- Auditar violações de escopo
- Arquivar históricos antigos

### Skills

| Skill | Propósito |
|---|---|
| init-memory | Inicializar memória para novo recurso (agente, space, área, time) |
| cleanup-memory | Limpar memória stale (handoffs concluídos, históricos antigos) |

### Memória

- `system/agents/memory-manager/memory/memory-map.md` — mapa de todos os locais de memória
- `system/agents/memory-manager/memory/history.md` — log de ações

---

## team-manager

**Arquivo:** `system/agents/team-manager/AGENT.md`
**Claude Code:** `.claude/agents/team-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia times no AgentOS — criação, composição, comunicação e coordenação de times de agentes.

### Capacidades

- Criar novos times dentro de áreas
- Adicionar e remover membros de times
- Definir agente líder do time
- Configurar comunicação do time (handoff.md, world.md)
- Manter o registro de times (`team-registry.md`)
- Configurar workflows de time

### Skills

| Skill | Propósito |
|---|---|
| create-team | Criar novo time dentro de uma área |
| manage-members | Adicionar ou remover membros de um time |

### Regras importantes

- Todo time deve ter exatamente um agente líder
- Só agentes que existem na área podem ser adicionados ao time
- Cada time tem sua própria memória isolada (`world.md` e `handoff.md`)

### Memória

- `system/agents/team-manager/memory/team-registry.md` — registro mestre de todos os times
- `system/agents/team-manager/memory/history.md` — log de ações

---

## doc-manager

**Arquivo:** `system/agents/doc-manager/AGENT.md`
**Claude Code:** `.claude/agents/doc-manager.md`
**Status:** Ativo

### Responsabilidade

Gera e mantém toda a documentação do AgentOS — arquitetura, guias, referências e README. Lê o estado atual do sistema e produz documentação precisa e atualizada.

### Capacidades

- Gerar documentação completa do sistema em `docs/`
- Atualizar documentação individual quando o estado do sistema muda
- Gerar `README.md` a partir do conteúdo dos docs
- Auditar docs existentes para completude e acurácia
- Manter o registro de documentos (`doc-registry.md`)

### Skills

| Skill | Propósito |
|---|---|
| generate-docs | Gerar/atualizar toda a documentação em `docs/` |
| generate-readme | Gerar `README.md` a partir dos docs existentes |
| audit-docs | Auditar completude e acurácia dos docs contra o estado real |

### Memória

- `system/agents/doc-manager/memory/doc-registry.md` — registro de docs gerados e timestamps
- `system/agents/doc-manager/memory/history.md` — log de ações

---

## health-monitor

**Arquivo:** `system/agents/health-monitor/AGENT.md`
**Claude Code:** `.claude/agents/health-monitor.md`
**Status:** Ativo

### Responsabilidade

Diagnostica problemas de integridade no AgentOS — verifica consistência entre registros e filesystem, detecta handoffs órfãos, arquivos desatualizados e drift de estado. Age como o "médico" do sistema: examina, diagnostica e encaminha, mas nunca opera.

### Capacidades

- Verificar consistência entre registros e filesystem (agentes, skills, times)
- Detectar handoffs pendentes há muito tempo (órfãos)
- Verificar se arquivos `.claude/agents/` apontam para AGENT.md existentes
- Verificar se world.md está atualizado em todos os escopos
- Verificar tamanho do bus.md e history.md contra thresholds de manutenção
- Gerar relatório estruturado de saúde do sistema
- Criar handoffs para agentes responsáveis quando encontrar problemas

### Skills

| Skill | Propósito |
|---|---|
| check-health | Scan completo de integridade do sistema |
| check-handoffs | Detectar handoffs stale em todos os escopos |
| generate-report | Produzir relatório estruturado de saúde |

### Colaboração

O `health-monitor` nunca corrige problemas diretamente — sempre delega via handoff:
- Registro inconsistente com filesystem → `agent-manager`
- Memória que precisa de cleanup → `memory-manager`
- Skill registrada mas inexistente → `skill-manager`
- Time registrado mas inexistente → `team-manager`
- Docs desatualizados detectados → `doc-manager`

### Memória

- `system/agents/health-monitor/memory/history.md` — log de checks executados
- `system/agents/health-monitor/memory/last-report.md` — último relatório de saúde do sistema
- `system/agents/health-monitor/memory/known-issues.md` — issues conhecidos (evita re-reportar o mesmo problema)

---

## task-runner

**Arquivo:** `system/agents/task-runner/AGENT.md`
**Claude Code:** `.claude/agents/task-runner.md`
**Status:** Ativo

### Responsabilidade

Orquestra workflows multi-agente — encadeia invocações de agentes com dependências, retry e rastreamento de progresso. Coordena operações que envolvem múltiplos agentes, garantindo que cada passo é executado na ordem correta e com os inputs certos.

### Capacidades

- Executar workflows multi-passo com dependências entre agentes
- Rastrear progresso passo a passo em `active-workflows.md`
- Retomar workflows pausados ou que falharam em um passo intermediário
- Criar e salvar definições de workflow reutilizáveis
- Fan-out: executar passos independentes em paralelo (múltiplas chamadas Agent tool)
- Fan-in: coletar resultados de passos paralelos antes de continuar

### Skills

| Skill | Propósito |
|---|---|
| run-workflow | Executar um workflow (definido ou ad-hoc) |
| create-workflow | Criar definição reutilizável de workflow |
| resume-workflow | Retomar workflow pausado/falho |

### Colaboração

O `task-runner` invoca outros agentes de sistema diretamente via Agent tool:
- `agent-manager` — para criar agentes, spaces ou áreas
- `skill-manager` — para criar skills
- `memory-manager` — para inicializar memória ou fazer cleanup
- `team-manager` — para criar times
- `doc-manager` — para atualizar docs

Trabalha em par com o `workflow-planner`: recebe planos aprovados pelo usuário e os executa.

### Memória

- `system/agents/task-runner/memory/history.md` — log de workflows executados (nome, data, status final, passos)
- `system/agents/task-runner/memory/active-workflows.md` — workflows em andamento com status por passo
- `system/workflows/` — definições reutilizáveis de workflows

---

## workflow-planner

**Arquivo:** `system/agents/workflow-planner/AGENT.md`
**Claude Code:** `.claude/agents/workflow-planner.md`
**Status:** Ativo

### Responsabilidade

Traduz intenção do usuário em planos de execução concretos — decompõe requests complexos em passos atômicos antes da execução. Age como um query planner: recebe a intenção e produz o plano de execução otimizado antes de executar qualquer coisa.

### Capacidades

- Analisar requests complexos do usuário e decompor em passos atômicos
- Consultar registros para entender o estado atual do sistema
- Determinar ordem de execução e dependências entre passos
- Identificar quais agentes e skills são necessários para cada passo
- Estimar impacto (arquivos e diretórios que serão criados/modificados)
- Apresentar plano formatado para revisão do usuário
- Encaminhar plano aprovado para o task-runner

### Skills

| Skill | Propósito |
|---|---|
| plan-action | Analisar request e produzir plano de execução |
| estimate-impact | Listar impacto previsto antes da execução |

### Colaboração

O `workflow-planner` nunca executa — apenas planeja e encaminha:
- Após aprovação do usuário, o kernel encaminha o plano para o `task-runner` executar
- Consulta registros de `agent-manager`, `skill-manager` e `team-manager` diretamente (sem invocação) para entender o estado atual

### Regras importantes

- Nunca executar diretamente — a execução é responsabilidade exclusiva do task-runner
- Sempre apresentar o plano ao usuário antes de encaminhar para execução
- Cada passo do plano deve corresponder a exatamente uma chamada a um agente/skill existente

### Memória

- `system/agents/workflow-planner/memory/history.md` — log de planos criados
- `system/agents/workflow-planner/memory/plan-templates.md` — padrões recorrentes identificados

---

## brand-guidelines

**Arquivo:** `system/agents/brand-guidelines/AGENT.md`
**Claude Code:** `.claude/agents/brand-guidelines.md`
**Status:** Ativo

### Responsabilidade

Aplica identidade visual Anthropic a artefatos visuais — paleta de cores, tipografia e padrões de marca.

### Capacidades

- Aplicar paleta de cores Anthropic (#141413 dark, #faf9f5 light + accent colors)
- Configurar tipografia (Poppins para headers, Lora para body)
- Garantir acessibilidade e consistência visual em artefatos
- Usar RGBColor para cores via python-pptx

### Skills

| Skill | Propósito |
|---|---|
| brand-guidelines (global) | Recursos de identidade visual Anthropic |

### Memória

- `system/agents/brand-guidelines/memory/history.md` — log de ações

---

## canvas-design

**Arquivo:** `system/agents/canvas-design/AGENT.md`
**Claude Code:** `.claude/agents/canvas-design.md`
**Status:** Ativo

### Responsabilidade

Cria arte visual sofisticada em PDF e PNG com filosofia de design e expressão artística de qualidade museu.

### Capacidades

- Articular filosofia de design (4-6 parágrafos de comunicação visual)
- Criar trabalhos visuais em PDF e PNG
- Aplicar princípios de composição, cor, espaço e forma
- Tratar texto como elemento visual com tipografia mínima

### Skills

| Skill | Propósito |
|---|---|
| canvas-design (global) | Criação de arte visual com filosofia de design |

### Memória

- `system/agents/canvas-design/memory/history.md` — log de ações

---

## doc-coauthoring

**Arquivo:** `system/agents/doc-coauthoring/AGENT.md`
**Claude Code:** `.claude/agents/doc-coauthoring.md`
**Status:** Ativo

### Responsabilidade

Conduz workflow colaborativo de criação de documentos em 3 estágios — coleta de contexto, refinamento e teste de leitura.

### Capacidades

- Conduzir perguntas de meta-contexto sobre documento, audiência e impacto
- Iterar seção por seção com brainstorming, curadoria e gap-checking
- Validar documentos com teste de leitura via sub-agentes
- Editar com str_replace ao invés de reimprimir documentos inteiros

### Skills

| Skill | Propósito |
|---|---|
| doc-coauthoring (global) | Workflow colaborativo de documentos em 3 estágios |

### Memória

- `system/agents/doc-coauthoring/memory/history.md` — log de ações

---

## docx-manager

**Arquivo:** `system/agents/docx-manager/AGENT.md`
**Claude Code:** `.claude/agents/docx-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia documentos Word (.docx) — criação, leitura, edição, manipulação XML e conversão de formato.

### Capacidades

- Criar documentos Word com formatação profissional (tabelas, listas, estilos)
- Ler e extrair conteúdo de documentos existentes
- Editar documentos via manipulação XML
- Converter documentos para PDF e imagens
- Gerenciar tracked changes e comentários

### Skills

| Skill | Propósito |
|---|---|
| docx (global) | Manipulação completa de documentos Word |

### Memória

- `system/agents/docx-manager/memory/history.md` — log de ações

---

## pptx-manager

**Arquivo:** `system/agents/pptx-manager/AGENT.md`
**Claude Code:** `.claude/agents/pptx-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia apresentações PowerPoint (.pptx) — criação, edição, análise visual e design de slides.

### Capacidades

- Criar apresentações do zero com pptxgenjs
- Editar apresentações existentes via template workflow (7 passos)
- Gerar thumbnails visuais para inspeção
- Aplicar padrões de design (cores, tipografia, layout)
- Executar QA visual com subagentes

### Skills

| Skill | Propósito |
|---|---|
| pptx (global) | Criação e edição de apresentações PowerPoint |

### Memória

- `system/agents/pptx-manager/memory/history.md` — log de ações

---

## xlsx-manager

**Arquivo:** `system/agents/xlsx-manager/AGENT.md`
**Claude Code:** `.claude/agents/xlsx-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia planilhas Excel (.xlsx, .xlsm, .csv) — criação, formatação, fórmulas e análise de dados.

### Capacidades

- Criar planilhas com formatação profissional e fórmulas dinâmicas
- Aplicar padrões financeiros (color coding, number formatting)
- Manipular dados com pandas e openpyxl
- Recalcular fórmulas via LibreOffice

### Skills

| Skill | Propósito |
|---|---|
| xlsx (global) | Operações completas com planilhas Excel |

### Memória

- `system/agents/xlsx-manager/memory/history.md` — log de ações

---

## pdf-manager

**Arquivo:** `system/agents/pdf-manager/AGENT.md`
**Claude Code:** `.claude/agents/pdf-manager.md`
**Status:** Ativo

### Responsabilidade

Gerencia documentos PDF — leitura, criação, merge, split, formulários e OCR.

### Capacidades

- Ler e extrair texto e tabelas de PDFs (pypdf, pdfplumber)
- Criar PDFs com reportlab (texto, múltiplas páginas, formatação)
- Merge, split, rotacionar e aplicar watermarks
- Preencher formulários (fillable e non-fillable)
- Converter PDFs para imagens e vice-versa

### Skills

| Skill | Propósito |
|---|---|
| pdf (global) | Processamento completo de PDFs |

### Memória

- `system/agents/pdf-manager/memory/history.md` — log de ações

---

## frontend-design

**Arquivo:** `system/agents/frontend-design/AGENT.md`
**Claude Code:** `.claude/agents/frontend-design.md`
**Status:** Ativo

### Responsabilidade

Cria interfaces frontend production-grade com design distintivo e alta qualidade visual.

### Capacidades

- Criar interfaces web com design distintivo e production-grade
- Aplicar princípios de tipografia, cor, motion e composição espacial
- Evitar estéticas genéricas e padrões visuais clichê
- Selecionar fontes únicas e esquemas de cores coesos

### Skills

| Skill | Propósito |
|---|---|
| frontend-design (global) | Criação de interfaces frontend com design distintivo |

### Memória

- `system/agents/frontend-design/memory/history.md` — log de ações

---

## theme-factory

**Arquivo:** `system/agents/theme-factory/AGENT.md`
**Claude Code:** `.claude/agents/theme-factory.md`
**Status:** Ativo

### Responsabilidade

Toolkit de temas profissionais — aplica paletas de cores e tipografia coordenadas a artefatos visuais.

### Capacidades

- Exibir showcase dos 10 temas disponíveis
- Aplicar temas pré-configurados a apresentações, documentos e landing pages
- Gerar temas customizados quando os padrão não atendem
- Garantir consistência de cores e fontes em todo o artefato

### Skills

| Skill | Propósito |
|---|---|
| theme-factory (global) | 10 temas profissionais + geração de temas custom |

### Memória

- `system/agents/theme-factory/memory/history.md` — log de ações

---

## web-artifacts-builder

**Arquivo:** `system/agents/web-artifacts-builder/AGENT.md`
**Claude Code:** `.claude/agents/web-artifacts-builder.md`
**Status:** Ativo

### Responsabilidade

Cria artefatos web sofisticados com React 18, TypeScript, Tailwind CSS e shadcn/ui, bundled em HTML único.

### Capacidades

- Inicializar projetos com stack completa (React 18 + TS + Vite + Parcel)
- Desenvolver artefatos multi-componente com 40+ componentes shadcn/ui
- Bundlar em HTML único autocontido para compartilhamento
- Aplicar design distintivo evitando estéticas genéricas

### Skills

| Skill | Propósito |
|---|---|
| web-artifacts-builder (global) | Criação de artefatos web React/TS bundled |

### Memória

- `system/agents/web-artifacts-builder/memory/history.md` — log de ações

---

## mcp-builder

**Arquivo:** `system/agents/mcp-builder/AGENT.md`
**Claude Code:** `.claude/agents/mcp-builder.md`
**Status:** Ativo

### Responsabilidade

Constrói servidores MCP (Model Context Protocol) de alta qualidade em TypeScript ou Python, com avaliações integradas.

### Capacidades

- Projetar e implementar MCP servers com pesquisa profunda (4 fases)
- Implementar em TypeScript (SDK Node) ou Python (FastMCP)
- Criar ferramentas com schemas de input/output, descrições e anotações
- Gerar avaliações com 10 questões complexas e realistas

### Skills

| Skill | Propósito |
|---|---|
| mcp-builder (global) | Construção completa de MCP servers |

### Memória

- `system/agents/mcp-builder/memory/history.md` — log de ações

---

## Interação entre agentes de sistema

```
Criação de space
    agent-manager → memory-manager (init-memory do space)

Criação de área
    agent-manager → memory-manager (init-memory da área)

Criação de agente
    agent-manager → memory-manager (init-memory do agente)
    agent-manager → skill-manager (criar skills iniciais)
    agent-manager → team-manager (adicionar ao time, se aplicável)

Criação de skill
    skill-manager → usa skill-creator (global)
    skill-manager → memory-manager (se a skill precisa de memória)

Criação de time
    team-manager → agent-manager (verificar que agentes existem)
    team-manager → memory-manager (init-memory do time)
    team-manager → skill-manager (skills compartilhadas, se necessário)

Geração de documentação
    doc-manager → lê registros de todos os agentes (diretamente)

Diagnóstico de saúde
    health-monitor → lê registros de todos os agentes (sem escrita)
    health-monitor → agent-manager (handoff: registro inconsistente)
    health-monitor → memory-manager (handoff: cleanup necessário)
    health-monitor → doc-manager (handoff: docs desatualizados)

Execução de workflow
    kernel → workflow-planner (planejar request complexo)
    workflow-planner → apresenta plano ao usuário
    kernel → task-runner (executar plano aprovado)
    task-runner → agentes individuais (invocação direta por passo)
```

---

## Documentação relacionada

- [Arquitetura](architecture.md) — estrutura geral do sistema
- [Protocolos](protocols.md) — como agentes se comunicam
- [Criando spaces, áreas e agentes](creating-projects.md) — uso prático dos agentes de sistema
