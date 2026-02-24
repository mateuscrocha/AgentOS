export type DemandClusterKey =
  | "bug"
  | "duvida"
  | "reclamacao"
  | "solicitacao"
  | "financeiro"
  | "acesso"
  | "outros";

export type DemandClusterStat = {
  key: DemandClusterKey;
  label: string;
  count: number;
  pct: number;
};

export type DemandClusterTrendStat = DemandClusterStat & {
  previousCount: number;
  deltaCount: number;
};

const CLUSTER_LABELS: Record<DemandClusterKey, string> = {
  bug: "Bug",
  duvida: "Dúvida",
  reclamacao: "Reclamação",
  solicitacao: "Solicitação",
  financeiro: "Financeiro",
  acesso: "Acesso/Login",
  outros: "Outros",
};

const CLUSTER_RULES: Array<{ key: Exclude<DemandClusterKey, "outros">; patterns: RegExp[] }> = [
  {
    key: "bug",
    patterns: [
      /\bbug\b/i,
      /\berro\b/i,
      /\btrav(ou|ando|a)\b/i,
      /\bquebrad[oa]\b/i,
      /\bn[aã]o funciona\b/i,
      /\bfalha\b/i,
    ],
  },
  {
    key: "acesso",
    patterns: [
      /\blogin\b/i,
      /\bsenha\b/i,
      /\bacess(o|ar)\b/i,
      /\bentrar\b/i,
      /\btoken\b/i,
      /\bpermiss[aã]o\b/i,
    ],
  },
  {
    key: "financeiro",
    patterns: [
      /\bfatura\b/i,
      /\bboleto\b/i,
      /\bcobran[cç]a\b/i,
      /\bpagamento\b/i,
      /\bnota fiscal\b/i,
      /\bfinanceir[oa]\b/i,
    ],
  },
  {
    key: "reclamacao",
    patterns: [
      /\breclama[cç][aã]o\b/i,
      /\binsatisfeit[oa]\b/i,
      /\bp[ée]ssim[oa]\b/i,
      /\bruim\b/i,
      /\bfrustrad[oa]\b/i,
      /\bcr[ií]tica\b/i,
    ],
  },
  {
    key: "solicitacao",
    patterns: [
      /\bsolicita[cç][aã]o\b/i,
      /\bmelhori[ae]\b/i,
      /\bseria poss[ií]vel\b/i,
      /\bpoderia(m)?\b/i,
      /\bimplement(ar|a[cç][aã]o)\b/i,
      /\bfeature\b/i,
    ],
  },
  {
    key: "duvida",
    patterns: [
      /\bd[uú]vida\b/i,
      /\bcomo (fa[cç]o|usar|configurar)\b/i,
      /\bcomo\b/i,
      /\bposso\b.*\?/i,
      /\bajuda\b/i,
      /\btem como\b/i,
    ],
  },
];

function normalizeText(input?: string | null) {
  return (input ?? "").toString().trim();
}

export function classifyDemandCluster(text?: string | null): DemandClusterKey {
  const value = normalizeText(text);
  if (!value) return "outros";
  for (const rule of CLUSTER_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(value))) return rule.key;
  }
  return "outros";
}

export function aggregateDemandClusters(texts: Array<string | null | undefined>): DemandClusterStat[] {
  const counts: Record<DemandClusterKey, number> = {
    bug: 0,
    duvida: 0,
    reclamacao: 0,
    solicitacao: 0,
    financeiro: 0,
    acesso: 0,
    outros: 0,
  };

  let total = 0;
  for (const text of texts) {
    const normalized = normalizeText(text);
    if (!normalized) continue;
    const cluster = classifyDemandCluster(normalized);
    counts[cluster] += 1;
    total += 1;
  }

  return (Object.keys(counts) as DemandClusterKey[])
    .map((key) => ({
      key,
      label: CLUSTER_LABELS[key],
      count: counts[key],
      pct: total > 0 ? (counts[key] / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

export function compareDemandClusters(
  currentTexts: Array<string | null | undefined>,
  previousTexts: Array<string | null | undefined>,
): DemandClusterTrendStat[] {
  const current = aggregateDemandClusters(currentTexts);
  const previous = aggregateDemandClusters(previousTexts);
  const previousByKey = new Map(previous.map((row) => [row.key, row]));

  return current.map((row) => {
    const prev = previousByKey.get(row.key);
    const previousCount = prev?.count ?? 0;
    return {
      ...row,
      previousCount,
      deltaCount: row.count - previousCount,
    };
  });
}
