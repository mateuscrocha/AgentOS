import {
  GROUP_ASSISTANT_BASE_PROMPT,
  GROUP_AI_PROMPT_KEYS,
  ensureDefaultGroupAiPrompts,
} from "./group-ai-prompts.ts";

export type GroupAssistantRow = {
  id: string;
  name: string;
  description?: string | null;
  organization_id: string;
  provider?: string | null;
  whatsapp_provider_id?: string | null;
  provider_phone?: string | null;
  invite_link?: string | null;
  created_at?: string | null;
  assistant_id?: string | null;
  has_assistant?: boolean | null;
  assistant_prompt?: string | null;
  assistant_model?: string | null;
  assistant_runtime?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export class AssistantProvisionError extends Error {
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

export const GROUP_ASSISTANT_MODEL = "gpt-4o-mini";
export const GROUP_ASSISTANT_RUNTIME = "responses";
export const GROUP_ASSISTANT_INSTRUCTIONS =
  GROUP_ASSISTANT_BASE_PROMPT;

const isUnknownColumnError = (err: any): boolean => {
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return code === "PGRST204" || /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
};

export async function createGroupAssistant(args: {
  supabase: any;
  group: GroupAssistantRow;
}) {
  const { supabase, group } = args;

  await ensureDefaultGroupAiPrompts({ supabase, groupId: group.id });

  if (
    group.has_assistant === true &&
    String(group.assistant_prompt || "").trim() === GROUP_ASSISTANT_INSTRUCTIONS &&
    String(group.assistant_model || "").trim() === GROUP_ASSISTANT_MODEL &&
    String(group.assistant_runtime || "").trim() === GROUP_ASSISTANT_RUNTIME &&
    !group.assistant_id
  ) {
    return { configured: true, reused: true };
  }

  const baseUpdate = {
    assistant_id: null,
    has_assistant: true,
    assistant_prompt: GROUP_ASSISTANT_INSTRUCTIONS,
  };

  const updateAttempts = [
    {
      ...baseUpdate,
      assistant_model: GROUP_ASSISTANT_MODEL,
      assistant_runtime: GROUP_ASSISTANT_RUNTIME,
    },
    {
      assistant_id: null,
      assistant_prompt: GROUP_ASSISTANT_INSTRUCTIONS,
      assistant_model: GROUP_ASSISTANT_MODEL,
      assistant_runtime: GROUP_ASSISTANT_RUNTIME,
    },
    baseUpdate,
    {
      assistant_id: null,
      assistant_prompt: GROUP_ASSISTANT_INSTRUCTIONS,
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
    throw new AssistantProvisionError({
      code: "ASSISTANT_CONFIG_UPDATE_FAILED",
      message: String(updateError?.message || "Falha ao salvar configuração do assistant"),
    });
  }

  return {
    configured: true,
    reused: false,
    runtime: GROUP_ASSISTANT_RUNTIME,
    model: GROUP_ASSISTANT_MODEL,
    promptKey: GROUP_AI_PROMPT_KEYS.assistantBase,
  };
}
