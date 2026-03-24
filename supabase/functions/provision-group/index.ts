import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ProvisionCoreError, provisionGroupWithMembersCore } from "../_shared/provision-group-core.ts";
import { AssistantProvisionError, createGroupAssistant } from "../_shared/create-group-assistant.ts";

type Env = {
  get: (key: string) => string | undefined;
};

type CreateClient = typeof createClient;

type Deps = {
  createClient?: CreateClient;
  env?: Env;
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

interface ProvisionGroupPayload {
  organization_id: string;
  group: {
    provider: string;
    provider_phone?: string;
    whatsapp_provider_id?: string;
    name: string;
    invite_link: string;
  };
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    lid?: string;
    whatsapp_provider_id?: string;
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
  assistant_prompt?: string | null;
  assistant_model?: string | null;
  assistant_runtime?: string | null;
  metadata?: unknown;
  raw_provider?: unknown;
  sync_status?: string | null;
  sync_error?: string | null;
};

export const createProvisionGroupHandler = (deps: Deps = {}) => {
  const env = deps.env ?? defaultEnv;
  const createClientImpl = deps.createClient ?? createClient;
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

    if (!payload.group?.name || !(payload.group?.provider_phone || payload.group?.whatsapp_provider_id)) {
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

    let groupId: string;
    try {
      const coreRes = await provisionGroupWithMembersCore({
        supabase: supabaseUser,
        organizationId: payload.organization_id,
        group: payload.group,
        participants: payload.participants,
        options: {
          participantsPolicy: 'lenient',
          requireParticipants: false,
          requireMembersInserted: false,
          membersMode: 'best_effort',
        },
      });

      groupId = coreRes.group_id;
    } catch (e: unknown) {
      if (e instanceof ProvisionCoreError) {
        if (e.code === 'GROUP_ALREADY_EXISTS') {
          const name = (e.details as any)?.existing_group?.name;
          const message = name
            ? `Este grupo já está incluído como "${name}"`
            : 'Este grupo já está incluído.';
          return new Response(
            JSON.stringify({ success: false, code: 'GROUP_ALREADY_EXISTS', message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, code: e.code, message: e.message }),
          { status: e.status ?? 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const err: any = e;
      if (String(err?.message || '').includes('row-level security')) {
        return new Response(
          JSON.stringify({ success: false, code: 'RLS_DENIED', message: 'Você não tem permissão para incluir grupos nesta organização' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, code: 'GROUP_INSERT_FAILED', message: 'Falha ao incluir grupo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Group added:', groupId);

    const cleanupGroup = async () => {
      try {
        await supabaseAdmin.from('members').delete().eq('group_id', groupId);
      } catch {
      }

      try {
        await supabaseAdmin.from('events').delete().eq('entity_type', 'group').eq('entity_id', groupId);
      } catch {
      }

      try {
        await supabaseAdmin.from('groups').delete().eq('id', groupId);
      } catch {
      }
    };

    try {
      const { data: groupRow, error: groupRowError } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (groupRowError) {
        throw groupRowError;
      }

      const fallbackGroup: GroupRow = {
        id: groupId,
        name: payload.group.name,
        description: null,
        organization_id: payload.organization_id,
        provider: 'whatsapp',
        whatsapp_provider_id: payload.group.whatsapp_provider_id ?? payload.group.provider_phone ?? null,
        provider_phone: payload.group.provider_phone ?? payload.group.whatsapp_provider_id ?? null,
        invite_link: payload.group.invite_link,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assistant_id: null,
        assistant_prompt: null,
        assistant_model: null,
        assistant_runtime: null,
        has_assistant: false,
        metadata: null,
        raw_provider: null,
        status: null,
        sync_status: null,
        sync_error: null,
      };

      await createGroupAssistant({
        supabase: supabaseAdmin,
        group: (groupRow as GroupRow) ?? fallbackGroup,
      });
    } catch (e: unknown) {
      const code = e instanceof AssistantProvisionError ? e.code : 'ASSISTANT_CONFIG_UPDATE_FAILED';
      const status = e instanceof AssistantProvisionError ? e.status : undefined;
      const body = e instanceof AssistantProvisionError ? e.body : undefined;
      const message = e instanceof Error ? e.message : String(e);

      try {
        await supabaseAdmin
          .from('events')
          .insert({
            event_type: 'GROUP_ASSISTANT_PROVISION_FAILED',
            entity_type: 'group',
            entity_id: groupId,
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
        JSON.stringify({ success: false, code, message: 'Falha ao salvar a configuração do assistant. Operação cancelada.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        event_type: 'GROUP_ADDED',
        entity_type: 'group',
        entity_id: groupId,
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
        group_id: groupId,
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

if ((import.meta as any).main) {
  serve(createProvisionGroupHandler());
}
