import { OpenAiResponsesError } from "./openai-responses.ts";

type MinimalSupabaseClient = {
  from: (table: string) => {
    select: (...args: any[]) => any;
    insert: (values: any) => Promise<{ error: { message?: string } | null }>;
  };
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function truncate(value: string, limit = 1000) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

export function isOpenAiBillingOrQuotaIssue(error: OpenAiResponsesError) {
  const body = normalize(error.body);
  if (error.status !== 429) return false;

  return [
    "insufficient_quota",
    "billing_hard_limit_reached",
    "exceeded your current quota",
    "quota",
    "billing",
    "credit balance is too low",
  ].some((term) => body.includes(term));
}

export async function recordOpenAiBillingAlert(args: {
  supabase: MinimalSupabaseClient;
  error: OpenAiResponsesError;
  operation: string;
  groupId?: string | null;
  groupName?: string | null;
  targetDate?: string | null;
  userId?: string | null;
  dedupeMinutes?: number;
}) {
  const {
    supabase,
    error,
    operation,
    groupId = null,
    groupName = null,
    targetDate = null,
    userId = null,
    dedupeMinutes = 30,
  } = args;

  if (!isOpenAiBillingOrQuotaIssue(error)) return { recorded: false, reason: "not_billing_or_quota" as const };

  const dedupeSince = new Date(Date.now() - dedupeMinutes * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from("events")
    .select("id, created_at, metadata")
    .eq("event_type", "OPENAI_BILLING_ALERT")
    .eq("entity_type", "system")
    .eq("entity_id", "openai-billing")
    .gte("created_at", dedupeSince)
    .order("created_at", { ascending: false })
    .limit(10);

  const duplicate = Array.isArray(recentEvents) && recentEvents.some((event: any) => {
    const metadata = event?.metadata ?? {};
    return (
      String(metadata.operation || "") === operation &&
      String(metadata.group_id || "") === String(groupId || "") &&
      String(metadata.target_date || "") === String(targetDate || "") &&
      String(metadata.status || "") === String(error.status || "")
    );
  });

  if (duplicate) return { recorded: false, reason: "deduped" as const };

  const { error: insertError } = await supabase.from("events").insert({
    event_type: "OPENAI_BILLING_ALERT",
    entity_type: "system",
    entity_id: "openai-billing",
    user_id: userId,
    metadata: {
      provider: "openai",
      operation,
      group_id: groupId,
      group_name: groupName,
      target_date: targetDate,
      code: error.code,
      status: error.status ?? null,
      body_excerpt: truncate(String(error.body || ""), 1000),
      alert_kind: "billing_or_quota",
    },
  });

  if (insertError) {
    console.error("failed to record OPENAI_BILLING_ALERT", insertError.message || insertError);
    return { recorded: false, reason: "insert_failed" as const };
  }

  return { recorded: true, reason: "inserted" as const };
}
