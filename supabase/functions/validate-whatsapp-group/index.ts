import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function env(key: string): string | undefined {
  return (globalThis as any)?.Deno?.env?.get?.(key);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
};

export type NormalizedParticipant = {
  phone: string;
  name: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_owner: boolean;
  whatsapp_provider_id: string;
};

export function normalizeParticipants(raw: unknown): NormalizedParticipant[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((p: any) => {
    const phone = String(p?.phone ?? '');
    const isOwner = !!(p?.isSuperAdmin);
    return {
      phone,
      name: phone,
      is_admin: !!(p?.isAdmin || p?.isSuperAdmin),
      is_super_admin: !!(p?.isSuperAdmin),
      is_owner: isOwner,
      whatsapp_provider_id: String(p?.lid || phone),
    };
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ correlation_id: correlationId, ...body }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
    });

  if (req.method !== 'POST') {
    return json({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, 405);
  }

  try {
    const { invite_link } = await req.json();

    if (!invite_link) {
      return json(
        {
          success: false,
          code: 'INVITE_LINK_REQUIRED',
          message: 'invite_link is required',
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
        },
        400
      );
    }

    const n8nWebhookUrl = env('VITE_N8N_CHECK_GROUP_ENTRY_URL');
    
    if (!n8nWebhookUrl) {
      console.error('VITE_N8N_CHECK_GROUP_ENTRY_URL not configured', JSON.stringify({ correlation_id: correlationId }));
      return json(
        {
          success: false,
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'Webhook URL not configured',
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
        },
        500
      );
    }

    const inviteLinkHash = (() => {
      const raw = String(invite_link);
      return raw.length <= 12 ? raw : `${raw.slice(0, 6)}…${raw.slice(-4)}`;
    })();

    console.log('Validating WhatsApp group', JSON.stringify({ correlation_id: correlationId, invite_link: inviteLinkHash }));

    // Call n8n webhook to validate the group
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ invite_link }),
    });

    if (!response.ok) {
      console.error('n8n webhook error', JSON.stringify({
        correlation_id: correlationId,
        status: response.status,
        status_text: response.statusText,
      }));
      return json(
        {
          success: false,
          code: 'VALIDATION_UPSTREAM_FAILED',
          message: 'Failed to validate group',
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
        },
        502
      );
    }

    const data = await response.json();
    console.log('n8n response', JSON.stringify({
      correlation_id: correlationId,
      type: Array.isArray(data) ? 'array' : typeof data,
    }));

    // Check if Bóris is NOT in the group (returns { checkBotEnabled: false })
    if (data && typeof data === 'object' && !Array.isArray(data) && data.checkBotEnabled === false) {
      console.log('Bóris is NOT in the group');
      return json({
        success: true,
        is_valid: true,
        is_boris_in_group: false,
        provider: 'whatsapp',
        whatsapp_provider_id: '',
        group_name: '',
        participants_count: 0,
        participants: [],
      });
    }

    // Check if response is an array (Bóris IS in the group)
    if (Array.isArray(data) && data.length > 0) {
      const groupData = data[0];
      console.log('Bóris IS in the group', JSON.stringify({
        correlation_id: correlationId,
        group_name: groupData.name || groupData.subject,
      }));
      
      // Map participants to our format
      const participants = normalizeParticipants(groupData.participants);

      const groupName = groupData.name || groupData.subject || '';
      const providerId = groupData.phone || '';
      
      // Check if essential data is missing
      const missingFields: string[] = [];
      if (!groupName) missingFields.push('nome do grupo');
      if (!providerId) missingFields.push('identificador do grupo');
      if (participants.length === 0) missingFields.push('lista de participantes');
      
      const dataIncomplete = missingFields.length > 0;
      let dataIncompleteReason = '';
      if (dataIncomplete) {
        dataIncompleteReason = `Não foi possível obter: ${missingFields.join(', ')}. Isso pode acontecer quando o grupo está muito grande ou a conexão está instável.`;
      }

      return json({
        success: true,
        is_valid: true,
        is_boris_in_group: true,
        provider: 'whatsapp',
        whatsapp_provider_id: providerId,
        group_name: groupName,
        participants_count: participants.length,
        participants,
        data_incomplete: dataIncomplete,
        data_incomplete_reason: dataIncompleteReason || undefined,
      });
    }

    // Unknown response format
    console.error('Unknown n8n response format', JSON.stringify({ correlation_id: correlationId }));
    return json(
      {
        success: false,
        code: 'UNKNOWN_VALIDATION_RESPONSE',
        message: 'Unknown response format from validation service',
        is_valid: false,
        is_boris_in_group: false,
        provider: 'whatsapp',
        whatsapp_provider_id: '',
        group_name: '',
        participants_count: 0,
        participants: [],
      },
      502
    );

  } catch (error: unknown) {
    console.error('Error in validate-whatsapp-group', JSON.stringify({
      correlation_id: correlationId,
      message: error instanceof Error ? error.message : String(error),
    }));
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json(
      {
        success: false,
        code: 'UNEXPECTED_ERROR',
        message,
        is_valid: false,
        is_boris_in_group: false,
        provider: 'whatsapp',
        whatsapp_provider_id: '',
        group_name: '',
        participants_count: 0,
        participants: [],
      },
      500
    );
  }
});
