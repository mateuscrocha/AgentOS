window.PROJECT_MANAGER_STATE = {
  meta: {
    title: "Linha viva dos seus projetos",
    currentMode: "Base pronta para atualizações diárias",
    focusTitle:
      "A timeline agora é o centro do painel e vai concentrar o que aconteceu, o que está em andamento e onde há risco.",
    focusSummary:
      "A cada relato seu, eu converto o dia em marcos, faixas de execução e sinais de risco para você bater o olho e entender o sistema inteiro.",
    nextCheckIn: "Me mande o resumo do dia para alimentar a linha do tempo",
    lastUpdated: "Atualizado em 15/05/2026 com a primeira estrutura temporal."
  },
  priorities: [
    "Definir os projetos ativos que entram no radar.",
    "Começar a registrar decisões e bloqueios na timeline.",
    "Usar o painel como fonte única de leitura do dia."
  ],
  blockers: [
    "Ainda faltam os projetos reais do seu dia a dia.",
    "Ainda não temos histórico suficiente para leitura de padrão."
  ],
  ganttTasks: [
    {
      id: 1,
      name: "Estruturar o novo Project Manager",
      start: "2026-04-20",
      end: "2026-04-25",
      progress: 72,
      custom_class: "task-execution",
      tag: "execução",
      description:
        "Criação do projeto isolado, base de interface e preparação para atualizações diárias.",
      meta: ["Origem: pedido inicial", "Status: em andamento", "Leitura: fundação do sistema"]
    },
    {
      id: 2,
      name: "Projeto separado confirmado",
      start: "2026-04-26",
      end: "2026-04-27",
      progress: 100,
      custom_class: "task-milestone",
      tag: "marco",
      description:
        "Decisão de manter este painel como projeto próprio, sem misturar com os outros workspaces.",
      meta: ["Impacto: alto", "Tipo: decisão estrutural"]
    },
    {
      id: 3,
      name: "Ritual diário pendente de ativação",
      start: "2026-04-28",
      end: "2026-05-03",
      progress: 24,
      custom_class: "task-execution",
      tag: "execução",
      description:
        "Este espaço agora espera seus relatos do dia para começar a gerar histórico operacional.",
      meta: ["Dependência: seu primeiro resumo", "Frequência: diária"]
    },
    {
      id: 4,
      name: "Risco: nenhum projeto cadastrado ainda",
      start: "2026-05-01",
      end: "2026-05-04",
      progress: 18,
      custom_class: "task-risk",
      tag: "risco",
      description:
        "Sem os projetos reais, a timeline ainda não consegue mostrar prioridade, carga e pressão entre frentes.",
      meta: ["Severidade: média", "Ação: cadastrar projetos ativos"]
    }
  ],
  projects: [
    {
      name: "Base do Project Manager",
      status: "andamento",
      statusLabel: "em andamento",
      summary:
        "Estrutura inicial pronta, agora a prioridade é alimentar o painel com a operação real.",
      progress: 52,
      priority: "alta",
      nextStep: "registrar projetos ativos"
    },
    {
      name: "Ritual diário de atualização",
      status: "planejado",
      statusLabel: "planejado",
      summary:
        "Fluxo em que você me relata o dia e eu transformo isso em visão gerencial dentro do painel.",
      progress: 20,
      priority: "alta",
      nextStep: "fazer o primeiro update"
    }
  ],
  nextActions: [
    {
      done: true,
      title: "Criar projeto separado",
      description: "O painel existe como projeto próprio e não interfere nos outros."
    },
    {
      done: true,
      title: "Trocar a timeline manual por biblioteca real",
      description: "A timeline central agora usa um componente temporal dedicado."
    },
    {
      done: false,
      title: "Cadastrar seus projetos reais",
      description: "Nome, status, prioridade, pressão atual e próximo passo."
    },
    {
      done: false,
      title: "Registrar o primeiro dia útil",
      description: "Transformar o que aconteceu em eventos, faixas e riscos."
    }
  ]
};
