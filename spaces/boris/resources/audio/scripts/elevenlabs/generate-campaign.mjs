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
const campaignName = args[0];
const legacyPresetArg = args[1];
const legacyPersonaArg = args[2];
const personaFlagIndex = args.indexOf("--persona");
const presetFlagIndex = args.indexOf("--preset");
const personaArg = personaFlagIndex >= 0 ? args[personaFlagIndex + 1] : legacyPersonaArg || "";
const presetArg = presetFlagIndex >= 0 ? args[presetFlagIndex + 1] : legacyPresetArg || "anuncio";

if (!campaignName) {
  console.error(
    "Usage: npm run eleven:campaign -- nome-da-campanha [preset] [persona] [--persona bruno]"
  );
  process.exit(1);
}

const projectRoot = getProjectRoot();
const campaignsDir = path.join(projectRoot, "campanhas");
const inputPath = path.join(campaignsDir, `${campaignName}.json`);

if (!fs.existsSync(inputPath)) {
  console.error(`Campaign file not found: ${inputPath}`);
  process.exit(1);
}

const voiceSelection = resolveVoiceSelection({ persona: personaArg, preset: presetArg });
const voiceId = voiceSelection.voiceId;
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const finalPreset = voiceSelection.preset;
const voiceSettings = resolvePreset(finalPreset);
const { output_gain_db: outputGainDb = 0, ...apiVoiceSettings } = voiceSettings;
const campaign = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const outputDir = path.join(projectRoot, "output", "campanhas", campaignName);
ensureDir(outputDir);

const scripts = [];
for (const item of campaign.items ?? []) {
  if (!item.text || !item.slug) continue;
  scripts.push(item);
}

if (scripts.length === 0) {
  console.error("Campaign file does not contain valid items.");
  process.exit(1);
}

for (let index = 0; index < scripts.length; index += 1) {
  const item = scripts[index];
  const outputPath = path.join(outputDir, `${String(index + 1).padStart(2, "0")}-${item.slug}.mp3`);

  const response = await elevenlabsFetch(`/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: preparePortugueseText(item.text),
      model_id: modelId,
      voice_settings: apiVoiceSettings
    })
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, audioBuffer);
  applyOutputGain(outputPath, outputGainDb);
  console.log(`${index + 1}/${scripts.length} saved to ${outputPath}`);
}

const manifestPath = path.join(outputDir, "manifest.json");
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      campaign: campaignName,
      preset: finalPreset,
      persona: voiceSelection.persona,
      voice_name: voiceSelection.voiceLabel,
      voice_id: voiceId,
      generated_at: new Date().toISOString(),
      items: scripts.map((item, index) => ({
        order: index + 1,
        slug: item.slug,
        text: preparePortugueseText(item.text),
        file: `${String(index + 1).padStart(2, "0")}-${item.slug}.mp3`
      }))
    },
    null,
    2
  )
);

console.log(`Campaign complete with preset: ${finalPreset}`);
if (voiceSelection.personaConfig) {
  console.log(
    `Persona: ${voiceSelection.personaConfig.character_name} | Voice: ${voiceSelection.voiceLabel}`
  );
}
console.log(`Manifest saved to ${manifestPath}`);
