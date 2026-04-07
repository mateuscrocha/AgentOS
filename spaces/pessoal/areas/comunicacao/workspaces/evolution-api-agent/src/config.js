import fs from "node:fs";
import path from "node:path";

const DEFAULTS = {
  EVOLUTION_LIST_INSTANCES_PATH: "/instance/fetchInstances",
  EVOLUTION_INSTANCE_STATUS_PATH: "/instance/connectionState/{instance}",
  EVOLUTION_SEND_TEXT_PATH: "/message/sendText/{instance}"
};

const PROFILE_ENV_KEYS = {
  pessoal: {
    instance: "EVOLUTION_PROFILE_PESSOAL_INSTANCE",
    apiKey: "EVOLUTION_PROFILE_PESSOAL_API_KEY"
  },
  boris_suporte: {
    instance: "EVOLUTION_PROFILE_BORIS_SUPORTE_INSTANCE",
    apiKey: "EVOLUTION_PROFILE_BORIS_SUPORTE_API_KEY"
  }
};

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getConfig() {
  const baseUrl = required("EVOLUTION_API_URL").replace(/\/+$/, "");
  const apiKey = required("EVOLUTION_API_KEY");
  const instance = process.env.EVOLUTION_INSTANCE ?? "";

  return {
    baseUrl,
    apiKey,
    instance,
    profileInstances: {
      pessoal: process.env[PROFILE_ENV_KEYS.pessoal.instance] ?? "",
      boris_suporte: process.env[PROFILE_ENV_KEYS.boris_suporte.instance] ?? ""
    },
    profileApiKeys: {
      pessoal: process.env[PROFILE_ENV_KEYS.pessoal.apiKey] ?? apiKey,
      boris_suporte: process.env[PROFILE_ENV_KEYS.boris_suporte.apiKey] ?? apiKey
    },
    listInstancesPath: process.env.EVOLUTION_LIST_INSTANCES_PATH ?? DEFAULTS.EVOLUTION_LIST_INSTANCES_PATH,
    instanceStatusPath: process.env.EVOLUTION_INSTANCE_STATUS_PATH ?? DEFAULTS.EVOLUTION_INSTANCE_STATUS_PATH,
    sendTextPath: process.env.EVOLUTION_SEND_TEXT_PATH ?? DEFAULTS.EVOLUTION_SEND_TEXT_PATH
  };
}

function normalizeProfile(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveProfileInstance(profile, config = getConfig()) {
  const normalizedProfile = normalizeProfile(profile);

  const aliases = {
    pessoal: "pessoal",
    mateus: "pessoal",
    mateus_pessoal: "pessoal",
    boris: "boris_suporte",
    boris_suporte: "boris_suporte",
    suporte: "boris_suporte"
  };

  const profileKey = aliases[normalizedProfile];

  if (!profileKey) {
    throw new Error(
      `Unknown profile: ${profile}. Use one of: pessoal, mateus, mateus_pessoal, boris, boris_suporte, suporte.`
    );
  }

  const instance = config.profileInstances[profileKey];

  if (!instance) {
    throw new Error(
      `Profile '${profile}' is not configured. Set ${PROFILE_ENV_KEYS[profileKey].instance} in .env.`
    );
  }

  return {
    profileKey,
    instance,
    apiKey: config.profileApiKeys[profileKey] || config.apiKey
  };
}
