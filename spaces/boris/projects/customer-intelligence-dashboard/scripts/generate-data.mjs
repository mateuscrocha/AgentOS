import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "../../../..");

const accountsDir = path.join(repoRoot, "spaces/boris/resources/comercial/contas");
const meetingsDir = path.join(repoRoot, "spaces/boris/resources/reunioes");
const synthesesDir = path.join(repoRoot, "spaces/boris/resources/inteligencia-cliente/sinteses");
const outputFile = path.join(projectRoot, "src/lib/generated-intelligence-data.js");

function readMarkdown(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function stripTicks(value) {
  return value.replace(/`/g, "").trim();
}

function normalizeKey(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() ?? "Sem título";
  const sections = new Map();
  let currentSection = "__intro__";
  sections.set(currentSection, []);

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line.replace(/^##\s+/, "").trim();
      sections.set(currentSection, []);
      continue;
    }
    sections.get(currentSection)?.push(line);
  }

  return { title, sections };
}

function getSectionText(sections, ...names) {
  for (const name of names) {
    const lines = sections.get(name);
    if (!lines) continue;
    const text = lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("- "))
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "";
}

function getSectionBullets(sections, ...names) {
  for (const name of names) {
    const lines = sections.get(name);
    if (!lines) continue;

    const bullets = lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => stripTicks(line.replace(/^- /, "")))
      .filter(Boolean);

    if (bullets.length) return bullets;
  }
  return [];
}

function joinReadable(items) {
  return items.map((item) => stripTicks(item)).filter(Boolean).join("\n");
}

function getSectionList(sections, ...names) {
  for (const name of names) {
    const lines = sections.get(name);
    if (!lines) continue;

    const items = lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- ") || /^\d+\.\s+/.test(line))
      .map((line) => stripTicks(line.replace(/^- /, "").replace(/^\d+\.\s+/, "")))
      .filter(Boolean);

    if (items.length) return items;
  }
  return [];
}

function getValueAfterPrefix(sections, sectionName, prefix) {
  const lines = sections.get(sectionName) ?? [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("- ")) continue;
    const value = line.replace(/^- /, "");
    if (value.toLowerCase().startsWith(prefix.toLowerCase())) {
      return stripTicks(value.slice(prefix.length).trim());
    }
  }
  return "";
}

function inferTrack(trackText) {
  const normalized = trackText.toLowerCase();
  if (normalized.includes("parceria")) return "Parceria";
  if (normalized.includes("institucional")) return "Institucional";
  if (normalized.includes("vertical")) return "Vertical";
  return "Comercial";
}

function inferStage(stageText) {
  const normalized = stageText.toLowerCase();
  if (normalized.includes("pilot")) return "Piloto";
  if (normalized.includes("map")) return "Mapeamento";
  return "Meeting";
}

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "2026-01-01";
}

function parseContact(sections) {
  const contact = getValueAfterPrefix(sections, "Contexto da Conta", "contato principal mapeado:");
  if (contact) return contact;

  const contacts = getValueAfterPrefix(sections, "Contexto da Conta", "contatos identificados:");
  if (contacts) return contacts;

  return "A confirmar";
}

function parseAccount(sections, fallbackTitle) {
  const company = getValueAfterPrefix(sections, "Contexto da Conta", "empresa:");
  if (company) return company;
  const provisional = getValueAfterPrefix(sections, "Contexto da Conta", "conta provisória:");
  if (provisional) return provisional;
  return fallbackTitle;
}

function parseStakeholders(sections, fallbackContact) {
  const stakeholders = getSectionBullets(sections, "Stakeholders Citados");
  if (stakeholders.length) return stakeholders;
  return fallbackContact.split(/\s+e\s+|,\s*/).map((item) => item.trim()).filter(Boolean);
}

function parsePathReferences(markdown, segment) {
  const pattern = new RegExp(`/Users/[^\\s\`]+/${segment}/[^\\s\`]+\\.md`, "g");
  return Array.from(new Set(markdown.match(pattern) ?? []));
}

function toRelativeSource(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function parseMeeting(filePath) {
  const markdown = readMarkdown(filePath);
  const { title, sections } = parseSections(markdown);
  const date = parseDateFromFilename(path.basename(filePath));
  const account =
    getValueAfterPrefix(sections, "Identificação", "conta:") ||
    title.replace(/^Reunião\s+—\s+/i, "").split("/")[0].trim();

  return {
    id: path.basename(filePath, ".md"),
    date,
    account,
    accountKey: normalizeKey(account),
    title,
    type: getValueAfterPrefix(sections, "Identificação", "tipo:") || "reunião",
    status: getValueAfterPrefix(sections, "Identificação", "status:") || "registrada",
    participants: getValueAfterPrefix(sections, "Identificação", "participantes:")
      .split(/,\s*|\s+e\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
    context: getSectionText(sections, "Contexto", "Observação Importante Sobre a Fonte"),
    facts: getSectionList(sections, "Fatos Observados"),
    painsAndOpportunities: getSectionList(sections, "Dores e Oportunidades Percebidas"),
    interestSignals: getSectionList(sections, "Sinais de Interesse"),
    objections: getSectionList(sections, "Objeções e Cuidados"),
    nextSteps: getSectionList(sections, "Próximos Passos Recomendados"),
    confidence: getSectionList(sections, "Nota de Confiança"),
    source: toRelativeSource(filePath)
  };
}

function parseSynthesis(filePath) {
  const markdown = readMarkdown(filePath);
  const { title, sections } = parseSections(markdown);
  const date = parseDateFromFilename(path.basename(filePath));
  const account = title.split("—")[0].trim();

  return {
    id: path.basename(filePath, ".md"),
    date,
    account,
    accountKey: normalizeKey(account),
    title,
    summary: getSectionText(sections, "Resumo Executivo"),
    facts: getSectionList(sections, "Fatos Observados"),
    hypotheses: getSectionList(sections, "Inferências e Hipóteses"),
    pains: getSectionList(sections, "Dores", "Dores, Desejos e Objeções"),
    desires: getSectionList(sections, "Desejos"),
    objections: getSectionList(sections, "Objeções", "Dores, Desejos e Objeções"),
    opportunities: getSectionList(sections, "Oportunidades"),
    risks: getSectionList(sections, "Riscos"),
    nextSteps: getSectionList(sections, "Próximos Passos"),
    confidence: getSectionList(sections, "Grau de Confiança"),
    source: toRelativeSource(filePath)
  };
}

function parseRecord(filePath) {
  const markdown = readMarkdown(filePath);
  const { title, sections } = parseSections(markdown);
  const date = parseDateFromFilename(path.basename(filePath));
  const account = parseAccount(sections, title);
  const contact = parseContact(sections);
  const stage = inferStage(getSectionBullets(sections, "Estágio Recomendado")[0] ?? "");
  const track = inferTrack(
    getValueAfterPrefix(sections, "Hipótese Comercial", "trilho principal:") ||
      getValueAfterPrefix(sections, "Hipotese Comercial", "trilho principal:") ||
      getValueAfterPrefix(sections, "Hipótese Comercial", "trilho secundário:")
  );

  const summary =
    getSectionText(sections, "Leitura Atual", "Resumo Executivo", "Leitura Estratégica", "Leitura Comercial") ||
    title;

  const pains = getSectionBullets(sections, "Dores Percebidas", "Dor Principal", "Dor Percebida");
  const objections = getSectionBullets(sections, "Objeções e Cuidados", "Objecoes e Cuidados", "Riscos e Cuidados");
  const proposedSolutions = getSectionBullets(
    sections,
    "O Que Gerou Aderência",
    "O Que Gerou Aderencia",
    "Hipótese de Piloto Mais Forte",
    "Hipotese de Piloto Mais Forte",
    "Próximos Passos",
    "Proximo Passo Recomendado"
  );
  const opportunities = getSectionBullets(
    sections,
    "Oportunidades",
    "Sinais de Fit",
    "Potencial Estratégico",
    "Potencial Estrategico",
    "O Que Gerou Aderência",
    "O Que Gerou Aderencia"
  );
  const nextStepBullets = getSectionBullets(sections, "Próximo Passo Recomendado", "Proximo Passo Recomendado", "Próximos Passos");
  const nextStep = joinReadable(nextStepBullets) || "A definir";
  const lastMovement =
    getSectionText(sections, "Última Movimentação", "Ultima Movimentacao") ||
    joinReadable(getSectionBullets(sections, "Última Movimentação", "Ultima Movimentacao"));
  const stakeholders = parseStakeholders(sections, contact);
  const relatedMeetingPaths = parsePathReferences(markdown, "spaces/boris/resources/reunioes");
  const relatedSynthesisPaths = parsePathReferences(markdown, "spaces/boris/resources/inteligencia-cliente/sinteses");

  return {
    id: path.basename(filePath, ".md").replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase(),
    date,
    account,
    accountKey: normalizeKey(account),
    contact,
    track,
    stage,
    summary,
    pains,
    objections,
    proposedSolutions,
    opportunities,
    nextStep,
    lastMovement,
    stakeholders,
    source: toRelativeSource(filePath),
    relatedMeetingSources: relatedMeetingPaths.map((item) => toRelativeSource(item)),
    relatedSynthesisSources: relatedSynthesisPaths.map((item) => toRelativeSource(item))
  };
}

function main() {
  const accountFiles = fs
    .readdirSync(accountsDir)
    .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
    .map((entry) => path.join(accountsDir, entry));

  const meetingFiles = fs
    .readdirSync(meetingsDir)
    .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
    .map((entry) => path.join(meetingsDir, entry));

  const synthesisFiles = fs
    .readdirSync(synthesesDir)
    .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
    .map((entry) => path.join(synthesesDir, entry));

  const meetings = meetingFiles.map(parseMeeting);
  const syntheses = synthesisFiles.map(parseSynthesis);

  const records = accountFiles
    .map(parseRecord)
    .filter((record) => record.pains.length || record.objections.length || record.proposedSolutions.length)
    .map((record) => {
      const explicitMeetings = meetings.filter((meeting) => record.relatedMeetingSources.includes(meeting.source));
      const matchedMeetings =
        explicitMeetings.length > 0 ? explicitMeetings : meetings.filter((meeting) => meeting.accountKey === record.accountKey);

      const explicitSyntheses = syntheses.filter((synthesis) => record.relatedSynthesisSources.includes(synthesis.source));
      const matchedSyntheses =
        explicitSyntheses.length > 0 ? explicitSyntheses : syntheses.filter((synthesis) => synthesis.accountKey === record.accountKey);

      const latestMeeting = matchedMeetings[0] ?? null;
      const latestSynthesis = matchedSyntheses[0] ?? null;
      const fallbackMovement = record.lastMovement
        ? record.lastMovement
        : latestMeeting
          ? `Reunião registrada em ${latestMeeting.date} com ${latestMeeting.participants.join(", ") || record.contact}.`
          : latestSynthesis
            ? `Síntese estratégica consolidada em ${latestSynthesis.date}.`
            : `Conta atualizada em ${record.date}.`;

      return {
        ...record,
        lastMovement: fallbackMovement,
        meetings: matchedMeetings.sort((a, b) => b.date.localeCompare(a.date)),
        syntheses: matchedSyntheses.sort((a, b) => b.date.localeCompare(a.date))
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const output = `export const intelligenceRecords = ${JSON.stringify(records, null, 2)};\n`;
  fs.writeFileSync(outputFile, output, "utf8");
  console.log(`Generated ${records.length} intelligence records.`);
}

main();
