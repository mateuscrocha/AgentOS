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

    // Return the validation result
    return new Response(
      JSON.stringify({
        is_valid: data.is_valid ?? false,
        is_boris_in_group: data.is_boris_in_group ?? false,
        provider: data.provider ?? 'zapi',
        provider_group_id: data.provider_group_id ?? '',
        group_name: data.group_name ?? '',
        participants_count: data.participants_count ?? 0,
        participants: data.participants ?? [],
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
