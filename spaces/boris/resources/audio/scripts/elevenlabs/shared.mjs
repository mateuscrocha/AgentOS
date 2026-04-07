import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "../..");
const PERSONA_ALIASES = {
  rafael: "renata",
  diego: "daniela",
  bruno: "bianca"
};

export function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function elevenlabsFetch(pathname, options = {}) {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const response = await fetch(`https://api.elevenlabs.io${pathname}`, {
    ...options,
    headers: {
      "xi-api-key": apiKey,
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API ${response.status}: ${errorText}`);
  }

  return response;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function getProjectRoot() {
  return projectRoot;
}

export function loadPersonaVoices() {
  const configPath = path.join(projectRoot, "config", "persona-voices.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Persona voices config not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export function listAvailablePersonas() {
  const config = loadPersonaVoices();
  return Object.keys(config.personas ?? {});
}

export function resolveVoiceSelection({ persona, preset, fallbackToEnv = true } = {}) {
  const selectedPreset = preset || "padrao";

  if (!persona) {
    return {
      voiceId: fallbackToEnv ? requireEnv("ELEVENLABS_VOICE_ID") : null,
      preset: selectedPreset,
      persona: null,
      voiceLabel: process.env.ELEVENLABS_VOICE_ID || null
    };
  }

  const normalizedPersona = normalizePersonaKey(persona);
  const config = loadPersonaVoices();
  const personaConfig = config.personas?.[normalizedPersona];

  if (!personaConfig) {
    const available = Object.keys(config.personas ?? {}).join(", ");
    throw new Error(`Unknown persona "${persona}". Available personas: ${available}`);
  }

  return {
    voiceId: personaConfig.primary_voice.voice_id,
    preset: preset || personaConfig.recommended_preset || "padrao",
    persona: normalizedPersona,
    personaConfig,
    voiceLabel: personaConfig.primary_voice.name
  };
}

export const VOICE_PRESETS = {
  padrao: {
    stability: 0.58,
    similarity_boost: 0.84,
    style: 0.12,
    use_speaker_boost: true,
    speed: 1.02,
    output_gain_db: 3
  },
  calmo: {
    stability: 0.72,
    similarity_boost: 0.88,
    style: 0.03,
    use_speaker_boost: true,
    speed: 1.02,
    output_gain_db: 3
  },
  energetico: {
    stability: 0.48,
    similarity_boost: 0.8,
    style: 0.2,
    use_speaker_boost: true,
    speed: 1.02,
    output_gain_db: 3
  },
  institucional: {
    stability: 0.76,
    similarity_boost: 0.86,
    style: 0.04,
    use_speaker_boost: true,
    speed: 1.02,
    output_gain_db: 3
  },
  anuncio: {
    stability: 0.5,
    similarity_boost: 0.82,
    style: 0.16,
    use_speaker_boost: true,
    speed: 1.0,
    output_gain_db: 3
  }
};

export function resolvePreset(name = "padrao") {
  const preset = VOICE_PRESETS[name];
  if (!preset) {
    const available = Object.keys(VOICE_PRESETS).join(", ");
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }
  return preset;
}

export function preparePortugueseText(text) {
  // Boris audio rule: keep Brazilian Portuguese punctuation/accent support intact
  // so the TTS has enough prosodic information to sound emotional and natural.
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])\s*(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, "$1 ")
    .replace(/,\s*(?=[a-záàâãéêíóôõúç])/g, ", ")
    .trim();
}

export function applyOutputGain(outputPath, gainDb = 0) {
  if (!gainDb) return;

  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      outputPath,
      "-filter:a",
      `volume=${gainDb}dB`,
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      `${outputPath}.tmp.mp3`
    ],
    { encoding: "utf8" }
  );

  if (ffmpeg.status !== 0) {
    throw new Error(
      `Failed to increase audio volume for ${outputPath}: ${ffmpeg.stderr || ffmpeg.stdout}`
    );
  }

  fs.renameSync(`${outputPath}.tmp.mp3`, outputPath);
}

function normalizePersonaKey(value) {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return PERSONA_ALIASES[normalized] || normalized;
}
