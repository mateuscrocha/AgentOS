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
  participantLid?: string;
  chatId?: string;
  groupProviderId?: string;
  provider?: string;
  timestamp?: string;
}

function normalizePhoneE164(phone?: string | null): string | null {
  const raw = (phone || '').trim();
  if (!raw) return null;
  const withoutSuffix = raw.replace(/@(c|g)\.us$/i, '');
  const cleaned = withoutSuffix.replace(/\s+/g, '');
  if (cleaned.startsWith('+')) {
    const plusDigits = cleaned.replace(/[^+\d]/g, '');
    return plusDigits || null;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function normalizeMemberProviderId(input?: string | null): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  const withoutSuffix = raw.replace(/@(c|g)\.us$/i, '');
  const digits = withoutSuffix.replace(/\D/g, '');
  return digits || null;
}

function normalizeLid(input?: string | null): string | null {
  const raw = (input || '').trim();
  return raw || null;
}

function normalizeGroupProviderId(input: string): string {
  return (input || '')
    .trim()
    .replace(/@(c|g)\.us$/i, '')
    .replace(/-group$/i, '');
}

function buildGroupProviderIdVariants(raw: string): string[] {
  const s = (raw || '').trim();
  const base = normalizeGroupProviderId(s);
  const out = new Set<string>();
  if (s) out.add(s);
  if (base) out.add(base);
  if (base) out.add(`${base}-group`);
  if (base) out.add(`${base}@g.us`);
  if (s && !s.endsWith('-group')) out.add(`${s}-group`);
  if (s && !s.endsWith('@g.us')) out.add(`${s}@g.us`);
  return Array.from(out);
}

function isUnknownColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const message = String(err?.message || '').toLowerCase();
  return (
    code === '42703' ||
    (message.includes('column') && message.includes('does not exist')) ||
    (message.includes('schema cache') && message.includes('column')) ||
    (message.includes('could not find') && message.includes('column'))
  );
}

function parseTimestampToIso(ts: unknown): string | null {
  if (ts == null) return null;
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    const ms = ts > 1e11 ? ts : ts * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (!trimmed) return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) {
      const ms = asNum > 1e11 ? asNum : asNum * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function mapMessageType(raw: unknown): string {
  const t = String(raw || '').toLowerCase();
  if (!t) return 'text';
  if (t.includes('sticker')) return 'sticker';
  if (t.includes('image') || t.includes('photo') || t.includes('picture')) return 'image';
  if (t.includes('video')) return 'video';
  if (t.includes('audio') || t.includes('ptt') || t.includes('voice')) return 'audio';
  if (t.includes('document') || t.includes('file')) return 'document';
  if (t.includes('poll')) return 'poll';
  if (t.includes('text') || t.includes('chat')) return 'text';
  return 'text';
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

    const coerceString = (v: unknown): string | null => {
      if (typeof v === 'string') {
        const s = v.trim();
        return s ? s : null;
      }
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      return null;
    };

    const firstString = (...candidates: unknown[]): string | null => {
      for (const c of candidates) {
        const s = coerceString(c);
        if (s) return s;
      }
      return null;
    };

    const getGroupProviderId = (): string | null => {
      return firstString(
        payload.provider_phone,
        payload.groupProviderId,
        payload.chatId,
        payload?.message?.provider_phone,
        payload?.message?.groupProviderId,
        payload?.message?.chatId,
        payload?.message?.chat?.id,
        payload?.data?.provider_phone,
        payload?.data?.groupProviderId,
        payload?.data?.chatId,
        payload?.data?.chat?.id
      );
    };

    const getGroup = async (): Promise<string | null> => {
      const providerGroupId = getGroupProviderId();
      if (!providerGroupId) return null;
      const variants = buildGroupProviderIdVariants(providerGroupId);
      let group: { id: string } | null = null;
      let err: any = null;

      ({ data: group, error: err } = await supabase
        .from('groups')
        .select('id')
        .in('provider_phone', variants)
        .limit(1)
        .maybeSingle());

      if ((!group && !err) || (err && isUnknownColumnError(err))) {
        ({ data: group, error: err } = await supabase
          .from('groups')
          .select('id')
          .in('whatsapp_provider_id', variants)
          .limit(1)
          .maybeSingle());
      }

      if (err) {
        throw err;
      }

      return group?.id || null;
    };

    const groupId = await getGroup();
    if (!groupId) {
      return new Response(
        JSON.stringify({ success: false, message: 'group not found for provider id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const touchGroupSync = async () => {
      await supabase
        .from('groups')
        .update({ last_sync_at: new Date().toISOString(), sync_status: 'active', sync_error: null })
        .eq('id', groupId);
    };

    const messageId: string | null = firstString(
      payload.messageId,
      payload.id,
      payload.message_id,
      payload?.message?.messageId,
      payload?.message?.id,
      payload?.data?.messageId,
      payload?.data?.id
    );

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
        if (pollError) {
          if ((pollError as any)?.code === '23505') {
            const { data: existingPollAfterRace } = await supabase
              .from('polls')
              .select('id')
              .eq('provider', provider)
              .eq('whatsapp_provider_id', pollPayload.messageId)
              .maybeSingle();
            pollId = existingPollAfterRace?.id || null;
          } else {
            throw pollError;
          }
        }
        if (!pollId) {
          pollId = poll?.id || null;
        }
        if (!pollId) throw new Error('poll insert failed');

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

      await touchGroupSync();

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

      const tsRaw = (votePayload.timestamp && Number(votePayload.timestamp)) || (payload.momment && Number(payload.momment));
      const createdAt = Number.isFinite(tsRaw) ? new Date(tsRaw).toISOString() : undefined;

      const voteMessageId = firstString(
        votePayload.messageId,
        payload.messageId,
        payload.id,
        payload.message_id,
        payload?.message?.messageId,
        payload?.message?.id,
        payload?.data?.messageId,
        payload?.data?.id
      );

      // Find poll by pollMessageId
      const { data: poll } = await supabase
        .from('polls')
        .select('id, max_votes_per_member')
        .eq('provider', provider)
        .eq('whatsapp_provider_id', votePayload.pollVote.pollMessageId)
        .maybeSingle();

      if (!poll) {
        return new Response(
          JSON.stringify({ success: false, message: 'poll not found for vote' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!voteMessageId) {
        await touchGroupSync();
        return new Response(
          JSON.stringify({ success: true, type: 'poll_vote', skipped: 'missing_vote_message_id' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      {
        const { data: existingVoteByMessage } = await supabase
          .from('poll_votes')
          .select('id')
          .eq('provider', provider)
          .eq('provider_vote_message_id', voteMessageId)
          .maybeSingle();
        if (existingVoteByMessage?.id) {
          await touchGroupSync();
          return new Response(
            JSON.stringify({ success: true, type: 'poll_vote', deduped: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
      const participantLid = normalizeLid(firstString(
        votePayload.participantLid,
        (payload as any)?.participantLid,
        (payload as any)?.participant_lid,
        (payload as any)?.senderLid,
        (payload as any)?.sender_lid,
        (payload as any)?.message?.participantLid,
        (payload as any)?.message?.participant_lid,
        (payload as any)?.message?.senderLid,
        (payload as any)?.message?.sender_lid
      ));
      const phone = normalizePhoneE164(votePayload.participantPhone || null);
      const participantProviderId = normalizeMemberProviderId(votePayload.participantPhone || null);
      let personId: string | null = null;
      if (participantLid) {
        const { data: existingByLid } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', groupId)
          .eq('lid', participantLid)
          .maybeSingle();
        if (existingByLid?.id) personId = existingByLid.id;
      }
      if (!personId && phone) {
        const { data: existingByPhone } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', groupId)
          .eq('phone_e164', phone)
          .maybeSingle();
        if (existingByPhone?.id) personId = existingByPhone.id;
      }
      if (!personId && (phone || participantLid)) {
          const nowIso = new Date().toISOString();
          const joinedAt = createdAt || nowIso;
          const phoneDigits = phone ? (phone.replace(/\D/g, '') || null) : null;
          const whatsappProviderId = participantProviderId || phoneDigits;
          const { data: newMember } = await supabase
            .from('members')
            .insert({
              group_id: groupId,
              phone_e164: phone,
              name: phone || participantLid,
              display_name: phone || participantLid,
              provider: 'whatsapp',
              whatsapp_provider_id: whatsappProviderId,
              lid: participantLid,
              first_seen_at: joinedAt,
              joined_at: joinedAt,
              status: 'active',
              metadata: { source: 'zapi' },
            })
            .select('id')
            .single();
          personId = newMember?.id || null;
      }

      let voteSequence: number | null = null;
      if (personId) {
        const { count } = await supabase
          .from('poll_votes')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', poll.id)
          .eq('person_id', personId);

        const maxVotes = Number.isFinite(Number((poll as any).max_votes_per_member))
          ? Number((poll as any).max_votes_per_member)
          : 2;
        const currentVotes = count ?? 0;

        if (maxVotes > 0 && currentVotes >= maxVotes) {
          await touchGroupSync();
          return new Response(
            JSON.stringify({ success: true, type: 'poll_vote', skipped: 'max_votes_per_member_reached' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        voteSequence = currentVotes + 1;
      }

      const { error: insertVoteError } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: poll.id,
          person_id: personId,
          voted_options: votedTexts,
          provider,
          provider_vote_message_id: voteMessageId,
          vote_sequence: voteSequence,
          raw_payload: payload,
          ...(createdAt ? { created_at: createdAt } : {}),
        });

      if (insertVoteError) {
        const code = (insertVoteError as any)?.code as string | undefined;
        const msg = (insertVoteError as any)?.message as string | undefined;

        if (code === '23505') {
          await touchGroupSync();
          return new Response(
            JSON.stringify({ success: true, type: 'poll_vote', deduped: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (code === 'P0001' || (msg && msg.includes('max_votes_per_member_reached'))) {
          await touchGroupSync();
          return new Response(
            JSON.stringify({ success: true, type: 'poll_vote', skipped: 'max_votes_per_member_reached' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw insertVoteError;
      }

      // Não criar mensagens para votos

      await touchGroupSync();

      return new Response(
        JSON.stringify({ success: true, type: 'poll_vote' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle standard messages (text/media)
    {
      const rawType = payload.messageType || payload.type || payload?.message?.type || payload?.message?.messageType;
      const messageType = mapMessageType(rawType);

      const providerGroupId = getGroupProviderId();

      const senderProviderIdRaw = firstString(
        payload.participantPhone ||
          payload.participant_phone ||
          payload.senderPhone ||
          payload.sender_phone ||
          payload.from ||
          payload.author ||
          payload?.message?.from ||
          payload?.message?.author ||
          null
      );
      const senderProviderId = normalizeMemberProviderId(senderProviderIdRaw);
      const senderLid = normalizeLid(firstString(
        payload.participantLid,
        payload.participant_lid,
        payload.senderLid,
        payload.sender_lid,
        payload.lid,
        payload?.message?.participantLid,
        payload?.message?.participant_lid,
        payload?.message?.senderLid,
        payload?.message?.sender_lid,
        payload?.message?.lid,
        payload?.data?.participantLid,
        payload?.data?.participant_lid,
        payload?.data?.senderLid,
        payload?.data?.sender_lid,
        payload?.data?.lid
      ));

      const senderPhone = normalizePhoneE164(
        payload.participantPhone ||
          payload.participant_phone ||
          payload.senderPhone ||
          payload.sender_phone ||
          payload.from ||
          payload.author ||
          payload?.message?.from ||
          payload?.message?.author ||
          null
      );

      const senderName: string | null =
        (payload.senderName ||
          payload.sender_name ||
          payload.pushName ||
          payload.participantName ||
          payload.participant_name ||
          payload?.message?.senderName ||
          payload?.message?.pushName ||
          null) as string | null;

      const fromMe =
        Boolean(
          payload.fromMe ??
            payload.from_me ??
            payload.isFromMe ??
            payload.is_from_me ??
            payload.self ??
            payload.owner ??
            payload?.message?.fromMe ??
            payload?.message?.from_me
        ) || false;

      const createdAtISO =
        parseTimestampToIso(
          payload.timestamp ||
            payload.messageTimestamp ||
            payload.message_ts ||
            payload?.message?.timestamp ||
            payload?.message?.t ||
            payload.momment ||
            null
        );

      const replyToWhatsappProviderId = firstString(
        payload.reply_to_whatsapp_provider_id,
        payload.replyToWhatsappProviderId,
        payload.replyToMessageId,
        payload.reply_to_message_id,
        payload.quotedMessageId,
        payload.quoted_message_id,
        payload?.message?.replyToMessageId,
        payload?.message?.reply_to_message_id,
        payload?.message?.quotedMessageId,
        payload?.message?.quoted_message_id,
        payload?.context?.replyToMessageId,
        payload?.context?.quotedMessageId,
        payload?.contextInfo?.stanzaId,
        payload?.contextInfo?.quotedMessageId,
        payload?.message?.contextInfo?.stanzaId,
        payload?.message?.contextInfo?.quotedMessageId
      );

      const referenceMessageId = firstString(
        payload.reference_message_id,
        payload.referenceMessageId,
        payload.reference_message,
        payload?.message?.reference_message_id,
        payload?.message?.referenceMessageId
      );

      const textCandidate =
        payload.text?.message ||
        payload.text?.text ||
        payload.text ||
        payload.body ||
        payload.message ||
        payload.content ||
        payload?.message?.text ||
        payload?.message?.body ||
        payload?.message?.content ||
        payload.caption ||
        payload?.message?.caption ||
        null;

      const text = typeof textCandidate === 'string' ? textCandidate : textCandidate != null ? String(textCandidate) : null;
      const trimmedText = text ? text.trim() : null;

      const mediaUrl: string | null =
        (payload.mediaUrl ||
          payload.media_url ||
          payload.fileUrl ||
          payload.file_url ||
          payload?.message?.mediaUrl ||
          payload?.message?.media_url ||
          payload?.media?.url ||
          payload?.file?.url ||
          payload?.image?.url ||
          payload?.video?.url ||
          payload?.audio?.url ||
          payload?.document?.url ||
          null) as string | null;

      const thumbnailUrl: string | null =
        (payload.thumbnailUrl ||
          payload.thumbnail_url ||
          payload?.message?.thumbnailUrl ||
          payload?.message?.thumbnail_url ||
          payload?.media?.thumbnail ||
          payload?.image?.thumbnail ||
          payload?.video?.thumbnail ||
          null) as string | null;

      const mediaMimeType: string | null =
        (payload.mimeType ||
          payload.mimetype ||
          payload.mediaMimeType ||
          payload.media_mime_type ||
          payload?.message?.mimeType ||
          payload?.message?.mimetype ||
          payload?.media?.mimeType ||
          payload?.file?.mimeType ||
          null) as string | null;

      const mediaCaption: string | null =
        (payload.mediaCaption ||
          payload.media_caption ||
          payload.caption ||
          payload?.message?.caption ||
          null) as string | null;

      const looksLikeMessage =
        !!messageId ||
        !!trimmedText ||
        !!mediaUrl ||
        ['text', 'image', 'video', 'audio', 'document', 'sticker'].includes(messageType);

      if (looksLikeMessage && messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('provider', provider)
          .eq('whatsapp_provider_id', messageId)
          .maybeSingle();

        if (!existingMsg) {
          const direction = fromMe ? 'outbound' : 'inbound';

          let memberId: string | null = null;
          if (senderLid) {
            const { data: existingByLid } = await supabase
              .from('members')
              .select('id')
              .eq('group_id', groupId)
              .eq('lid', senderLid)
              .maybeSingle();
            if (existingByLid?.id) {
              memberId = existingByLid.id;
            }
          }
          if (!memberId && senderPhone) {
            const { data: existingByPhone } = await supabase
              .from('members')
              .select('id')
              .eq('group_id', groupId)
              .eq('phone_e164', senderPhone)
              .maybeSingle();
            if (existingByPhone?.id) {
              memberId = existingByPhone.id;
            }
          }
          if (!memberId && !fromMe && (senderPhone || senderLid)) {
              const nowIso = new Date().toISOString();
              const joinedAt = createdAtISO || nowIso;
              const phoneDigits = senderPhone ? (senderPhone.replace(/\D/g, '') || null) : null;
              const whatsappProviderId = senderProviderId || phoneDigits;
              const memberName = senderName || senderPhone || senderLid;
              const { data: createdMember } = await supabase
                .from('members')
                .insert({
                  group_id: groupId,
                  phone_e164: senderPhone,
                  name: memberName,
                  display_name: memberName,
                  provider: 'whatsapp',
                  whatsapp_provider_id: whatsappProviderId,
                  lid: senderLid,
                  first_seen_at: joinedAt,
                  joined_at: joinedAt,
                  status: 'active',
                  metadata: { source: 'zapi_webhook' },
                })
                .select('id')
                .single();
              memberId = createdMember?.id || null;
          }

          const insertPayload: Record<string, unknown> = {
            group_id: groupId,
            message_type: messageType,
            provider,
            whatsapp_provider_id: messageId,
            chat_whatsapp_provider_id: providerGroupId,
            from_me: fromMe,
            direction,
            member_id: memberId,
            sender_phone: senderPhone,
            sender_name: senderName,
            content: trimmedText,
            text: trimmedText,
            media_url: mediaUrl,
            media_caption: mediaCaption,
            media_mime_type: mediaMimeType,
            thumbnail_url: thumbnailUrl,
            raw_provider: payload,
            metadata: { source: 'zapi_webhook', raw_type: rawType || null },
          };

          if (replyToWhatsappProviderId) {
            insertPayload.reply_to_whatsapp_provider_id = replyToWhatsappProviderId;
          }
          if (referenceMessageId) {
            insertPayload.reference_message_id = referenceMessageId;
          }

          if (createdAtISO) {
            insertPayload.created_at = createdAtISO;
            insertPayload.message_ts = createdAtISO;
          }

          await supabase.from('messages').insert(insertPayload);
        }

        await touchGroupSync();

        return new Response(
          JSON.stringify({ success: true, type: 'message' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
