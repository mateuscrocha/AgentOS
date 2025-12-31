import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProvisionPayload {
  lead: {
    name: string;
    email: string;
    whatsapp_phone: string;
    user_id: string;
  };
  organization: {
    name: string;
  };
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const payload: ProvisionPayload = await req.json();
    
    console.log('Provisioning onboarding:', JSON.stringify({
      lead_email: payload.lead.email,
      org_name: payload.organization.name,
      group_name: payload.group.name,
      participants_count: Array.isArray(payload.participants) ? payload.participants.length : 0,
    }));

    // Validate required fields
    if (!payload.lead?.user_id || !payload.lead?.email || !payload.lead?.name) {
      return new Response(
        JSON.stringify({ success: false, code: 'LEAD_DATA_INCOMPLETE', message: 'Lead data is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.organization?.name) {
      return new Response(
        JSON.stringify({ success: false, code: 'ORG_NAME_REQUIRED', message: 'Organization name is required' }),
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

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const normalizePhone = (phone: string | null | undefined): string | null => {
      const raw = (phone || '').trim();
      if (!raw) return null;
      if (raw.startsWith('+')) return raw.replace(/\s+/g, '');
      const digits = raw.replace(/\D/g, '');
      if (!digits) return null;
      if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
      return '+55' + digits;
    };

    const primaryPhone = normalizePhone(payload.lead.whatsapp_phone);

    const { data: txData, error: txError } = await supabase.rpc('public_onboarding_provision_tx_v2', {
      p_user_id: payload.lead.user_id,
      p_lead_name: payload.lead.name,
      p_lead_email: payload.lead.email,
      p_lead_phone: primaryPhone,
      p_organization_name: payload.organization.name,
      p_group_name: payload.group.name,
      p_group_invite_link: payload.group.invite_link,
      p_group_whatsapp_provider_id: payload.group.whatsapp_provider_id,
      p_participants: payload.participants ?? [],
    });

    if (txError) {
      console.error('Error provisioning onboarding (tx):', txError);
      if ((txError as any)?.code === '23505') {
        return json(
          {
            success: false,
            code: 'GROUP_ALREADY_PROVISIONED',
            message: 'Esse grupo já foi cadastrado. Faça login para continuar.',
          },
          409
        );
      }
      return json(
        {
          success: false,
          code: 'ONBOARDING_TX_FAILED',
          message: `Falha no provisionamento: ${txError.message}`,
        },
        500
      );
    }

    const row = Array.isArray(txData) ? txData[0] : null;
    const organizationId = row?.organization_id as string | undefined;
    const groupId = row?.group_id as string | undefined;
    if (!organizationId || !groupId) {
      return json(
        {
          success: false,
          code: 'ONBOARDING_TX_EMPTY',
          message: 'Provisionamento retornou vazio',
        },
        500
      );
    }

    console.log('Onboarding provisioning completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: organizationId,
        group_id: groupId,
        message: 'Onboarding completed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in provision-onboarding:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, code: 'UNEXPECTED_ERROR', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
