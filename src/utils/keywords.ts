export const normalizeWord = (word: string): string => {
  const lower = (word || "").toLowerCase();
  const noAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lettersOnly = noAccents.replace(/[^a-z]/g, "");
  return lettersOnly;
};

const STOPWORDS = new Set([
  "tem","mas","aqui","pra","pro","isso","dia",
  "de","da","do","das","dos",
  "a","o","as","os",
  "e","em","no","na","nos","nas",
  "por","com","sem","para",
  "que","se","nao","sim","ja","ta",
  "eu","vc","voce","voces","ele","ela","eles","elas","gente",
  "ai","la","hoje","ontem","amanha",
  "mano","cara","agora","tudo","tipo","alguem","fica","melhor",
  "coisa","coisas","galera","pessoal","acho","acham","achar","mesmo","assim",
  "vai","vao","fazer","faz","feito"
]);

const GENERIC_VERB_FORMS = new Set(["faz","fica","vai","tem","acha","acham","vao"]);

const isGenericVerb = (w: string): boolean => {
  if (!w) return false;
  if (GENERIC_VERB_FORMS.has(w)) return true;
  if (w.endsWith("ar") || w.endsWith("er") || w.endsWith("ir")) return true;
  return false;
};

export const filterKeywordItems = (
  items: Array<{ word: string; count: number }>,
): Array<{ word: string; count: number }> => {
  return (items || [])
    .map((it) => ({ word: normalizeWord(it.word), count: Number(it.count || 0) }))
    .filter((it) => it.word.length >= 3)
    .filter((it) => !STOPWORDS.has(it.word))
    .filter((it) => !isGenericVerb(it.word))
    .filter((it) => it.count > 1);
};

export const tokenizeText = (text: string): string[] => {
  const raw = (text || "").split(/\s+/);
  const tokens: string[] = [];
  for (const r of raw) {
    const w = normalizeWord(r);
    if (!w || w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    if (isGenericVerb(w)) continue;
    tokens.push(w);
  }
  return tokens;
};

export const countWordsFromRows = (rows: string[]): Array<{ word: string; count: number }> => {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const toks = tokenizeText(row);
    for (const t of toks) counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).map(([word, count]) => ({ word, count }));
  return filterKeywordItems(entries);
};

export const extractBigramsFromRows = (
  rows: string[],
  minCount: number = 2,
): Array<{ phrase: string; count: number }> => {
  const bigramCounts: Record<string, number> = {};
  let totalPairs = 0;
  for (const row of rows) {
    const toks = tokenizeText(row);
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
