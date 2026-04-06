import { describe, expect, it } from "vitest";
import { buildSupportKpis, memberIdentityKey, normalizePhoneForIdentity, type MemberRow } from "./GroupSupport";

function mkMember(overrides: Partial<MemberRow>): MemberRow {
  return {
    id: "m1",
    group_id: "g1",
    name: "Pessoa",
    display_name: null,
    phone_e164: null,
    lid: null,
    profile_pic_url: null,
    status: "active",
    left_at: null,
    deleted_at: null,
    last_seen_message_at: null,
    ...overrides,
  };
}

describe("GroupSupport identity helpers", () => {
  it("normaliza telefone para chave estável", () => {
    expect(normalizePhoneForIdentity("+55 (11) 99999-0000")).toBe("+5511999990000");
    expect(normalizePhoneForIdentity("")).toBe("");
    expect(normalizePhoneForIdentity(null)).toBe("");
  });

  it("prioriza phone, depois lid, depois member id", () => {
    expect(memberIdentityKey(mkMember({ id: "a", phone_e164: "+5511999990000", lid: "lid-a" }))).toBe("phone:+5511999990000");
    expect(memberIdentityKey(mkMember({ id: "b", phone_e164: null, lid: "lid-b" }))).toBe("lid:lid-b");
    expect(memberIdentityKey(mkMember({ id: "c", phone_e164: null, lid: null }))).toBe("member:c");
  });
});

describe("GroupSupport KPI builder", () => {
  it("consolida métricas por suporte e calcula resposta aproximada", () => {
    const supportA = mkMember({ id: "a1", phone_e164: "+5511999990000", name: "Ana" });
    const supportA2 = mkMember({ id: "a2", phone_e164: "+5511999990000", name: "Ana duplicada" });
    const supportB = mkMember({ id: "b1", phone_e164: "+5511888880000", name: "Bia" });

    const result = buildSupportKpis(
      10,
      4,
      [
        { member_id: "a1", sender_phone: null, created_at: "2026-02-20T13:30:00.000Z" },
        { member_id: "a2", sender_phone: null, created_at: "2026-02-20T13:20:00.000Z" },
        { member_id: "b1", sender_phone: null, created_at: "2026-02-20T13:40:00.000Z" },
        { member_id: "b1", sender_phone: null, created_at: "2026-02-20T13:50:00.000Z" },
      ],
      [
        { member_id: "u1", sender_phone: "+5511777770000", created_at: "2026-02-20T13:00:00.000Z" },
        { member_id: "a1", sender_phone: null, created_at: "2026-02-20T13:05:00.000Z" },
        { member_id: "u2", sender_phone: "+5511666660000", created_at: "2026-02-20T13:10:00.000Z" },
        { member_id: "a2", sender_phone: null, created_at: "2026-02-20T13:15:00.000Z" },
        { member_id: "u3", sender_phone: "+5511555550000", created_at: "2026-02-20T13:25:00.000Z" },
        { member_id: "b1", sender_phone: null, created_at: "2026-02-20T13:35:00.000Z" },
      ],
      [
        { member_id: "u1", sender_phone: "+5511777770000", text: "Está dando erro no sistema", content: null },
        { member_id: "u2", sender_phone: "+5511666660000", text: "Como faço para configurar?", content: null },
        { member_id: "b1", sender_phone: null, text: "Respondido", content: null },
      ],
      [
        { member_id: "u4", sender_phone: "+5511444440000", text: "erro ao abrir", content: null },
      ],
      [supportA, supportA2, supportB],
    );

    expect(result.supportMessages30d).toBe(4);
    expect(result.totalMessages30d).toBe(10);
    expect(result.supportParticipationPct).toBe(40);
    expect(result.answeredInteractions).toBe(3);
    expect(result.answeredWithinSla).toBe(3);
    expect(result.slaPct).toBe(100);
    expect(result.demandClusters.find((c) => c.key === "bug")?.count).toBe(1);
    expect(result.demandClusters.find((c) => c.key === "bug")?.deltaCount).toBe(0);
    expect(result.demandClusters.find((c) => c.key === "duvida")?.count).toBe(1);
    expect(result.avgResponseMs).toBe(400000);

    const ana = result.perSupport["phone:+5511999990000"];
    const bia = result.perSupport["phone:+5511888880000"];

    expect(ana).toBeDefined();
    expect(ana.messageCount).toBe(2);
    expect(ana.answeredInteractions).toBe(2);
    expect(ana.answeredWithinSla).toBe(2);
    expect(ana.slaPct).toBe(100);
    expect(ana.avgResponseMs).toBe(5 * 60 * 1000);
    expect(ana.participationShare).toBe(0.2);

    expect(bia).toBeDefined();
    expect(bia.messageCount).toBe(2);
    expect(bia.answeredInteractions).toBe(1);
    expect(bia.answeredWithinSla).toBe(1);
    expect(bia.slaPct).toBe(100);
    expect(bia.avgResponseMs).toBe(10 * 60 * 1000);
    expect(bia.participationShare).toBe(0.2);
  });
});
