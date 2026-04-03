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
const rawText = args[0];
const outputArg = args[1];
const legacyPresetArg = args[2];
const legacyPersonaArg = args[3];
const personaFlagIndex = args.indexOf("--persona");
const presetFlagIndex = args.indexOf("--preset");
const personaArg = personaFlagIndex >= 0 ? args[personaFlagIndex + 1] : legacyPersonaArg || "";
const presetArg = presetFlagIndex >= 0 ? args[presetFlagIndex + 1] : legacyPresetArg || "padrao";

if (!rawText) {
  console.error(
    "Usage: npm run eleven:tts -- \"Seu texto aqui\" [arquivo-saida.mp3] [preset] [--persona marina]"
  );
  process.exit(1);
}
const text = preparePortugueseText(rawText);

const voiceSelection = resolveVoiceSelection({ persona: personaArg, preset: presetArg });
const voiceId = voiceSelection.voiceId;
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const finalPreset = voiceSelection.preset;
const voiceSettings = resolvePreset(finalPreset);
const { output_gain_db: outputGainDb = 0, ...apiVoiceSettings } = voiceSettings;
const outputDir = path.join(getProjectRoot(), "output");
ensureDir(outputDir);

const safeName =
  outputArg ||
  `boris-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19)}.mp3`;
const outputPath = path.isAbsolute(safeName) ? safeName : path.join(outputDir, safeName);

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

console.log(`Audio saved to ${outputPath}`);
console.log(`Preset used: ${finalPreset}`);
if (voiceSelection.personaConfig) {
  console.log(
    `Persona: ${voiceSelection.personaConfig.character_name} | Voice: ${voiceSelection.voiceLabel}`
  );
}
