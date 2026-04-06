import { createGenerateGroupSummaryHandler } from "../supabase/functions/generate-group-summary/index.ts";

const groupId = Deno.env.get("GROUP_ID") || Deno.args[0];
const summaryDate = Deno.env.get("SUMMARY_DATE") || Deno.args[1];

if (!groupId || !summaryDate) {
  console.error("Usage: deno run -A tmp/regenerate_group_summary.ts <groupId> <summaryDate>");
  Deno.exit(1);
}

const env = {
  get(key: string) {
    return Deno.env.get(key);
  },
};

const handler = createGenerateGroupSummaryHandler({ env });

const req = new Request("http://localhost/functions/v1/generate-group-summary", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": String(Deno.env.get("GROUP_AI_CRON_API_KEY") || "local-cron-key"),
  },
  body: JSON.stringify({
    groupId,
    summaryDate,
    sendToGroup: false,
  }),
});

const res = await handler(req);
const payload = await res.json().catch(() => null);

console.log(JSON.stringify({
  status: res.status,
  ok: res.ok,
  payload,
}, null, 2));
