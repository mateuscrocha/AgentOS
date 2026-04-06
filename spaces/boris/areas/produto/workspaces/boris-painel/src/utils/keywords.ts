export const KEYWORD_BLACKLIST_STORAGE_KEY = "boris_keyword_blacklist_v1";

export const normalizeWord = (word: string): string => {
  const lower = (word || "").toLowerCase();
  const noAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lettersOnly = noAccents.replace(/[^a-z]/g, "");
  return lettersOnly;
};

const STOPWORDS = new Set([
  "tem","mas","aqui","pra","pro","isso","dia",
  "de","da","do","das","dos",
  "a","o","as","os","um","uma","uns","umas",
  "e","em","no","na","nos","nas","num","numa",
  "por","com","sem","para","pra","pro","como",
  "que","se","nao","sim","ja","ta","foi","ser","era","sao","sendo",
  "eu","vc","voce","voces","ele","ela","eles","elas","gente",
  "meu","minha","meus","minhas","seu","sua","seus","suas","nosso","nossa","nossos","nossas",
  "esse","essa","esses","essas","aquele","aquela","aqueles","aquelas","este","esta","estes","estas",
  "isto","isso","aquilo","qual","quais","quem","onde","quando",
  "ai","la","hoje","ontem","amanha",
  "mano","cara","agora","tudo","tipo","alguem","fica","melhor",
  "coisa","coisas","galera","pessoal","acho","acham","achar","mesmo","assim",
  "vai","vao","fazer","faz","feito","teve","tenho","tinha","estar","estou","esta","estao"
]);

const GENERIC_VERB_FORMS = new Set([
  "faz","fica","vai","tem","acha","acham","vao","foi","teve","era","ser","estar","esta","estao","tinha",
]);

const GENERIC_SUFFIXES = [
  "mente",
  "cao",
  "coes",
];

function buildCustomBlacklistSet(customBlacklist?: Iterable<string>): Set<string> {
  if (customBlacklist) {
    return new Set(Array.from(customBlacklist).map((item) => normalizeWord(item)).filter(Boolean));
  }

  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return new Set();
  }

  try {
    const raw = globalThis.localStorage.getItem(KEYWORD_BLACKLIST_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => normalizeWord(String(item))).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function readKeywordBlacklist(): string[] {
  return Array.from(buildCustomBlacklistSet()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function writeKeywordBlacklist(items: string[]) {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return;
  const normalized = Array.from(new Set(items.map((item) => normalizeWord(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  globalThis.localStorage.setItem(KEYWORD_BLACKLIST_STORAGE_KEY, JSON.stringify(normalized));
}

export function addKeywordToBlacklist(word: string): string[] {
  const current = readKeywordBlacklist();
  const normalized = normalizeWord(word);
  if (!normalized || current.includes(normalized)) return current;
  const next = [...current, normalized];
  writeKeywordBlacklist(next);
  return next;
}

export function removeKeywordFromBlacklist(word: string): string[] {
  const normalized = normalizeWord(word);
  const next = readKeywordBlacklist().filter((item) => item !== normalized);
  writeKeywordBlacklist(next);
  return next;
}

const isGenericVerb = (w: string): boolean => {
  if (!w) return false;
  if (GENERIC_VERB_FORMS.has(w)) return true;
  if (w.endsWith("ar") || w.endsWith("er") || w.endsWith("ir")) return true;
  return false;
};

const isLowSignalToken = (w: string, customBlacklist?: Iterable<string>): boolean => {
  const blacklist = buildCustomBlacklistSet(customBlacklist);
  if (!w) return true;
  if (STOPWORDS.has(w)) return true;
  if (blacklist.has(w)) return true;
  if (isGenericVerb(w)) return true;
  if (w.length <= 3) return true;
  if (/^(isso|essa|esse|esta|este|aqui|ali|la)$/.test(w)) return true;
  if (GENERIC_SUFFIXES.some((suffix) => w.endsWith(suffix) && w.length <= suffix.length + 2)) return true;
  return false;
};

export const filterKeywordItems = (
  items: Array<{ word: string; count: number }>,
  options?: { blacklist?: Iterable<string> },
): Array<{ word: string; count: number }> => {
  return (items || [])
    .map((it) => ({ word: normalizeWord(it.word), count: Number(it.count || 0) }))
    .filter((it) => !isLowSignalToken(it.word, options?.blacklist))
    .filter((it) => it.count > 1);
};

export const tokenizeText = (text: string, options?: { blacklist?: Iterable<string> }): string[] => {
  const raw = (text || "").split(/\s+/);
  const tokens: string[] = [];
  for (const r of raw) {
    const w = normalizeWord(r);
    if (isLowSignalToken(w, options?.blacklist)) continue;
    tokens.push(w);
  }
  return tokens;
};

export const countWordsFromRows = (
  rows: string[],
  options?: { blacklist?: Iterable<string> },
): Array<{ word: string; count: number }> => {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const toks = tokenizeText(row, options);
    for (const t of toks) counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).map(([word, count]) => ({ word, count }));
  return filterKeywordItems(entries, options);
};

export const extractBigramsFromRows = (
  rows: string[],
  minCount: number = 2,
  options?: { blacklist?: Iterable<string> },
): Array<{ phrase: string; count: number }> => {
  const bigramCounts: Record<string, number> = {};
  let totalPairs = 0;
  for (const row of rows) {
    const toks = tokenizeText(row, options);
    for (let i = 0; i < toks.length - 1; i++) {
      const p = `${toks[i]} ${toks[i + 1]}`;
      bigramCounts[p] = (bigramCounts[p] || 0) + 1;
      totalPairs++;
    }
  }
  const threshold = totalPairs > 500 ? Math.max(2, minCount) : Math.max(1, minCount);
  return Object.entries(bigramCounts)
    .filter(([, c]) => c > threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase, count]) => ({ phrase, count }));
};
