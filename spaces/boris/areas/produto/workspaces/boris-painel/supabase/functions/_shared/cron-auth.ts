import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

export async function verifyCronApiKey(args: {
  env: { get: (key: string) => string | undefined };
  providedApiKey: string;
  createClientImpl?: typeof createClient;
}): Promise<boolean> {
  const { env, providedApiKey } = args;
  const normalizedProvided = String(providedApiKey || "").trim();
  if (!normalizedProvided) return false;

  const envApiKey = readEnv(env, "GROUP_AI_CRON_API_KEY");
  if (envApiKey && normalizedProvided === envApiKey) {
    return true;
  }

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  try {
    const createClientImpl = args.createClientImpl ?? createClient;
    const supabase = createClientImpl(supabaseUrl, serviceRoleKey);
    const { data, error } = await (supabase as any).rpc("verify_group_ai_cron_api_key", {
      provided_key: normalizedProvided,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

