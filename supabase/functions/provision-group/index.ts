import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { insertMembersFromParticipantsForGroup } from "../_shared/members-from-participants.ts";

type Env = {
  get: (key: string) => string | undefined;
};

type CreateClient = typeof createClient;

type Deps = {
  createClient?: CreateClient;
  env?: Env;
  fetch?: typeof fetch;
  crypto?: Crypto;
};

const defaultEnv: Env = {
  get: (key: string) => (globalThis as any)?.Deno?.env?.get?.(key),
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class WebhookError extends Error {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 408 || status === 429 || (status >= 500 && status <= 599);

const truncateText = (text: string, limit = 2000) => (text.length > limit ? `${text.slice(0, limit)}…` : text);

const isUnknownColumnError = (err: any): boolean => {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  const msg = message.toLowerCase();
  return (
    code === '42703' ||
    (msg.includes('column') && msg.includes('does not exist')) ||
    (msg.includes('column') && msg.includes('schema cache')) ||
    (msg.includes('could not find the') && msg.includes('column'))
  );
};

const sendCreateAssistantWebhook = async (args: {
  url: string;
  group: GroupRow;
  correlationId: string;
  fetchImpl: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
  maxAttempts?: number;
}) => {
  const { url, group, correlationId, fetchImpl, apiKey } = args;
  const timeoutMs = args.timeoutMs ?? 10_000;
  const maxAttempts = args.maxAttempts ?? 3;

  const payload = {
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    organization_id: group.organization_id,
    whatsapp_group_id: group.whatsapp_provider_id ?? null,
    provider_phone: group.provider_phone ?? null,
    created_at: group.created_at ?? new Date().toISOString(),
    provider: group.provider ?? 'whatsapp',
    invite_link: group.invite_link ?? null,
    status: group.status ?? null,
    has_assistant: group.has_assistant ?? false,
    assistant_id: group.assistant_id ?? null,
    raw_group: group,
    source: 'supabase.functions.provision-group',
    correlation_id: correlationId,
  };

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawBody = await res.text().catch(() => '');
      const bodyText = truncateText(rawBody || '');

      if (res.status === 401 || res.status === 403) {
        throw new WebhookError({
          code: 'WEBHOOK_AUTH_FAILED',
          message: `Falha de autenticação no webhook (HTTP ${res.status})`,
          status: res.status,
          body: bodyText,
        });
      }

      if (!res.ok) {
        throw new WebhookError({
          code: 'WEBHOOK_UPSTREAM_FAILED',
          message: `Webhook retornou erro (HTTP ${res.status} ${res.statusText})`,
          status: res.status,
          body: bodyText,
        });
      }

      let parsed: any = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsed = null;
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new WebhookError({
          code: 'WEBHOOK_RESPONSE_INVALID',
          message: 'Webhook retornou um corpo inválido (JSON esperado)',
          status: res.status,
          body: bodyText,
        });
      }

      const okFlag = (parsed as any).success ?? (parsed as any).ok;
      if (okFlag !== true) {
        throw new WebhookError({
          code: 'WEBHOOK_RESPONSE_INVALID',
          message: 'Webhook retornou payload inesperado (success/ok != true)',
          status: res.status,
          body: bodyText,
        });
      }

      return;
    } catch (e: unknown) {
      lastError = e;
      const status = e instanceof WebhookError ? e.status : undefined;
      const retryable = typeof status === 'number' ? isRetryableStatus(status) : true;
      const shouldRetry = attempt < maxAttempts && retryable;
      if (!shouldRetry) throw e;

      const baseDelay = 400 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 150);
      await sleep(baseDelay + jitter);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida no webhook');
};

interface ProvisionGroupPayload {
  organization_id: string;
  group: {
    provider: string;
    whatsapp_provider_id: string;
    name: string;
    invite_link: string;
  };
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    whatsapp_provider_id: string;
  }>;
}

type GroupRow = {
  id: string;
  name: string;
  description?: string | null;
  organization_id: string;
  whatsapp_provider_id?: string | null;
  provider_phone?: string | null;
  created_at?: string;
  updated_at?: string;
  provider?: string | null;
  invite_link?: string | null;
  status?: string | null;
  has_assistant?: boolean | null;
  assistant_id?: string | null;
  metadata?: unknown;
  raw_provider?: unknown;
  sync_status?: string | null;
  sync_error?: string | null;
};

export const createProvisionGroupHandler = (deps: Deps = {}) => {
  const env = deps.env ?? defaultEnv;
  const createClientImpl = deps.createClient ?? createClient;
  const fetchImpl = deps.fetch ?? fetch;
  const cryptoImpl = deps.crypto ?? crypto;

  return async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = req.headers.get('x-correlation-id') ?? cryptoImpl.randomUUID();

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, code: 'AUTH_REQUIRED', message: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ProvisionGroupPayload = await req.json();
    
    console.log('Adding new group:', JSON.stringify({
      organization_id: payload.organization_id,
      group_name: payload.group.name,
      participants_count: payload.participants.length,
    }));

    if (!payload.organization_id) {
      return new Response(
        JSON.stringify({ success: false, code: 'ORG_ID_REQUIRED', message: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.group?.name || !payload.group?.whatsapp_provider_id) {
      return new Response(
        JSON.stringify({ success: false, code: 'GROUP_DATA_INCOMPLETE', message: 'Group data is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.group?.provider && payload.group.provider !== 'whatsapp') {
      return new Response(
        JSON.stringify({ success: false, code: 'UNSUPPORTED_PROVIDER', message: 'Only WhatsApp provider is supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.participants && !Array.isArray(payload.participants)) {
      return new Response(
        JSON.stringify({ success: false, code: 'INVALID_PARTICIPANTS', message: 'Participants must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = env.get('SUPABASE_URL');
    const supabaseAnonKey = env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ success: false, code: 'SUPABASE_URL_NOT_CONFIGURED', message: 'SUPABASE_URL não configurada no ambiente da função' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, code: 'SUPABASE_ANON_KEY_NOT_CONFIGURED', message: 'SUPABASE_ANON_KEY não configurada no ambiente da função' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUser = createClientImpl(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ success: false, code: 'AUTH_INVALID', message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Verify user has permission to create groups in this organization
    // This will be enforced by RLS on insert, but let's check first for better error messages
    const { data: org, error: orgError } = await supabaseUser
      .from('organizations')
      .select('id, name')
      .eq('id', payload.organization_id)
      .maybeSingle();

    if (orgError || !org) {
      console.error('Organization access error:', orgError);
      return new Response(
        JSON.stringify({ success: false, code: 'ORG_ACCESS_DENIED', message: 'Organization not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const findExistingGroup = async () => {
      let existing: any = null;
      let err: any = null;
      ({ data: existing, error: err } = await supabaseUser
        .from('groups')
        .select('id, name')
        .eq('whatsapp_provider_id', payload.group.whatsapp_provider_id)
        .maybeSingle());
      if (err && isUnknownColumnError(err)) {
        ({ data: existing, error: err } = await supabaseUser
          .from('groups')
          .select('id, name')
          .eq('provider_group_id', payload.group.whatsapp_provider_id)
          .maybeSingle());
      }
      if (err) throw err;
      return existing;
    };

    const existingGroup = await findExistingGroup().catch(() => null);

    if (existingGroup) {
      return new Response(
        JSON.stringify({ 
          success: false,
          code: 'GROUP_ALREADY_EXISTS',
          message: `Este grupo já está incluído como "${existingGroup.name}"`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceRoleKey = env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, code: 'SERVICE_ROLE_NOT_CONFIGURED', message: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente da função' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClientImpl(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tryInsertGroup = async () => {
      const base: any = {
        name: payload.group.name,
        organization_id: payload.organization_id,
        provider: 'whatsapp',
        invite_link: payload.group.invite_link,
        invite_link_status: 'valid',
        status: 'active',
        is_active: true,
        is_archived: false,
      };

      let insertPayload: any = { ...base, whatsapp_provider_id: payload.group.whatsapp_provider_id };
      let res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();

      if (res.error && isUnknownColumnError(res.error)) {
        insertPayload = { ...base, provider_group_id: payload.group.whatsapp_provider_id };
        res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();
      }

      if (res.error && isUnknownColumnError(res.error)) {
        const minimalBase: any = {
          name: payload.group.name,
          organization_id: payload.organization_id,
          provider: 'whatsapp',
          invite_link: payload.group.invite_link,
        };
        insertPayload = { ...minimalBase, whatsapp_provider_id: payload.group.whatsapp_provider_id };
        res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();
        if (res.error && isUnknownColumnError(res.error)) {
          insertPayload = { ...minimalBase, provider_group_id: payload.group.whatsapp_provider_id };
          res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();
        }
      }

      if (res.error && isUnknownColumnError(res.error)) {
        const minimalBase: any = {
          name: payload.group.name,
          organization_id: payload.organization_id,
          provider: 'whatsapp',
        };
        insertPayload = { ...minimalBase, whatsapp_provider_id: payload.group.whatsapp_provider_id };
        res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();
        if (res.error && isUnknownColumnError(res.error)) {
          insertPayload = { ...minimalBase, provider_group_id: payload.group.whatsapp_provider_id };
          res = await supabaseUser.from('groups').insert(insertPayload).select('id').single();
        }
      }

      return res;
    };

    const { data: group, error: groupError } = await tryInsertGroup();

    if (groupError) {
      console.error('Error adding group:', groupError);
      if (groupError.message?.includes('row-level security')) {
        return new Response(
          JSON.stringify({ success: false, code: 'RLS_DENIED', message: 'Você não tem permissão para incluir grupos nesta organização' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, code: 'GROUP_INSERT_FAILED', message: 'Falha ao incluir grupo: ' + groupError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Group added:', group.id);

    const cleanupGroup = async () => {
      try {
        await supabaseAdmin.from('members').delete().eq('group_id', group.id);
      } catch {
      }

      try {
        await supabaseAdmin.from('events').delete().eq('entity_type', 'group').eq('entity_id', group.id);
      } catch {
      }

      try {
        await supabaseAdmin.from('groups').delete().eq('id', group.id);
      } catch {
      }
    };

    try {
      await insertMembersFromParticipantsForGroup({
        supabase: supabaseUser,
        groupId: group.id,
        participants: payload.participants,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Error creating members:', msg);
    }

    const createAssistantWebhookUrl =
      env.get('VITE_N8N_WEBHOOK_CREATE_ASSISTANT_URL') ||
      env.get('N8N_WEBHOOK_CREATE_ASSISTANT_URL');

    const createAssistantWebhookApiKey =
      env.get('N8N_WEBHOOK_CREATE_ASSISTANT_API_KEY') ||
      env.get('VITE_N8N_WEBHOOK_CREATE_ASSISTANT_API_KEY') ||
      env.get('N8N_WEBHOOK_API_KEY') ||
      env.get('VITE_N8N_WEBHOOK_API_KEY');

    if (!createAssistantWebhookUrl) {
      try {
        await supabaseAdmin
          .from('events')
          .insert({
            event_type: 'GROUP_WEBHOOK_FAILED',
            entity_type: 'group',
            entity_id: group.id,
            user_id: user.id,
            metadata: {
              organization_id: payload.organization_id,
              code: 'WEBHOOK_NOT_CONFIGURED',
              correlation_id: correlationId,
            },
          });
      } catch {
      }

      await cleanupGroup();

      return new Response(
        JSON.stringify({ success: false, code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook de criação do assistente não está configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { data: groupRow, error: groupRowError } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', group.id)
        .maybeSingle();

      if (groupRowError) {
        throw groupRowError;
      }

      const fallbackGroup: GroupRow = {
        id: group.id,
        name: payload.group.name,
        description: null,
        organization_id: payload.organization_id,
        provider: 'whatsapp',
        whatsapp_provider_id: payload.group.whatsapp_provider_id,
        provider_phone: null,
        invite_link: payload.group.invite_link,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assistant_id: null,
        has_assistant: false,
        metadata: null,
        raw_provider: null,
        status: null,
        sync_status: null,
        sync_error: null,
      };

      await sendCreateAssistantWebhook({
        url: createAssistantWebhookUrl,
        group: (groupRow as GroupRow) ?? fallbackGroup,
        correlationId,
        fetchImpl,
        apiKey: createAssistantWebhookApiKey,
        maxAttempts: 3,
        timeoutMs: 10_000,
      });
    } catch (e: unknown) {
      const code = e instanceof WebhookError ? e.code : 'WEBHOOK_UPSTREAM_FAILED';
      const status = e instanceof WebhookError ? e.status : undefined;
      const body = e instanceof WebhookError ? e.body : undefined;
      const message = e instanceof Error ? e.message : String(e);

      try {
        await supabaseAdmin
          .from('events')
          .insert({
            event_type: 'GROUP_WEBHOOK_FAILED',
            entity_type: 'group',
            entity_id: group.id,
            user_id: user.id,
            metadata: {
              organization_id: payload.organization_id,
              code,
              status,
              message,
              body,
              correlation_id: correlationId,
            },
          });
      } catch {
      }

      await cleanupGroup();

      return new Response(
        JSON.stringify({ success: false, code, message: 'Falha ao validar o webhook. Operação cancelada.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        event_type: 'GROUP_ADDED',
        entity_type: 'group',
        entity_id: group.id,
        user_id: user.id,
        metadata: {
          organization_id: payload.organization_id,
          organization_name: org.name,
          group_name: payload.group.name,
          participants_count: payload.participants?.length || 0,
          correlation_id: correlationId,
        },
      });

    if (eventError) {
      console.error('Error logging event:', eventError);
    }

    console.log('Group added successfully');

    return new Response(
      JSON.stringify({
        success: true,
        group_id: group.id,
        message: 'Grupo incluído com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in provision-group:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, code: 'UNEXPECTED_ERROR', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  };
};

serve(createProvisionGroupHandler());
