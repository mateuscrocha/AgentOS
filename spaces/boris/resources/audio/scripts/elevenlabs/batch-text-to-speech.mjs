import fs from "node:fs";
import path from "node:path";
import {
  applyOutputGain,
  elevenlabsFetch,
  ensureDir,
  getProjectRoot,
  loadEnvFile,
  preparePortugueseText,
  resolveVoiceSelection,
  resolvePreset
} from "./shared.mjs";

loadEnvFile();

const args = process.argv.slice(2);
const inputPathArg = args[0];
const legacyPresetArg = args[1];
const legacyPersonaArg = args[2];
const personaFlagIndex = args.indexOf("--persona");
const presetFlagIndex = args.indexOf("--preset");
const personaArg = personaFlagIndex >= 0 ? args[personaFlagIndex + 1] : legacyPersonaArg || "";
const presetArg = presetFlagIndex >= 0 ? args[presetFlagIndex + 1] : legacyPresetArg || "padrao";

if (!inputPathArg) {
  console.error(
    "Usage: npm run eleven:batch -- caminho/roteiro.txt [preset] [persona] [--persona marina]"
  );
  process.exit(1);
}

const voiceSelection = resolveVoiceSelection({ persona: personaArg, preset: presetArg });
const voiceId = voiceSelection.voiceId;
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const finalPreset = voiceSelection.preset;
const voiceSettings = resolvePreset(finalPreset);
const { output_gain_db: outputGainDb = 0, ...apiVoiceSettings } = voiceSettings;
const projectRoot = getProjectRoot();
const inputPath = path.isAbsolute(inputPathArg)
  ? inputPathArg
  : path.join(projectRoot, inputPathArg);

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const lines = fs
  .readFileSync(inputPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

if (lines.length === 0) {
  console.error("The input file does not contain valid lines to synthesize.");
  process.exit(1);
}

const batchName = path.basename(inputPath, path.extname(inputPath));
const outputDir = path.join(projectRoot, "output", batchName);
ensureDir(outputDir);

for (let index = 0; index < lines.length; index += 1) {
  const text = preparePortugueseText(lines[index]);
  const fileName = `${String(index + 1).padStart(2, "0")}-${slugify(text).slice(0, 50) || "audio"}.mp3`;
  const outputPath = path.join(outputDir, fileName);

  const response = await elevenlabsFetch(`/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: apiVoiceSettings
    })
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, audioBuffer);
  applyOutputGain(outputPath, outputGainDb);
  console.log(`${index + 1}/${lines.length} saved to ${outputPath}`);
}

console.log(`Batch complete with preset: ${finalPreset}`);
if (voiceSelection.personaConfig) {
  console.log(
    `Persona: ${voiceSelection.personaConfig.character_name} | Voice: ${voiceSelection.voiceLabel}`
  );
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
