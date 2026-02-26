import { createValidateWhatsAppGroupHandler, validateWebhookGroupPayload } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function getTestBaseUrl() {
  const raw = (
    process.env.TEST_BASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_APP_URL ||
    ""
  ).trim();

  return (raw || "http://127.0.0.1:8080").trim().replace(/\/+$/, "");
}

const testBaseUrl = getTestBaseUrl();
const testWebhookUrl = (process.env.TEST_WEBHOOK_URL || "http://127.0.0.1:9999/webhook").trim();

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

function assertIncludes(haystack: string, needle: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`assertIncludes falhou: esperado conter=${needle} atual=${haystack}`);
  }
}

async function readJson(res: Response) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}

function assertThrowsMessage(fn: () => unknown, expectedSubstring: string) {
  try {
    fn();
    throw new Error(`assertThrowsMessage falhou: esperado erro contendo=${expectedSubstring}`);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    assertIncludes(msg, expectedSubstring);
  }
}

function makeReq(body: any) {
  return new Request(new URL("/functions/v1/validate-whatsapp-group", testBaseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-correlation-id": "corr-1" },
    body: JSON.stringify(body),
  });
}

function makeValidGroupPayload() {
  return {
    phone: "5511999990000-group",
    provider_phone: "5511999990000-group",
    description: "Grupo de testes",
    subject: "Assunto",
    name: "Nome do grupo",
    owner: "5511999990000",
    creation: 1730000000,
    participants: [
      { phone: "5511999990000", lid: "lid-1", isAdmin: false, isSuperAdmin: true },
      { phone: "5511988887777", lid: "lid-2", isAdmin: true, isSuperAdmin: false },
    ],
    invitationLink: "https://chat.whatsapp.com/abc",
    communityId: "comm-1",
    adminOnlyMessage: true,
    subjectTime: 1730000001,
  };
}

DenoRef.test("validateWebhookGroupPayload aceita payload válido", () => {
  const out = validateWebhookGroupPayload(makeValidGroupPayload());
  assertEquals(out.provider_phone, "5511999990000-group");
  assertEquals(out.participants.length, 2);
});

DenoRef.test("validateWebhookGroupPayload exige owner corresponder a um participante", () => {
  const payload: any = makeValidGroupPayload();
  payload.owner = "5511777776666";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.owner");
});

DenoRef.test("validateWebhookGroupPayload exige group.provider_phone terminar com -group", () => {
  const payload = makeValidGroupPayload();
  payload.provider_phone = "5511999990000";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.provider_phone");
});

DenoRef.test("validateWebhookGroupPayload exige participants array não vazio", () => {
  const payload = makeValidGroupPayload();
  payload.participants = [] as any;
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.participants");
});

DenoRef.test("validateWebhookGroupPayload exige booleanos corretos em participantes", () => {
  const payload = makeValidGroupPayload();
  (payload.participants as any)[0].isAdmin = "true";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "participants[0].isAdmin");
});

DenoRef.test("validateWebhookGroupPayload exige timestamps numéricos válidos", () => {
  const payload = makeValidGroupPayload();
  (payload as any).creation = "173";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.creation");

  const payload2 = makeValidGroupPayload();
  (payload2 as any).subjectTime = "173";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload2), "group.subjectTime");
});

DenoRef.test("handler normaliza e retorna participantes no formato esperado", async () => {
  const handler = createValidateWhatsAppGroupHandler({
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? testWebhookUrl : undefined) },
    fetchImpl: async () => {
      return new Response(JSON.stringify([makeValidGroupPayload()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const res = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc" }));
  assertEquals(res.status, 200);
  const body: any = await readJson(res);
  assertEquals(body.success, true);
  assertEquals(body.is_valid, true);
  assertEquals(body.is_boris_in_group, true);
  assertEquals(body.provider_phone, "5511999990000-group");
  assertEquals(body.whatsapp_provider_id, "5511999990000-group");
  assertEquals(body.group_name, "Nome do grupo");
  assertEquals(body.owner_phone_e164, "+5511999990000");
  assertEquals(body.participants_count, 2);
  assertEquals(Array.isArray(body.participants), true);
  assertEquals(body.participants[0].is_super_admin, true);
  assertEquals(body.participants[0].is_admin, true);
  assertEquals(body.participants[0].lid, "lid-1");
  assertEquals(body.participants[1].is_super_admin, false);
  assertEquals(body.participants[1].is_admin, true);
});

DenoRef.test("handler retorna OWNER_MISMATCH quando owner não está em participantes", async () => {
  const invalid = makeValidGroupPayload();
  (invalid as any).owner = "5511777776666";

  const handler = createValidateWhatsAppGroupHandler({
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? testWebhookUrl : undefined) },
    fetchImpl: async () => {
      return new Response(JSON.stringify([invalid]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const res = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc" }));
  assertEquals(res.status, 422);
  const body: any = await readJson(res);
  assertEquals(body.success, false);
  assertEquals(body.code, "OWNER_MISMATCH");
});

DenoRef.test("handler usa cache para repetição do mesmo invite_link", async () => {
  let calls = 0;
  const handler = createValidateWhatsAppGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL") return testWebhookUrl;
        if (k === "VALIDATE_WHATSAPP_GROUP_CACHE_TTL_MS") return "60000";
        return undefined;
      },
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify([makeValidGroupPayload()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const req = makeReq({ invite_link: "https://chat.whatsapp.com/abc" });
  const res1 = await handler(req);
  assertEquals(res1.status, 200);
  const body1: any = await readJson(res1);
  assertEquals(body1.success, true);
  assertEquals(calls, 1);

  const res2 = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc" }));
  assertEquals(res2.status, 200);
  const body2: any = await readJson(res2);
  assertEquals(body2.success, true);
  assertEquals(body2.cached, true);
  assertEquals(calls, 1);
});

DenoRef.test("handler remove querystring do invite_link antes de chamar upstream", async () => {
  let upstreamInviteLink = "";

  const handler = createValidateWhatsAppGroupHandler({
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? testWebhookUrl : undefined) },
    fetchImpl: async (_url: any, init?: any) => {
      const parsed = JSON.parse(String(init?.body ?? "{}"));
      upstreamInviteLink = String(parsed?.invite_link ?? "");
      return new Response(JSON.stringify([makeValidGroupPayload()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const res = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc123?mode=gi_t" }));
  assertEquals(res.status, 200);
  assertEquals(upstreamInviteLink, "https://chat.whatsapp.com/abc123");
});

DenoRef.test("handler respeita timeout do upstream", async () => {
  const handler = createValidateWhatsAppGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL") return testWebhookUrl;
        if (k === "VALIDATE_WHATSAPP_GROUP_UPSTREAM_TIMEOUT_MS") return "50";
        if (k === "VALIDATE_WHATSAPP_GROUP_CACHE_MAX_ENTRIES") return "0";
        return undefined;
      },
    },
    fetchImpl: async (_url: any, init?: any) => {
      return await new Promise<Response>((resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (signal?.aborted) {
          const err = new Error("Aborted") as any;
          err.name = "AbortError";
          reject(err);
          return;
        }

        const onAbort = () => {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          const err = new Error("Aborted") as any;
          err.name = "AbortError";
          reject(err);
        };

        signal?.addEventListener("abort", onAbort, { once: true });

        timeoutId = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve(
            new Response(JSON.stringify([makeValidGroupPayload()]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }, 200);
      });
    },
  });

  const res = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc" }));
  assertEquals(res.status, 504);
  const body: any = await readJson(res);
  assertEquals(body.success, false);
  assertEquals(body.code, "VALIDATION_TIMEOUT");
});

DenoRef.test("handler retorna erro claro quando payload do webhook é inválido", async () => {
  const invalid = makeValidGroupPayload();
  invalid.provider_phone = "5511999990000";

  const handler = createValidateWhatsAppGroupHandler({
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? testWebhookUrl : undefined) },
    fetchImpl: async () => {
      return new Response(JSON.stringify([invalid]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const res = await handler(makeReq({ invite_link: "https://chat.whatsapp.com/abc" }));
  assertEquals(res.status, 502);
  const body: any = await readJson(res);
  assertEquals(body.success, false);
  assertEquals(body.code, "INVALID_WEBHOOK_PAYLOAD");
  assertIncludes(String(body.message || ""), "group.provider_phone");
});
