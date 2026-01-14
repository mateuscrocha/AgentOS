import { normalizeParticipants } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

DenoRef.test('normalizeParticipants marca dono como admin e owner', () => {
  const out = normalizeParticipants([
    { phone: '5511999990000', isAdmin: false, isSuperAdmin: true, lid: 'lid-1' },
  ]);

  assertEquals(out.length, 1);
  assertEquals(out[0].phone, '5511999990000');
  assertEquals(out[0].is_admin, true);
  assertEquals(out[0].is_super_admin, true);
  assertEquals(out[0].is_owner, true);
  assertEquals(out[0].whatsapp_provider_id, 'lid-1');
});

DenoRef.test('normalizeParticipants lida com lista inválida', () => {
  const out = normalizeParticipants(null as any);
  assertEquals(Array.isArray(out), true);
  assertEquals(out.length, 0);
});

