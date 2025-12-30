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
        .eq('whatsapp_provider_id', providerGroupId)
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
        .eq('whatsapp_provider_id', pollPayload.messageId)
        .maybeSingle();

      let pollId = existingPoll?.id || null;

      if (!pollId) {
        const { data: poll, error: pollError } = await supabase
          .from('polls')
          .insert({
            group_id: groupId,
            provider,
            whatsapp_provider_id: pollPayload.messageId,
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

      // Insert message of type poll
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('provider', provider)
          .eq('whatsapp_provider_id', messageId)
          .maybeSingle();
        if (!existingMsg) {
          await supabase.from('messages').insert({
            group_id: groupId,
            message_type: 'poll',
            provider: provider,
            whatsapp_provider_id: messageId,
            content: question,
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
        .eq('whatsapp_provider_id', votePayload.pollVote.pollMessageId)
        .maybeSingle();

      if (!poll) {
        return new Response(
          JSON.stringify({ success: false, message: 'poll not found for vote' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure poll options exist for all voted texts
      if (votedTexts.length > 0) {
        const { data: existingOptions } = await supabase
          .from('poll_options')
          .select('option_text, option_index')
          .eq('poll_id', poll.id);
        const existingTexts = new Set((existingOptions || []).map((o: any) => o.option_text));
        const missing = votedTexts.filter((t) => !existingTexts.has(t));
        if (missing.length > 0) {
          const nextIndexStart = (existingOptions || []).length;
          const records = missing.map((name, idx) => ({
            poll_id: poll.id,
            option_text: name,
            option_index: nextIndexStart + idx,
          }));
          await supabase.from('poll_options').insert(records);
        }
      }

      // Ensure person exists (group_member)
      const phone = normalizePhoneE164(votePayload.participantPhone || null);
      let personId: string | null = null;
      if (phone) {
        const { data: existingMember } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', groupId)
          .eq('phone', phone)
          .maybeSingle();
        if (existingMember) {
          personId = existingMember.id;
        } else {
          const { data: newMember } = await supabase
            .from('members')
            .insert({ group_id: groupId, phone: phone, name: phone, source: 'zapi' })
            .select('id')
            .single();
          personId = newMember?.id || null;
        }
      }

      // Upsert snapshot de voto por (poll_id, person_id). Fallback para provider_vote_message_id.
      let existingVoteId: string | null = null;
      if (personId) {
        const { data: existingByPerson } = await supabase
          .from('poll_votes')
          .select('id')
          .eq('poll_id', poll.id)
          .eq('person_id', personId)
          .maybeSingle();
        existingVoteId = existingByPerson?.id || null;
      }
      // Provider vote message id not tracked; rely on person_id for dedup

      const tsRaw = (votePayload.timestamp && Number(votePayload.timestamp)) || (payload.momment && Number(payload.momment));
      const createdAt = Number.isFinite(tsRaw) ? new Date(tsRaw).toISOString() : undefined;
      if (!existingVoteId) {
        await supabase
          .from('poll_votes')
          .insert({
            poll_id: poll.id,
            person_id: personId,
            voted_options: votedTexts,
            provider,
            raw_payload: payload,
            ...(createdAt ? { created_at: createdAt } : {}),
          });
      } else {
        await supabase
          .from('poll_votes')
          .update({
            poll_id: poll.id,
            person_id: personId,
            voted_options: votedTexts,
            raw_payload: payload,
            ...(createdAt ? { created_at: createdAt } : {}),
          })
          .eq('id', existingVoteId);
      }

      // Não criar mensagens para votos

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
