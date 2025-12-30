import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invite_link } = await req.json();

    if (!invite_link) {
      return new Response(
        JSON.stringify({ error: 'invite_link is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const n8nWebhookUrl = Deno.env.get('N8N_VALIDATE_GROUP_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      console.error('N8N_VALIDATE_GROUP_WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating WhatsApp group:', invite_link);

    // Call n8n webhook to validate the group
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invite_link }),
    });

    if (!response.ok) {
      console.error('n8n webhook error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          is_valid: false, 
          is_boris_in_group: false,
          error: 'Failed to validate group' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('n8n response:', JSON.stringify(data));

    // Check if Bóris is NOT in the group (returns { checkBotEnabled: false })
    if (data && typeof data === 'object' && !Array.isArray(data) && data.checkBotEnabled === false) {
      console.log('Bóris is NOT in the group');
      return new Response(
        JSON.stringify({
          is_valid: true,
          is_boris_in_group: false,
          provider: 'zapi',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response is an array (Bóris IS in the group)
    if (Array.isArray(data) && data.length > 0) {
      const groupData = data[0];
      console.log('Bóris IS in the group:', groupData.name || groupData.subject);
      
      // Map participants to our format
      const participants = (groupData.participants || []).map((p: { phone: string; isAdmin?: boolean; isSuperAdmin?: boolean; lid?: string }) => ({
        phone: p.phone,
        name: p.phone,
        is_admin: p.isAdmin || p.isSuperAdmin || false,
        is_super_admin: p.isSuperAdmin || false,
        whatsapp_provider_id: p.lid || p.phone,
      }));

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

      return new Response(
        JSON.stringify({
          is_valid: true,
          is_boris_in_group: true,
          provider: 'zapi',
          whatsapp_provider_id: providerId,
          group_name: groupName,
          participants_count: participants.length,
          participants,
          data_incomplete: dataIncomplete,
          data_incomplete_reason: dataIncompleteReason || undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown response format
    console.error('Unknown n8n response format:', data);
    return new Response(
      JSON.stringify({
        is_valid: false,
        is_boris_in_group: false,
          provider: 'zapi',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
          error: 'Unknown response format from validation service',
        }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in validate-whatsapp-group:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        is_valid: false, 
        is_boris_in_group: false,
        error: message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
