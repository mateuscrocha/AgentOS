import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function toE164(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.length > 18) return null;
  if (digits.startsWith("55") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();

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

    // Create Supabase client with user's token to respect RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Check if group with same provider_group_id already exists
    const { data: existingGroup } = await supabaseUser
      .from('groups')
      .select('id, name')
      .eq('whatsapp_provider_id', payload.group.whatsapp_provider_id)
      .maybeSingle();

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

    // Create Group - RLS will enforce permission
    const { data: group, error: groupError } = await supabaseUser
      .from('groups')
      .insert({
        name: payload.group.name,
        organization_id: payload.organization_id,
        provider: 'whatsapp',
        whatsapp_provider_id: payload.group.whatsapp_provider_id,
        invite_link: payload.group.invite_link,
      })
      .select('id')
      .single();

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

    // Create Members from participants - RLS will enforce permission
    if (payload.participants && payload.participants.length > 0) {
      const nowIso = new Date().toISOString();

      const normalizedParticipants = payload.participants
        .map((p) => {
          const phoneE164 = toE164(p.phone);
          const whatsappProviderId = (p.whatsapp_provider_id || p.phone || "").toString().trim();
          return {
            phone_raw: (p.phone || "").toString(),
            phone_e164: phoneE164,
            whatsapp_provider_id: whatsappProviderId || null,
            is_admin: !!p.is_admin,
            is_super_admin: !!p.is_super_admin,
            name: (p.name || "").toString().trim() || null,
          };
        })
        .filter((p) => !!p.phone_e164 && !!p.whatsapp_provider_id);

      const participantsUnique: typeof normalizedParticipants = [];
      const seenParticipantKeys = new Set<string>();
      for (const p of normalizedParticipants) {
        const key = (p.whatsapp_provider_id || p.phone_e164 || "").trim();
        if (!key) continue;
        if (seenParticipantKeys.has(key)) continue;
        seenParticipantKeys.add(key);
        participantsUnique.push(p);
      }

      const membersToInsert = participantsUnique.map((p) => ({
        group_id: group.id,
        name: p.name || p.phone_raw,
        phone_e164: p.phone_e164,
        is_admin: p.is_admin || false,
        is_super_admin: p.is_super_admin || false,
        whatsapp_provider_id: p.whatsapp_provider_id,
        provider: 'whatsapp',
        first_seen_at: nowIso,
        joined_at: nowIso,
        status: 'active',
      }));

      const { error: membersError } = await supabaseUser
        .from('members')
        .insert(membersToInsert);

      if (membersError) {
        console.error('Error creating members:', membersError);
        // Continue anyway, members are not critical
      } else {
        console.log('Members added:', membersToInsert.length);
      }
    }

    // Log the event using service role to bypass RLS
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
        },
      });

    if (eventError) {
      console.error('Error logging event:', eventError);
      // Continue anyway
    }

    const createAssistantWebhookUrl =
      Deno.env.get('VITE_N8N_WEBHOOK_CREATE_ASSISTANT_URL') ||
      Deno.env.get('N8N_WEBHOOK_CREATE_ASSISTANT_URL');
    if (createAssistantWebhookUrl) {
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

        const g = (groupRow as GroupRow) ?? fallbackGroup;

        const webhookPayload = {
          id: g.id,
          name: g.name,
          description: g.description ?? null,
          organization_id: g.organization_id,
          whatsapp_group_id: g.whatsapp_provider_id ?? null,
          provider_phone: g.provider_phone ?? null,
          created_at: g.created_at ?? new Date().toISOString(),
          provider: g.provider ?? 'whatsapp',
          invite_link: g.invite_link ?? null,
          status: g.status ?? null,
          has_assistant: g.has_assistant ?? false,
          assistant_id: g.assistant_id ?? null,
          raw_group: g,
          source: 'supabase.functions.provision-group',
          correlation_id: correlationId,
        };

        const res = await fetch(createAssistantWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': correlationId,
          },
          body: JSON.stringify(webhookPayload),
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          console.error(
            'Create assistant webhook failed:',
            JSON.stringify({
              correlation_id: correlationId,
              status: res.status,
              status_text: res.statusText,
              body: bodyText,
            })
          );
        }
      } catch (e: unknown) {
        console.error(
          'Create assistant webhook error:',
          JSON.stringify({
            correlation_id: correlationId,
            message: e instanceof Error ? e.message : String(e),
          })
        );
      }
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
});
