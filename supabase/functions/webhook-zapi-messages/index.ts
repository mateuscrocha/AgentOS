import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZapiPollOption { name: string; }
interface ZapiPollPayload {
  messageId: string;
  poll: {
    question: string;
    pollMaxOptions?: number;
    options: ZapiPollOption[];
  };
  chatId?: string;
  groupProviderId?: string;
  provider?: string;
  timestamp?: string;
}

interface ZapiPollVotePayload {
  messageId: string;
  pollVote: {
    pollMessageId: string;
    options: ZapiPollOption[];
  };
  participantPhone?: string;
  chatId?: string;
  groupProviderId?: string;
  provider?: string;
  timestamp?: string;
}

function normalizePhoneE164(phone?: string | null): string | null {
  const raw = (phone || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    return raw.replace(/\s+/g, '');
  }
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json();
    const provider = payload.provider || 'zapi';

    const getGroupProviderId = (): string | null => {
      return payload.groupProviderId || payload.chatId || null;
    };

    const getGroup = async (): Promise<string | null> => {
      const providerGroupId = getGroupProviderId();
      if (!providerGroupId) return null;
      const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('provider_group_id', providerGroupId)
        .maybeSingle();
      return group?.id || null;
    };

    const groupId = await getGroup();
    if (!groupId) {
      return new Response(
        JSON.stringify({ success: false, message: 'group not found for provider id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageId: string | undefined = payload.messageId;

    // Handle POLL
    if (payload.poll) {
      const pollPayload = payload as ZapiPollPayload;
      const question = pollPayload.poll.question || '[Enquete]';
      const maxOptions = pollPayload.poll.pollMaxOptions || null;
      const options = Array.isArray(pollPayload.poll.options) ? pollPayload.poll.options : [];

      // Dedup poll
      const { data: existingPoll } = await supabase
        .from('polls')
        .select('id')
        .eq('provider', provider)
        .eq('provider_poll_message_id', pollPayload.messageId)
        .maybeSingle();

      let pollId = existingPoll?.id || null;

      if (!pollId) {
        const { data: poll, error: pollError } = await supabase
          .from('polls')
          .insert({
            group_id: groupId,
            provider,
            provider_poll_message_id: pollPayload.messageId,
            question,
            max_options: maxOptions,
          })
          .select('id')
          .single();
        if (pollError) throw pollError;
        pollId = poll.id;

        if (options.length > 0) {
          const records = options.map((opt, idx) => ({
            poll_id: pollId!,
            option_text: opt.name,
            option_index: idx,
          }));
          await supabase.from('poll_options').insert(records);
        }
      }

      // Upsert message of type poll
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('provider_message_id', messageId)
          .maybeSingle();
        if (!existingMsg) {
          await supabase.from('messages').insert({
            group_id: groupId,
            message_type: 'poll',
            provider: provider,
            provider_message_id: messageId,
            text: question,
            raw_provider: payload,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, type: 'poll', poll_id: pollId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POLL_VOTE
    if (payload.pollVote) {
      const votePayload = payload as ZapiPollVotePayload;
      const voteOpts = Array.isArray(votePayload.pollVote.options) ? votePayload.pollVote.options : [];
      const votedTexts = voteOpts.map(o => o.name).filter(Boolean);

      // Find poll by pollMessageId
      const { data: poll } = await supabase
        .from('polls')
        .select('id')
        .eq('provider', provider)
        .eq('provider_poll_message_id', votePayload.pollVote.pollMessageId)
        .maybeSingle();

      if (!poll) {
        return new Response(
          JSON.stringify({ success: false, message: 'poll not found for vote' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure member exists
      const phone = normalizePhoneE164(votePayload.participantPhone || null);
      let memberId: string | null = null;
      if (phone) {
        const { data: existingMember } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', groupId)
          .eq('phone_e164', phone)
          .maybeSingle();
        if (existingMember) {
          memberId = existingMember.id;
        } else {
          const { data: newMember } = await supabase
            .from('members')
            .insert({ group_id: groupId, phone_e164: phone, name: phone, provider: 'whatsapp' })
            .select('id')
            .single();
          memberId = newMember?.id || null;
        }
      }

      // Dedup vote
      const { data: existingVote } = await supabase
        .from('poll_votes')
        .select('id')
        .eq('provider', provider)
        .eq('provider_vote_message_id', votePayload.messageId)
        .maybeSingle();

      if (!existingVote) {
        await supabase
          .from('poll_votes')
          .insert({
            poll_id: poll.id,
            member_id: memberId,
            voted_options: votedTexts,
            provider,
            provider_vote_message_id: votePayload.messageId,
          });
      }

      // Upsert message of type poll_vote
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('provider_message_id', messageId)
          .maybeSingle();
        if (!existingMsg) {
          await supabase.from('messages').insert({
            group_id: groupId,
            member_id: memberId,
            message_type: 'poll_vote',
            provider: provider,
            provider_message_id: messageId,
            text: votedTexts.length ? `Voto: ${votedTexts.join(', ')}` : 'Voto em enquete',
            raw_provider: payload,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, type: 'poll_vote' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: ignore
    return new Response(
      JSON.stringify({ success: false, message: 'unsupported payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('webhook-zapi-messages error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
