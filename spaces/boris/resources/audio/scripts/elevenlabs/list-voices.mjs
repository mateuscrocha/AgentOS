import { elevenlabsFetch, loadEnvFile } from "./shared.mjs";

loadEnvFile();

const response = await elevenlabsFetch("/v1/voices");
const data = await response.json();

for (const voice of data.voices ?? []) {
  const labels = voice.labels
    ? Object.entries(voice.labels)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    : "";

  console.log(`${voice.name} | ${voice.voice_id}${labels ? ` | ${labels}` : ""}`);
}
