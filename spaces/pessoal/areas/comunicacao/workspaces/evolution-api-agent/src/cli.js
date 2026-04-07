import { EvolutionClient } from "./evolution-client.js";
import { resolveProfileInstance } from "./config.js";
import {
  buildCache,
  getCacheFilePath,
  readCache,
  searchContactsByName,
  searchGroupsByName,
  writeCache
} from "./cache-store.js";

function printHelp() {
  console.log(`
Usage:
  npm start -- health
  npm start -- sync
  npm start -- cache-info
  npm start -- list-instances
  npm start -- instance-status [--instance my-instance]
  npm start -- create-group --subject "Casamento" --description "..." --participants 5511999999999,5511888888888
  npm start -- update-group-participants --group-jid 120363000000000000@g.us --action add --participants 5511999999999
  npm start -- send-text --number 5511999999999 --text "Oi" [--instance my-instance]
  npm start -- send-text-profile --profile pessoal --number 5511999999999 --text "Oi"
  npm start -- send-media --number 5511999999999 --media https://example.com/image.jpg [--caption "Oi"]
  npm start -- send-media-profile --profile boris_suporte --number 5511999999999 --media https://example.com/image.jpg [--caption "Oi"]
  npm start -- find-contact --name "Pedro Oliveira"
  npm start -- find-group --name "Testes"
  npm start -- send-text-contact --name "Pedro Oliveira" --text "Oi"
  npm start -- send-media-contact --name "Pedro Oliveira" --media https://example.com/image.jpg [--caption "Oi"]
  npm start -- request GET /instance/fetchInstances
  npm start -- request POST /message/sendText/my-instance '{"number":"5511999999999","text":"Oi"}'
`);
}

function parseFlags(args) {
  const flags = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getInstanceFromFlags(flags) {
  if (flags.profile) {
    return resolveProfileInstance(flags.profile);
  }

  if (flags.instance) {
    return {
      instance: flags.instance,
      apiKey: undefined
    };
  }

  return {
    instance: undefined,
    apiKey: undefined
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  const client = new EvolutionClient();

  switch (command) {
    case "sync": {
      const contacts = await client.listContacts();
      const warnings = [];
      let groups = [];

      try {
        groups = await client.listGroups(undefined, false, { timeoutMs: 15000 });
      } catch (error) {
        warnings.push(
          `Groups were skipped during sync: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const cache = buildCache({ contacts, groups });
      writeCache(cache);
      console.log(
        JSON.stringify(
          {
            ok: true,
            syncedAt: cache.syncedAt,
            contacts: cache.contacts.length,
            groups: cache.groups.length,
            cacheFile: getCacheFilePath(),
            warnings
          },
          null,
          2
        )
      );
      return;
    }

    case "cache-info": {
      const cache = readCache();
      console.log(
        JSON.stringify(
          {
            syncedAt: cache.syncedAt,
            contacts: cache.contacts.length,
            groups: cache.groups.length,
            cacheFile: getCacheFilePath()
          },
          null,
          2
        )
      );
      return;
    }

    case "health": {
      const instances = await client.listInstances();
      console.log(JSON.stringify({ ok: true, instances }, null, 2));
      return;
    }

    case "list-instances": {
      const result = await client.listInstances();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "instance-status": {
      const flags = parseFlags(rest);
      const result = await client.getInstanceStatus(flags.instance);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "create-group": {
      const flags = parseFlags(rest);
      const participants = parseCsv(flags.participants);
      const result = await client.createGroup({
        instance: flags.instance,
        subject: flags.subject,
        description: flags.description,
        participants
      });
      console.log(
        JSON.stringify(
          {
            ok: true,
            subject: flags.subject,
            description: flags.description,
            participants,
            result
          },
          null,
          2
        )
      );
      return;
    }

    case "update-group-participants": {
      const flags = parseFlags(rest);
      const participants = parseCsv(flags.participants);
      const result = await client.updateGroupParticipants({
        instance: flags.instance,
        groupJid: flags["group-jid"],
        action: flags.action,
        participants
      });
      console.log(
        JSON.stringify(
          {
            ok: true,
            groupJid: flags["group-jid"],
            action: flags.action,
            participants,
            result
          },
          null,
          2
        )
      );
      return;
    }

    case "send-text": {
      const flags = parseFlags(rest);
      const target = getInstanceFromFlags(flags);
      const result = await client.sendText({
        instance: target.instance,
        apiKey: target.apiKey,
        number: flags.number,
        text: flags.text,
        delay: flags.delay ? Number(flags.delay) : 0,
        linkPreview: flags["link-preview"] === "true" || flags["link-preview"] === true
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "send-text-profile": {
      const flags = parseFlags(rest);
      if (!flags.profile) {
        throw new Error("send-text-profile requires --profile.");
      }

      const target = getInstanceFromFlags(flags);
      const result = await client.sendText({
        instance: target.instance,
        apiKey: target.apiKey,
        number: flags.number,
        text: flags.text,
        delay: flags.delay ? Number(flags.delay) : 0,
        linkPreview: flags["link-preview"] === "true" || flags["link-preview"] === true
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "send-media": {
      const flags = parseFlags(rest);
      const target = getInstanceFromFlags(flags);
      const result = await client.sendMedia({
        instance: target.instance,
        apiKey: target.apiKey,
        number: flags.number,
        media: flags.media,
        mediatype: flags.mediatype || "image",
        caption: flags.caption || ""
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "send-media-profile": {
      const flags = parseFlags(rest);
      if (!flags.profile) {
        throw new Error("send-media-profile requires --profile.");
      }

      const target = getInstanceFromFlags(flags);
      const result = await client.sendMedia({
        instance: target.instance,
        apiKey: target.apiKey,
        number: flags.number,
        media: flags.media,
        mediatype: flags.mediatype || "image",
        caption: flags.caption || ""
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case "find-contact": {
      const flags = parseFlags(rest);
      if (!flags.name) {
        throw new Error("find-contact requires --name.");
      }

      const matches = searchContactsByName(readCache(), flags.name);
      console.log(JSON.stringify(matches, null, 2));
      return;
    }

    case "find-group": {
      const flags = parseFlags(rest);
      if (!flags.name) {
        throw new Error("find-group requires --name.");
      }

      const matches = searchGroupsByName(readCache(), flags.name);
      console.log(JSON.stringify(matches, null, 2));
      return;
    }

    case "send-text-contact": {
      const flags = parseFlags(rest);
      if (!flags.name || !flags.text) {
        throw new Error("send-text-contact requires --name and --text.");
      }

      const matches = searchContactsByName(readCache(), flags.name);

      if (matches.length === 0) {
        throw new Error("No cached contact found. Run `npm start -- sync` first or refine the contact name.");
      }

      if (matches.length > 1) {
        throw new Error(`Multiple cached contacts found: ${matches.map((item) => item.pushName).join(", ")}`);
      }

      const target = getInstanceFromFlags(flags);
      const result = await client.sendText({
        instance: target.instance,
        apiKey: target.apiKey,
        number: matches[0].remoteJid,
        text: flags.text
      });
      console.log(JSON.stringify({ contact: matches[0], result }, null, 2));
      return;
    }

    case "send-media-contact": {
      const flags = parseFlags(rest);
      if (!flags.name || !flags.media) {
        throw new Error("send-media-contact requires --name and --media.");
      }

      const matches = searchContactsByName(readCache(), flags.name);

      if (matches.length === 0) {
        throw new Error("No cached contact found. Run `npm start -- sync` first or refine the contact name.");
      }

      if (matches.length > 1) {
        throw new Error(`Multiple cached contacts found: ${matches.map((item) => item.pushName).join(", ")}`);
      }

      const target = getInstanceFromFlags(flags);
      const result = await client.sendMedia({
        instance: target.instance,
        apiKey: target.apiKey,
        number: matches[0].remoteJid,
        media: flags.media,
        mediatype: flags.mediatype || "image",
        caption: flags.caption || ""
      });
      console.log(JSON.stringify({ contact: matches[0], result }, null, 2));
      return;
    }

    case "request": {
      const [method, pathname, bodyRaw] = rest;

      if (!method || !pathname) {
        throw new Error("request requires method and pathname.");
      }

      const body = bodyRaw ? JSON.parse(bodyRaw) : undefined;
      const result = await client.request(method.toUpperCase(), pathname, body);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
