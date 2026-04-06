import { describe, expect, it } from "vitest";
import { countActiveInboundPeople, rankParticipantsByMessages } from "./group-dashboard-aggregations";

describe("countActiveInboundPeople", () => {
  it("conta pessoas únicas por member_id ou sender_phone e soma bucket desconhecido", () => {
    const total = countActiveInboundPeople([
      { member_id: "m1", sender_phone: "111" },
      { member_id: "m1", sender_phone: "111" },
      { member_id: null, sender_phone: "222" },
      { member_id: null, sender_phone: "222" },
      { member_id: null, sender_phone: null },
      { member_id: null, sender_phone: null },
    ]);

    expect(total).toBe(3);
  });

  it("retorna zero com lista vazia/ausente", () => {
    expect(countActiveInboundPeople([])).toBe(0);
    expect(countActiveInboundPeople(null)).toBe(0);
    expect(countActiveInboundPeople(undefined)).toBe(0);
  });
});

describe("rankParticipantsByMessages", () => {
  it("agrega, ordena por contagem e preserva avatar quando aparece depois", () => {
    const ranked = rankParticipantsByMessages([
      { member_id: "b", members: { name: "Bia", profile_pic_url: null } },
      { member_id: "a", members: { name: "Ana", profile_pic_url: null } },
      { member_id: "a", members: { name: "Ana", profile_pic_url: "https://img/a.png" } },
      { member_id: "b", members: { name: "Bia", profile_pic_url: null } },
      { member_id: "b", members: { name: "Bia", profile_pic_url: "https://img/b.png" } },
      { member_id: null, members: { name: "Ignorar", profile_pic_url: null } },
    ]);

    expect(ranked).toEqual([
      { id: "b", name: "Bia", count: 3, avatarUrl: "https://img/b.png" },
      { id: "a", name: "Ana", count: 2, avatarUrl: "https://img/a.png" },
    ]);
  });

  it("usa nome padrão quando members.name não existe", () => {
    const ranked = rankParticipantsByMessages([{ member_id: "x", members: null }]);
    expect(ranked[0]).toMatchObject({ id: "x", name: "Desconhecido", count: 1, avatarUrl: null });
  });
});
