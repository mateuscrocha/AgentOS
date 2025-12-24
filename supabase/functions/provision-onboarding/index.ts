import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    provider_group_id: string;
    name: string;
    invite_link: string;
  };
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    provider_member_id: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ProvisionPayload = await req.json();
    
    console.log('Provisioning onboarding:', JSON.stringify({
      lead_email: payload.lead.email,
      org_name: payload.organization.name,
      group_name: payload.group.name,
      participants_count: payload.participants.length,
    }));

    // Validate required fields
    if (!payload.lead?.user_id || !payload.lead?.email || !payload.lead?.name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Lead data is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.organization?.name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Organization name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.group?.name || !payload.group?.provider_group_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Group data is incomplete' }),
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

    // 1. Create Organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: payload.organization.name,
        status: 'active',
      })
      .select('id')
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create organization: ' + orgError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created organization:', org.id);

    const { error: orgOwnerError } = await supabase
      .from('organizations')
      .update({
        owner_user_id: payload.lead.user_id,
      })
      .eq('id', org.id);

    if (orgOwnerError) {
      console.error('Error setting organization owner:', orgOwnerError);
    }

    const { error: contactInsertError } = await supabase
      .from('organization_contacts')
      .insert({
        organization_id: org.id,
        name: payload.lead.name,
        email: payload.lead.email,
        phone: payload.lead.whatsapp_phone,
        role_title: 'fundador',
        is_primary: true,
      });

    if (contactInsertError) {
      console.error('Error creating primary organization contact:', contactInsertError);
    }

    // 2. Create Group (provider is always 'whatsapp' per DB constraint)
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: payload.group.name,
        organization_id: org.id,
        provider: 'whatsapp',
        provider_group_id: payload.group.provider_group_id,
        invite_link: payload.group.invite_link,
      })
      .select('id')
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      // Rollback: delete organization
      await supabase.from('organizations').delete().eq('id', org.id);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create group: ' + groupError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created group:', group.id);

    // 3. Create Members from participants
    if (payload.participants && payload.participants.length > 0) {
      const membersToInsert = payload.participants.map(p => ({
        group_id: group.id,
        name: p.name || p.phone,
        phone_e164: p.phone,
        is_admin: p.is_admin || false,
        provider_member_id: p.provider_member_id,
      }));

      const { error: membersError } = await supabase
        .from('members')
        .insert(membersToInsert);

      if (membersError) {
        console.error('Error creating members:', membersError);
        // Continue anyway, members are not critical
      } else {
        console.log('Created members:', membersToInsert.length);
      }
    }

    if (payload.lead.whatsapp_phone) {
      const { data: existingLead } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', group.id)
        .eq('phone_e164', payload.lead.whatsapp_phone)
        .maybeSingle();

      if (existingLead) {
        const { error: leadUpdateError } = await supabase
          .from('members')
          .update({ is_owner: true, name: payload.lead.name })
          .eq('id', existingLead.id);

        if (leadUpdateError) {
          console.error('Error setting lead as group owner:', leadUpdateError);
        }
      } else {
        const { error: leadInsertError } = await supabase
          .from('members')
          .insert({
            group_id: group.id,
            name: payload.lead.name || payload.lead.whatsapp_phone,
            phone_e164: payload.lead.whatsapp_phone,
            is_admin: false,
            is_owner: true,
            provider: 'whatsapp',
          });

        if (leadInsertError) {
          console.error('Error adding lead as group owner:', leadInsertError);
        }
      }
    }

    // 4. Update user profile with name
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: payload.lead.user_id,
        name: payload.lead.name,
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Continue anyway
    }

    // 5. Assign user role as ORG_ADMIN for this organization
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: payload.lead.user_id,
        role: 'ORG_ADMIN',
        organization_id: org.id,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // This is important, but let's continue and return success anyway
    } else {
      console.log('Assigned ORG_ADMIN role to user');
    }

    // 6. Log the onboarding event
    const { error: eventError } = await supabase
      .from('events')
      .insert({
        event_type: 'ONBOARDING_COMPLETED',
        entity_type: 'organization',
        entity_id: org.id,
        user_id: payload.lead.user_id,
        metadata: {
          organization_name: payload.organization.name,
          group_name: payload.group.name,
          participants_count: payload.participants?.length || 0,
        },
      });

    if (eventError) {
      console.error('Error logging event:', eventError);
      // Continue anyway
    }

    console.log('Onboarding provisioning completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: org.id,
        group_id: group.id,
        message: 'Onboarding completed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in provision-onboarding:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
