import { getConfig } from "./config.js";

function normalizePath(pathname) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function withInstance(template, instance) {
  return template.replaceAll("{instance}", instance);
}

export class EvolutionClient {
  constructor(config = getConfig()) {
    this.config = config;
  }

  async request(method, pathname, body, options = {}) {
    const url = `${this.config.baseUrl}${normalizePath(pathname)}`;
    const controller = options.timeoutMs ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => {
          controller.abort(new Error(`Request timeout after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;

    let response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: options.apiKey || this.config.apiKey
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Evolution API request timeout for ${method} ${normalizePath(pathname)}`);
      }

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const text = await response.text();
    let data = text;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Keep raw text when the API does not return JSON.
    }

    if (!response.ok) {
      const details = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(`Evolution API error ${response.status}: ${details}`);
    }

    return data;
  }

  async listInstances() {
    return this.request("GET", this.config.listInstancesPath);
  }

  async listContacts(instance = this.config.instance) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    return this.request("POST", `/chat/findContacts/${instance}`, {
      where: {}
    });
  }

  async getInstanceStatus(instance = this.config.instance) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    return this.request("GET", withInstance(this.config.instanceStatusPath, instance));
  }

  async sendText({ number, text, instance = this.config.instance, delay = 0, linkPreview = false, apiKey }) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    if (!number || !text) {
      throw new Error("send-text requires both number and text.");
    }

    return this.request(
      "POST",
      withInstance(this.config.sendTextPath, instance),
      {
        number,
        text,
        delay,
        linkPreview
      },
      { apiKey }
    );
  }

  async listGroups(instance = this.config.instance, getParticipants = true, options = {}) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    return this.request(
      "GET",
      `/group/fetchAllGroups/${instance}?getParticipants=${getParticipants ? "true" : "false"}`,
      undefined,
      options
    );
  }

  async createGroup({ subject, description, participants, instance = this.config.instance }) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    if (!subject) {
      throw new Error("create-group requires subject.");
    }

    if (!description) {
      throw new Error("create-group requires description.");
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      throw new Error("create-group requires at least one participant.");
    }

    return this.request("POST", `/group/create/${instance}`, {
      subject,
      description,
      participants
    });
  }

  async updateGroupParticipants({ groupJid, action, participants, instance = this.config.instance }) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    if (!groupJid) {
      throw new Error("update-group-participants requires groupJid.");
    }

    if (!["add", "remove", "promote", "demote"].includes(action)) {
      throw new Error("update-group-participants requires action to be add, remove, promote or demote.");
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      throw new Error("update-group-participants requires at least one participant.");
    }

    return this.request("POST", `/group/updateParticipant/${instance}?groupJid=${encodeURIComponent(groupJid)}`, {
      action,
      participants
    });
  }

  async sendMedia({ number, media, mediatype = "image", caption = "", instance = this.config.instance, apiKey }) {
    if (!instance) {
      throw new Error("Missing instance. Pass --instance or set EVOLUTION_INSTANCE.");
    }

    if (!number || !media) {
      throw new Error("send-media requires both number and media.");
    }

    return this.request(
      "POST",
      `/message/sendMedia/${instance}`,
      {
        number,
        media,
        mediatype,
        caption
      },
      { apiKey }
    );
  }
}
