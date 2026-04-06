import { describe, expect, it } from "vitest";

import { getGroupPollsErrorCopy } from "./polls-error-messages";
import { MalformedResponseError, TimeoutError, withAbortTimeout } from "./polls-request-utils";

describe("getGroupPollsErrorCopy", () => {
  it("mapeia falha de conexão", () => {
    const copy = getGroupPollsErrorCopy(new Error("Failed to fetch"));
    expect(copy.title).toContain("Falha");
  });

  it("mapeia resposta malformada", () => {
    const copy = getGroupPollsErrorCopy(new MalformedResponseError());
    expect(copy.title).toContain("Resposta");
  });

  it("mapeia schema mismatch", () => {
    const copy = getGroupPollsErrorCopy({ code: "42703", message: "column polls.max_votes_per_member does not exist" });
    expect(copy.title).toContain("Atualização");
  });

  it("mapeia timeout", () => {
    const copy = getGroupPollsErrorCopy(new TimeoutError());
    expect(copy.title).toContain("Tempo");
  });
});

describe("withAbortTimeout", () => {
  it("falha com TimeoutError", async () => {
    await expect(
      withAbortTimeout(5, async () => {
        await new Promise(() => void 0);
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
