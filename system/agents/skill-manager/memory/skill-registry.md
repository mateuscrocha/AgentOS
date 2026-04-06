# Registro de Skills — AgentOS

> Gerado automaticamente em 2026-03-23 08:37 por `generate-registries.py`. Atualizado manualmente em 2026-03-24 por skill-manager (HM-008, HM-009).

## Skills do Sistema

| Skill | Agente | Descrição |
|---|---|---|
| skill-creator | global | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy. |
| agent-bootstrap | agent-manager | Skill interna do sistema para criar a estrutura completa de um novo agente do usuário — diretórios, AGENT.md a partir de template, memory/history.md, definição nativa .claude/agents/ e registros de registry e bus. |
| create-agent | agent-manager | Cria um novo agente do usuário dentro de uma area ou team existente |
| create-area | agent-manager | Cria uma nova area dentro de um space existente |
| create-space | agent-manager | Cria um novo space com toda a estrutura de diretórios e memória |
| evolve-agent | agent-manager | Evolui um agente existente — atualiza persona, capacidades, regras ou skills |
| audit-docs | doc-manager | Audita a documentação existente para completude e acurácia contra o estado atual do sistema |
| generate-docs | doc-manager | Gera ou atualiza toda a documentação do AgentOS no diretório docs/ |
| generate-readme | doc-manager | Gera o README.md do projeto a partir dos documentos em docs/ |
| check-handoffs | health-monitor | Detecta handoffs stale (Pendente por muito tempo) em todos os escopos do sistema |
| check-health | health-monitor | Scan completo de integridade do sistema — verifica consistência entre registros e filesystem |
| generate-report | health-monitor | Produz relatório estruturado de saúde do sistema em last-report.md |
| cleanup-memory | memory-manager | Limpa memória stale — handoffs concluídos, entradas antigas do bus e históricos extensos |
| init-memory | memory-manager | Inicializa memória para um novo recurso (agente, space, area ou time) |
| validate-skill | skill-manager | Valida o formato e conteúdo de um SKILL.md contra os padrões do AgentOS |
| create-workflow | task-runner | Cria definição reutilizável de workflow em system/workflows/ |
| resume-workflow | task-runner | Retoma um workflow pausado ou que falhou no meio da execução |
| run-workflow | task-runner | Executa um workflow multi-agente — sequencial ou com dependências paralelas |
| create-team | team-manager | Cria um novo time dentro de uma area, com memória e comunicação |
| manage-members | team-manager | Adiciona ou remove membros de um time existente |
| estimate-impact | workflow-planner | Lista arquivos e diretórios que serão criados ou modificados pela execução de um plano |
| plan-action | workflow-planner | Analisa request do usuário e produz plano de execução passo-a-passo |
| brand-guidelines | global | Recursos de identidade visual Anthropic — paleta de cores, tipografia e aplicação de marca em artefatos visuais |
| canvas-design | global | Criação de arte visual sofisticada em PDF e PNG com filosofia de design e expressão artística |
| doc-coauthoring | global | Workflow colaborativo de criação de documentos em 3 estágios — coleta de contexto, refinamento e teste de leitura |
| docx | global | Criar, ler, editar e manipular documentos Word (.docx) — formatação, XML, tracked changes e conversão |
| pptx | global | Criar, editar e analisar apresentações PowerPoint (.pptx) — design de slides, templates e QA visual |
| xlsx | global | Operações com planilhas Excel (.xlsx, .xlsm, .csv) — criação, fórmulas, formatação e análise de dados |
| pdf | global | Processamento completo de PDFs — leitura, criação, merge, split, formulários, OCR e conversão |
| frontend-design | global | Criação de interfaces frontend production-grade com design distintivo e alta qualidade visual |
| theme-factory | global | Toolkit de temas profissionais — 10 temas pré-configurados + geração de temas customizados |
| web-artifacts-builder | global | Criação de artefatos web sofisticados com React 18, TypeScript, Tailwind CSS e shadcn/ui |
| mcp-builder | global | Construção de servidores MCP (Model Context Protocol) em TypeScript ou Python com avaliações |

## Skills do Usuário

| Skill | Agente | Descrição |
|---|---|---|
| run-daily-checkin | day-manager | Organiza um check-in diário com prioridades, compromissos, capturas e próximo passo |
