import {
  GROUP_AI_BASE_PROMPT,
  GROUP_AI_PROMPT_KEYS,
  ensureDefaultGroupAiPrompts,
} from "./group-ai-prompts.ts";

export type GroupAiConfigRow = {
  id: string;
  name: string;
  description?: string | null;
  organization_id: string;
  provider?: string | null;
  whatsapp_provider_id?: string | null;
  provider_phone?: string | null;
  invite_link?: string | null;
  created_at?: string | null;
  ai_enabled?: boolean | null;
  ai_prompt?: string | null;
  ai_model?: string | null;
  ai_runtime?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export class GroupAiConfigError extends Error {
  code: string;
  status?: number;
  body?: string;

  constructor(args: { code: string; message: string; status?: number; body?: string }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.body = args.body;
  }
}

export const GROUP_AI_MODEL = "gpt-4o-mini";
export const GROUP_AI_RUNTIME = "responses";
export const GROUP_AI_INSTRUCTIONS = GROUP_AI_BASE_PROMPT;

const isUnknownColumnError = (err: any): boolean => {
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return code === "PGRST204" || /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
};

export async function configureGroupAi(args: {
  supabase: any;
  group: GroupAiConfigRow;
}) {
  const { supabase, group } = args;

  await ensureDefaultGroupAiPrompts({ supabase, groupId: group.id });

  const aiEnabled = group.ai_enabled ?? false;
  const aiPrompt = String(group.ai_prompt || "").trim();
  const aiModel = String(group.ai_model || "").trim();
  const aiRuntime = String(group.ai_runtime || "").trim();

  if (
    aiEnabled === true &&
    aiPrompt === GROUP_AI_INSTRUCTIONS &&
    aiModel === GROUP_AI_MODEL &&
    aiRuntime === GROUP_AI_RUNTIME
  ) {
    return { configured: true, reused: true };
  }

  const updateAttempts = [
    {
      ai_enabled: true,
      ai_prompt: GROUP_AI_INSTRUCTIONS,
      ai_model: GROUP_AI_MODEL,
      ai_runtime: GROUP_AI_RUNTIME,
    },
    {
      ai_enabled: true,
      ai_prompt: GROUP_AI_INSTRUCTIONS,
    },
  ];

  let updateError: any = null;
  for (const payload of updateAttempts) {
    const { error } = await supabase
      .from("groups")
      .update(payload)
      .eq("id", group.id);

    if (!error) {
      updateError = null;
      break;
    }

    updateError = error;
    if (!isUnknownColumnError(error)) {
      break;
    }
  }

  if (updateError) {
    throw new GroupAiConfigError({
      code: "GROUP_AI_CONFIG_UPDATE_FAILED",
      message: String(updateError?.message || "Falha ao salvar configuração de IA do grupo"),
    });
  }

  return {
    configured: true,
    reused: false,
    runtime: GROUP_AI_RUNTIME,
    model: GROUP_AI_MODEL,
    promptKey: GROUP_AI_PROMPT_KEYS.groupAiBase,
  };
}
