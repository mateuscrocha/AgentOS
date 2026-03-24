import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createIncomingProviderEventHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

DenoRef.test("incoming-provider-event exporta o handler unificado", async () => {
  const res = await createIncomingProviderEventHandler(
    new Request("http://localhost:8000/functions/v1/incoming-provider-event", {
      method: "OPTIONS",
    }),
  );

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
