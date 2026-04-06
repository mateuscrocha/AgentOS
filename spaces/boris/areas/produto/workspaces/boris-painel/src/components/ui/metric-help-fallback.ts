import type { MetricHelpContent } from "@/components/ui/metric-help";

const normalizeTitle = (title: string) => title.trim().toLowerCase();

const help = (
  whatIs: string,
  howToInterpret: string,
  whatToObserve?: string,
  groupContext?: string,
): MetricHelpContent => ({
  whatIs,
  howToInterpret,
  whatToObserve,
  groupContext,
});

const exactHelpByTitle: Record<string, MetricHelpContent> = {
  "mensagens totais": help(
    "Total acumulado de mensagens registradas na base do sistema.",
    "Mostra o tamanho histórico da base. É um número cumulativo, então tende a apenas crescer.",
    "Use em conjunto com métricas por período (ex.: 30d) para entender ritmo recente vs. acervo total.",
  ),
  "mensagens (30d)": help(
    "Quantidade de mensagens enviadas nos últimos 30 dias.",
    "Mostra o volume recente de uso. Compare com o período anterior para identificar aceleração, estabilidade ou queda.",
    "Quedas com base ativa estável podem indicar menor frequência; altas com poucos ativos podem indicar concentração.",
  ),
  "membros ativos (30d)": help(
    "Pessoas que enviaram pelo menos uma mensagem nos últimos 30 dias.",
    "Indica o tamanho da base realmente participante no período, e não apenas cadastrada no grupo.",
    "Compare com participação (%) e total de membros para avaliar engajamento real.",
  ),
  "participação (30d)": help(
    "Percentual de membros que enviaram mensagem nos últimos 30 dias.",
    "Mede engajamento relativo da base. Valores maiores indicam uma parcela maior de membros participando.",
    "Avalie junto de volume de mensagens e membros ativos para evitar leitura isolada.",
  ),
  "organizações": help(
    "Quantidade total de organizações no recorte exibido.",
    "É um indicador de base/escopo. Em páginas do sistema, normalmente representa a cobertura total monitorada.",
    "Compare com grupos, atividade e crescimento para entender expansão e uso.",
  ),
  "grupos": help(
    "Quantidade de grupos no recorte exibido.",
    "Indica tamanho da operação monitorada. O valor ideal depende do contexto da tela (sistema, organização ou filtros).",
    "Cruze com atividade, membros e mensagens para distinguir escala de uso real.",
  ),
  "mensagens": help(
    "Total de mensagens no período selecionado para o grupo.",
    "Mostra o volume bruto da conversa. Variações ajudam a identificar picos, esfriamento ou estabilidade.",
    "Leia junto de ativos e participação para entender se o volume está distribuído ou concentrado.",
  ),
  "ativos": help(
    "Quantidade de participantes ativos no período selecionado.",
    "Mostra quantas pessoas efetivamente falaram no período. Não representa quem apenas visualizou.",
    "Compare com participação (%) e total de membros para medir amplitude da conversa.",
  ),
  "participação": help(
    "Percentual de membros do grupo que participaram com mensagem no período.",
    "Mede engajamento relativo da base. Percentuais maiores indicam maior alcance da conversa entre os membros.",
    "Observe a tendência e compare com volume de mensagens para evitar leituras distorcidas por picos.",
  ),
  "crescimento": help(
    "Saldo de crescimento do grupo no período (entradas menos saídas).",
    "Valores positivos indicam expansão; negativos indicam retração da base.",
    "Observe sequência de períodos e compare com participação para entender qualidade do crescimento.",
  ),
  "não lidos": help(
    "Quantidade atual de alertas/eventos ainda não marcados como lidos.",
    "Mostra a fila de atenção pendente. Valores altos podem indicar acúmulo operacional.",
    "Observe se cresce continuamente e relacione com capacidade de triagem.",
  ),
  "definições": help(
    "Total de definições de alertas/termos monitorados cadastradas.",
    "Mostra o tamanho da configuração de monitoramento ativa na tela de alertas.",
    "Revise se o volume faz sentido com a capacidade de acompanhamento para evitar ruído.",
  ),
  "organizações com atividade": help(
    "Organizações que tiveram atividade no período analisado.",
    "Ajuda a diferenciar base cadastrada de base efetivamente ativa.",
    "Compare com o total de organizações para entender cobertura de uso.",
  ),
  "ativas": help(
    "Itens classificados como ativos no contexto da tela.",
    "Em telas operacionais, representa entidades com atividade/uso acima do limiar definido para o período.",
    "Compare com ‘Mornas’ e ‘Inativas’ para entender a distribuição da saúde operacional.",
  ),
  "mornas": help(
    "Itens com atividade intermediária no período (nem ativos, nem inativos).",
    "Representa uma faixa de atenção: há sinais de uso, mas abaixo da zona considerada ativa.",
    "Observe migração entre mornas, ativas e inativas ao longo do tempo.",
  ),
  "inativas": help(
    "Itens classificados como inativos no contexto e período da tela.",
    "Indica ausência ou baixa atividade conforme a regra aplicada nessa visão.",
    "Acompanhe tendência e concentração por organização/grupo para priorizar reativação.",
  ),
  "logins": help(
    "Quantidade de logins registrados no período.",
    "Mostra acesso à plataforma e pode indicar uso administrativo/operacional.",
    "Compare com visualizações de página e admins ativos para avaliar consistência de uso.",
  ),
  "visualizações de página": help(
    "Total de page views registradas no período.",
    "Mede navegação/consumo da aplicação. Crescimento sem logins equivalentes pode refletir uso repetido por poucos usuários.",
    "Leia junto de logins e admins ativos para entender intensidade de uso.",
  ),
  "total": help(
    "Total de registros no contexto atual da tela.",
    "É uma métrica de base/volume. O significado exato depende da tela (grupos, organizações, etc.).",
    "Verifique filtros ativos e compare com subtotais categorizados.",
  ),
  "média de membros": help(
    "Número médio de membros por grupo no recorte exibido.",
    "Ajuda a entender o porte típico dos grupos, sem ser distorcido por um único grupo muito grande.",
    "Observe junto de distribuição de atividade para diferenciar tamanho de engajamento.",
  ),
  "pessoas no período": help(
    "Quantidade de pessoas que aparecem no recorte do período/filtros selecionados.",
    "É uma leitura de volume de pessoas com eventos/atividade dentro da consulta atual.",
    "Compare ao mudar período e filtros para medir amplitude de cobertura.",
  ),
  "eventos no período": help(
    "Total de eventos do sistema no período selecionado.",
    "Mostra o volume de ocorrências registradas na auditoria/telemetria no recorte atual.",
    "Observe picos e relacione com filtros por entidade/tipo para investigar causa.",
  ),
  "total de membros": help(
    "Quantidade total de membros do grupo.",
    "Mostra o tamanho atual da base do grupo, independentemente de atividade recente.",
    "Compare com ativos e média de mensagens por ativo para avaliar engajamento.",
  ),
  "admins": help(
    "Quantidade de administradores no contexto da tela.",
    "Indica o tamanho da camada de gestão/liderança configurada.",
    "Compare com total de membros e com admins ativos para avaliar cobertura de liderança.",
  ),
  "média msgs/ativo (30d)": help(
    "Média de mensagens por membro ativo nos últimos 30 dias.",
    "Mostra intensidade média de participação entre quem realmente falou no período.",
    "Se sobe com queda de ativos, pode indicar concentração da conversa em menos pessoas.",
  ),
  "admins do sistema": help(
    "Quantidade de usuários com papel de Administrador do Sistema.",
    "Mostra quem tem maior nível de permissão global na plataforma.",
    "Revisite periodicamente para manter princípio de menor privilégio.",
  ),
  "gestores de org": help(
    "Quantidade de usuários com papel de gestor de organização.",
    "Representa pessoas que administram organizações e seus recursos vinculados.",
    "Observe crescimento e distribuição junto com total de organizações.",
  ),
  "gestores de grupo": help(
    "Quantidade de usuários com papel de gestor de grupo.",
    "Mostra o tamanho da operação com permissão de gestão no nível de grupo.",
    "Revise se há excesso ou falta de gestores em relação ao volume de grupos.",
  ),
  "dias carregados": help(
    "Quantidade de dias de resumo carregados no painel de sumarização.",
    "Indica o tamanho da amostra atualmente visível após filtros.",
    "Use junto com palavras-chave únicas e contagens de dores/oportunidades para comparar períodos.",
  ),
  "dores": help(
    "Total de itens classificados como dores nos resumos carregados.",
    "Mostra recorrência de problemas, fricções ou reclamações identificadas na leitura resumida.",
    "Observe tendência e temas recorrentes para priorização de ação.",
  ),
  "oportunidades": help(
    "Total de itens classificados como oportunidades nos resumos carregados.",
    "Indica espaço percebido para melhorias, ganhos ou ações sugeridas pelas conversas.",
    "Observe quais oportunidades se repetem ao longo dos dias para priorizar.",
  ),
  "objeções": help(
    "Total de objeções identificadas nos resumos carregados.",
    "Mostra barreiras, dúvidas ou resistências recorrentes nas conversas analisadas.",
    "Compare com dores e oportunidades para entender fricções críticas.",
  ),
  "dia mais movimentado": help(
    "Dia com maior volume de mensagens dentro do período analisado.",
    "Ajuda a identificar pico de atividade recente e contextualizar eventos ou campanhas.",
    "Veja quem participou e quais temas apareceram nesse dia para explicar o pico.",
  ),
  "horário de maior atividade": help(
    "Faixa horária com maior concentração de mensagens no período.",
    "Mostra quando a conversa costuma acontecer com mais intensidade.",
    "Use para ajustar ações, disparos e janelas de acompanhamento.",
  ),
  "máx. opções": help(
    "Número máximo de opções que cada pessoa pode selecionar na enquete.",
    "É uma regra de configuração da enquete e altera como interpretar total de votos e participação.",
    "Compare com ‘Votos (seleções)’ e ‘Votos registrados’ para entender multiplicidade de escolha.",
  ),
};

const patternHelp: Array<{ test: (normalizedTitle: string) => boolean; build: (title: string) => MetricHelpContent }> = [
  {
    test: (t) => /^grupos inativos \(\d+d\)$/.test(t),
    build: (title) =>
      help(
        `Quantidade de grupos vinculados sem atividade dentro da janela indicada em "${title}".`,
        "Mostra grupos que podem exigir revisão operacional, reativação ou ajuste de vínculo.",
        "Observe crescimento contínuo e concentração por atendente/organização.",
      ),
  },
  {
    test: (t) => /^tmr útil \(.+\)$/.test(t),
    build: () =>
      help(
        "Tempo médio de resposta (TMR) calculado em horário comercial no período exibido.",
        "Em geral, valores menores indicam respostas mais rápidas. Interprete junto com volume e amostragem.",
        "Observe picos, tendência e impacto de períodos com maior demanda.",
      ),
  },
  {
    test: (t) => /^sla \d+min \(útil\)$/.test(t),
    build: (title) =>
      help(
        `Percentual de respostas dentro do SLA configurado em "${title}", considerando horário comercial.`,
        "Valores maiores indicam melhor aderência ao tempo-alvo de resposta.",
        "Acompanhe queda recorrente e volume fora do SLA para priorizar ação.",
      ),
  },
  {
    test: (t) => /^msgs atendentes \(.+\)$/.test(t),
    build: () =>
      help(
        "Volume de mensagens enviadas por atendentes no período exibido.",
        "Mostra intensidade operacional do time de atendimento na janela analisada.",
        "Compare com TMR, SLA e pendências para avaliar eficiência vs. volume.",
      ),
  },
  {
    test: (t) => /^inatividade \(\d+d\)$/.test(t),
    build: () =>
      help(
        "Status de atividade recente do grupo na janela de dias exibida.",
        "Indica se o grupo está ativo ou inativo conforme a regra de inatividade configurada.",
        "Observe a data da última mensagem e combine com participação para avaliar risco de esfriamento.",
      ),
  },
  {
    test: (t) => /^t(mr|empo)/.test(t),
    build: () =>
      help(
        "Indicador de tempo médio no recorte atual.",
        "Em métricas de tempo de resposta, valores menores costumam ser melhores.",
        "Observe tendência e picos fora do padrão.",
      ),
  },
];

export function buildMetricHelpFallback(title: string, legacyHelpText?: string): MetricHelpContent {
  const normalizedTitle = normalizeTitle(title);

  const exact = exactHelpByTitle[normalizedTitle];
  if (exact) {
    if (!legacyHelpText?.trim()) return exact;
    return { ...exact, whatIs: legacyHelpText.trim() };
  }

  const pattern = patternHelp.find((entry) => entry.test(normalizedTitle));
  if (pattern) {
    const resolved = pattern.build(title);
    if (!legacyHelpText?.trim()) return resolved;
    return { ...resolved, whatIs: legacyHelpText.trim() };
  }

  const whatIs =
    legacyHelpText?.trim() ||
    `Este KPI mostra a métrica "${title}" no recorte exibido na tela.`;

  let howToInterpret = "Compare com períodos anteriores e com o contexto da operação para entender tendência, estabilidade e desvios.";
  let whatToObserve = "Mudanças bruscas, tendência consistente e relação com outros KPIs da mesma seção.";

  if (normalizedTitle.includes("taxa") || normalizedTitle.includes("%") || normalizedTitle.includes("sla")) {
    howToInterpret = "Valores maiores costumam indicar melhor desempenho, mas sempre valide a meta esperada para este indicador.";
    whatToObserve = "Oscilações por período, distância da meta e quedas recorrentes.";
  } else if (
    normalizedTitle.includes("tempo") ||
    normalizedTitle.includes("tmr") ||
    normalizedTitle.includes("médio") ||
    normalizedTitle.includes("media")
  ) {
    howToInterpret = "Use para avaliar velocidade/tempo médio. Valores menores podem ser melhores, dependendo do KPI.";
    whatToObserve = "Picos fora do padrão e variação entre períodos comparáveis.";
  } else if (
    normalizedTitle.includes("pendente") ||
    normalizedTitle.includes("inativo") ||
    normalizedTitle.includes("erro") ||
    normalizedTitle.includes("alerta")
  ) {
    howToInterpret = "Em geral, valores menores representam menor acúmulo de risco operacional.";
    whatToObserve = "Acúmulo contínuo, crescimento acelerado e relação com volume de atendimento/atividade.";
  } else if (
    normalizedTitle.includes("mensage") ||
    normalizedTitle.includes("voto") ||
    normalizedTitle.includes("grupo") ||
    normalizedTitle.includes("membro") ||
    normalizedTitle.includes("usuár") ||
    normalizedTitle.includes("user") ||
    normalizedTitle.includes("login") ||
    normalizedTitle.includes("visualiza") ||
    normalizedTitle.includes("atividade")
  ) {
    howToInterpret = "Este KPI representa volume/quantidade no período. O valor ideal depende da operação e da base ativa.";
    whatToObserve = "Tendência de crescimento/queda, sazonalidade e compatibilidade com outros indicadores de volume.";
  }

  return {
    whatIs,
    howToInterpret,
    whatToObserve,
  };
}
