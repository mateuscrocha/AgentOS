import { buildMentionMapFromRows, buildMentionProviderCandidates, extractMentionIds } from "./message-mentions";

describe("message mentions", () => {
  it("extracts unique mention ids from multiple texts", () => {
    expect(
      extractMentionIds([
        "Oi @5511999999999 e @5511888888888",
        "Repetido @5511999999999",
        null,
      ]),
    ).toEqual(["5511888888888", "5511999999999"]);
  });

  it("builds provider candidates including lid", () => {
    expect(buildMentionProviderCandidates(["193780418359503"])).toEqual([
      "193780418359503",
      "193780418359503@c.us",
      "193780418359503@s.whatsapp.net",
      "193780418359503@lid",
    ]);
  });

  it("maps mentions from provider id, phone and lid", () => {
    expect(
      buildMentionMapFromRows(
        [{ whatsapp_provider_id: "193780418359503@lid", display_name: "Kenneth Corrêa" }],
        [{ phone_e164: "+56221205827769", name: "Contato Chile" }],
        [{ lid: "5511999999999", name: "Contato LID" }],
      ),
    ).toEqual({
      "193780418359503": "Kenneth Corrêa",
      "56221205827769": "Contato Chile",
      "5511999999999": "Contato LID",
    });
  });
});
