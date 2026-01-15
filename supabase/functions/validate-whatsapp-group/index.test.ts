import { createValidateWhatsAppGroupHandler, validateWebhookGroupPayload } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

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
  return new Request("http://localhost:8080/functions/v1/validate-whatsapp-group", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-correlation-id": "corr-1" },
    body: JSON.stringify(body),
  });
}

function makeValidGroupPayload() {
  return {
    phone: "5511999990000-group",
    description: "Grupo de testes",
    owner: "5511999990000",
    subject: "Assunto",
    name: "Nome do grupo",
    creation: 1730000000,
    participants: [
      { phone: "5511999990000", lid: "lid-1", isAdmin: false, isSuperAdmin: true },
      { phone: "5511988887777", lid: "lid-2", isAdmin: true, isSuperAdmin: false },
    ],
    invitationLink: "https://chat.whatsapp.com/abc",
    communityId: "comm-1",
    adminOnlyMessage: true,
    subjectTime: 1730000001,
    subjectOwner: "5511999990000",
  };
}

DenoRef.test("validateWebhookGroupPayload aceita payload válido", () => {
  const out = validateWebhookGroupPayload(makeValidGroupPayload());
  assertEquals(out.phone, "5511999990000-group");
  assertEquals(out.owner, "5511999990000");
  assertEquals(out.participants.length, 2);
});

DenoRef.test("validateWebhookGroupPayload exige group.phone terminar com -group", () => {
  const payload = makeValidGroupPayload();
  payload.phone = "5511999990000";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.phone");
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

DenoRef.test("validateWebhookGroupPayload exige ao menos 1 isSuperAdmin=true", () => {
  const payload = makeValidGroupPayload();
  (payload.participants as any)[0].isSuperAdmin = false;
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "deve conter ao menos 1 participante com isSuperAdmin=true");
});

DenoRef.test("validateWebhookGroupPayload exige owner corresponder ao super admin", () => {
  const payload = makeValidGroupPayload();
  payload.owner = "5511000000000";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.owner");
});

DenoRef.test("validateWebhookGroupPayload exige subjectOwner igual a owner quando presente", () => {
  const payload = makeValidGroupPayload();
  payload.subjectOwner = "5511988887777";
  assertThrowsMessage(() => validateWebhookGroupPayload(payload), "group.subjectOwner");
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
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? "http://webhook" : undefined) },
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
  assertEquals(body.whatsapp_provider_id, "5511999990000-group");
  assertEquals(body.group_name, "Nome do grupo");
  assertEquals(body.participants_count, 2);
  assertEquals(Array.isArray(body.participants), true);
  assertEquals(body.participants[0].is_owner, true);
  assertEquals(body.participants[0].is_super_admin, true);
  assertEquals(body.participants[0].is_admin, true);
});

DenoRef.test("handler retorna erro claro quando payload do webhook é inválido", async () => {
  const invalid = makeValidGroupPayload();
  invalid.phone = "5511999990000";

  const handler = createValidateWhatsAppGroupHandler({
    env: { get: (k: string) => (k === "VITE_N8N_CHECK_GROUP_ENTRY_URL" ? "http://webhook" : undefined) },
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
  assertIncludes(String(body.message || ""), "group.phone");
});
