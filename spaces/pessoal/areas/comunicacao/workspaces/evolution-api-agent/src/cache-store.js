import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_FILE = path.join(DATA_DIR, "evolution-cache.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function readCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    return {
      syncedAt: null,
      contacts: [],
      groups: []
    };
  }

  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
}

export function writeCache(payload) {
  ensureDataDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
}

export function buildCache({ contacts = [], groups = [] }) {
  const normalizedContacts = contacts
    .filter((item) => !item.isGroup)
    .map((item) => ({
      id: item.id,
      remoteJid: item.remoteJid,
      pushName: item.pushName ?? "",
      normalizedName: normalizeName(item.pushName),
      profilePicUrl: item.profilePicUrl ?? null,
      type: item.type ?? "contact",
      updatedAt: item.updatedAt ?? null
    }));

  const normalizedGroups = groups.map((item) => ({
    id: item.id,
    subject: item.subject ?? "",
    normalizedSubject: normalizeName(item.subject),
    size: item.size ?? 0,
    participants: item.participants ?? [],
    announce: Boolean(item.announce),
    isCommunity: Boolean(item.isCommunity),
    isCommunityAnnounce: Boolean(item.isCommunityAnnounce)
  }));

  return {
    syncedAt: new Date().toISOString(),
    contacts: normalizedContacts,
    groups: normalizedGroups
  };
}

export function searchContactsByName(cache, query) {
  const normalizedQuery = normalizeName(query);

  return cache.contacts.filter((contact) => {
    return contact.normalizedName.includes(normalizedQuery);
  });
}

export function searchGroupsByName(cache, query) {
  const normalizedQuery = normalizeName(query);

  return cache.groups.filter((group) => {
    return group.normalizedSubject.includes(normalizedQuery);
  });
}

export function getCacheFilePath() {
  return CACHE_FILE;
}
