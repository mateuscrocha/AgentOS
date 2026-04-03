import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { OBJECTIVE_TEMPLATES, createObjectiveCampaign } from "./create-campaign.mjs";
import { PACK_TEMPLATES, createContentPack } from "./create-content-pack.mjs";
import { NICHE_TEMPLATES, createNicheCampaign } from "./create-niche-campaign.mjs";
import { VOICE_PRESETS, listAvailablePersonas } from "./shared.mjs";

const rl = readline.createInterface({ input, output });
const PERSONAS = listAvailablePersonas();

try {
  console.log("Boris Audio Studio");
  console.log("1. Texto unico");
  console.log("2. Campanha por objetivo");
  console.log("3. Pack comercial");
  console.log("4. Campanha por nicho");

  const mode = await ask("Escolha uma opcao");

  if (mode === "1") {
    const text = await ask("Texto");
    const fileName = await ask("Nome do arquivo (sem obrigacao)", false);
    const persona = await askWithOptions("Persona", PERSONAS, "bruno");
    const preset = await askWithOptions("Preset", Object.keys(VOICE_PRESETS), "padrao");
    await runNodeScript("text-to-speech.mjs", [text, fileName || "", preset, persona]);
    process.exit(0);
  }

  if (mode === "2") {
    const objective = await askWithOptions("Objetivo", Object.keys(OBJECTIVE_TEMPLATES));
    const campaignName = await ask("Nome da campanha");
    const offer = await ask("Oferta", false, "sua oferta");
    const audience = await ask("Publico", false, "seu cliente ideal");
    const persona = await askWithOptions("Persona", PERSONAS, "bruno");
    const preset = await askWithOptions("Preset", Object.keys(VOICE_PRESETS), "anuncio");
    const outputPath = createObjectiveCampaign({ objective, campaignName, offer, audience });
    console.log(`Campanha criada em ${outputPath}`);
    await runNodeScript("generate-campaign.mjs", [campaignName, preset, persona]);
    process.exit(0);
  }

  if (mode === "3") {
    const packType = await askWithOptions("Tipo de pack", Object.keys(PACK_TEMPLATES));
    const campaignName = await ask("Nome da campanha");
    const offer = await ask("Oferta", false, "sua oferta");
    const audience = await ask("Publico", false, "seu publico");
    const outcome = await ask("Resultado desejado", false, "mais resultado");
    const persona = await askWithOptions("Persona", PERSONAS, "bruno");
    const preset = await askWithOptions("Preset", Object.keys(VOICE_PRESETS), "anuncio");
    const outputPath = createContentPack({ packType, campaignName, offer, audience, outcome });
    console.log(`Pack criado em ${outputPath}`);
    await runNodeScript("generate-campaign.mjs", [campaignName, preset, persona]);
    process.exit(0);
  }

  if (mode === "4") {
    const niche = await askWithOptions("Nicho", Object.keys(NICHE_TEMPLATES));
    const campaignName = await ask("Nome da campanha");
    const offer = await ask("Oferta", false, "sua oferta");
    const persona = await askWithOptions("Persona", PERSONAS, "bruno");
    const preset = await askWithOptions("Preset", Object.keys(VOICE_PRESETS), "institucional");
    const outputPath = createNicheCampaign({ niche, campaignName, offer });
    console.log(`Campanha criada em ${outputPath}`);
    await runNodeScript("generate-campaign.mjs", [campaignName, preset, persona]);
    process.exit(0);
  }

  throw new Error("Opcao invalida.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
} finally {
  rl.close();
}

async function ask(label, required = true, fallback = "") {
  const suffix = fallback ? ` [padrao: ${fallback}]` : "";
  const value = (await rl.question(`${label}${suffix}: `)).trim();
  if (value) return value;
  if (fallback) return fallback;
  if (!required) return "";
  throw new Error(`${label} e obrigatorio.`);
}

async function askWithOptions(label, options, fallback = "") {
  console.log(`${label}: ${options.join(", ")}`);
  return ask(label, true, fallback || options[0]);
}

async function runNodeScript(scriptName, args) {
  await new Promise((resolve, reject) => {
    const scriptPath = fileURLToPath(new URL(`./${scriptName}`, import.meta.url));
    const child = spawn(
      process.execPath,
      [scriptPath, ...args.filter(Boolean)],
      { stdio: "inherit" }
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Falha ao executar ${scriptName}.`));
    });

    child.on("error", reject);
  });
}
