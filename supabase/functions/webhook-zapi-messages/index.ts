/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendZapiText } from "../_shared/zapi-send-text.ts";

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

type MemberEventType =
  | 'MEMBERSHIP_APPROVAL_REQUEST'
  | 'REVOKED_MEMBERSHIP_REQUESTS'
  | 'GROUP_PARTICIPANT_ADD'
  | 'GROUP_PARTICIPANT_INVITE'
  | 'GROUP_PARTICIPANT_LEAVE'
  | 'GROUP_PARTICIPANT_REMOVE';

const MEMBER_EVENT_TYPES = new Set<MemberEventType>([
  'MEMBERSHIP_APPROVAL_REQUEST',
  'REVOKED_MEMBERSHIP_REQUESTS',
  'GROUP_PARTICIPANT_ADD',
  'GROUP_PARTICIPANT_INVITE',
  'GROUP_PARTICIPANT_LEAVE',
  'GROUP_PARTICIPANT_REMOVE',
]);

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

function normalizePollMaxVotesPerMember(maxOptions: unknown, fallback = 2): number {
  if (typeof maxOptions === 'string' && !maxOptions.trim()) return fallback;
  const parsed = Number(maxOptions);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
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

function normalizeEventKey(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/__+/g, '_')
    .toUpperCase();
}

function normalizeMemberEventType(raw: unknown): MemberEventType | null {
  const key = normalizeEventKey(raw);
  if (!key) return null;

  const aliasMap: Record<string, MemberEventType> = {
    GROUP_PARTICIPANT_JOIN: 'GROUP_PARTICIPANT_ADD',
    GROUP_PARTICIPANT_JOINED: 'GROUP_PARTICIPANT_ADD',
    GROUP_PARTICIPANT_ENTER: 'GROUP_PARTICIPANT_ADD',
    GROUP_PARTICIPANT_ENTERED: 'GROUP_PARTICIPANT_ADD',
    GROUP_PARTICIPANT_ADDED: 'GROUP_PARTICIPANT_ADD',
    GROUP_PARTICIPANT_INVITED: 'GROUP_PARTICIPANT_INVITE',
    GROUP_PARTICIPANT_EXIT: 'GROUP_PARTICIPANT_LEAVE',
    GROUP_PARTICIPANT_EXITED: 'GROUP_PARTICIPANT_LEAVE',
    GROUP_PARTICIPANT_LEFT: 'GROUP_PARTICIPANT_LEAVE',
    GROUP_PARTICIPANT_DEPARTURE: 'GROUP_PARTICIPANT_LEAVE',
    GROUP_PARTICIPANT_KICK: 'GROUP_PARTICIPANT_REMOVE',
    GROUP_PARTICIPANT_KICKED: 'GROUP_PARTICIPANT_REMOVE',
    GROUP_PARTICIPANT_DELETED: 'GROUP_PARTICIPANT_REMOVE',
    MEMBERSHIP_REQUEST_APPROVAL: 'MEMBERSHIP_APPROVAL_REQUEST',
    REVOKED_MEMBERSHIP_REQUEST: 'REVOKED_MEMBERSHIP_REQUESTS',
  };

  const mapped = aliasMap[key] || key;
  return MEMBER_EVENT_TYPES.has(mapped as MemberEventType)
    ? (mapped as MemberEventType)
    : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function sanitizeForMessageContent(value: string | null): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function stringifyJsonSafe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const normalizedA = [...normalizeStringArray(a)].sort();
  const normalizedB = [...normalizeStringArray(b)].sort();
  return normalizedA.every((value, index) => value === normalizedB[index]);
}

function isLikelyGroupPayload(input: Record<string, unknown>, payload: Record<string, unknown>, providerGroupId: string | null): boolean {
  const explicitIsGroup = input.isGroup ?? input.is_group ?? payload.isGroup ?? payload.is_group;
  if (typeof explicitIsGroup === "boolean") return explicitIsGroup;
  const raw = String(providerGroupId || "").trim().toLowerCase();
  return raw.endsWith("@g.us") || raw.endsWith("-group");
}

export function createWebhookZapiMessagesHandler(deps?: {
  env?: Pick<typeof Deno.env, 'get'>;
  createClientImpl?: typeof createClient;
  fetchImpl?: typeof fetch;
}) {
  const env = deps?.env ?? Deno.env;
  const createClientImpl = deps?.createClientImpl ?? createClient;
  const fetchImpl = deps?.fetchImpl ?? fetch;

    const buildWelcomeMessage = (args: { groupName: string | null; memberName: string | null }) => {
    const memberName = String(args.memberName || "").trim();
    const groupName = String(args.groupName || "").trim();
    if (memberName) {
      return `Boas-vindas, ${memberName}! Que bom ter voce aqui${groupName ? ` no grupo *${groupName}*` : ""}.`;
    }
      return `Boas-vindas! Que bom ter voce aqui${groupName ? ` no grupo *${groupName}*` : ""}.`;
    };

  const buildMateusAlertMessage = (args: {
    provider: string;
    providerGroupId: string | null;
    messageId: string | null;
    notificationType: string | null;
    payload: unknown;
  }) => {
    const serializedPayload = stringifyJsonSafe(args.payload);
    const payloadPreview = serializedPayload.length > 1200
      ? `${serializedPayload.slice(0, 1200)}...`
      : serializedPayload;
    return [
      "Webhook recebido fora de grupo no Main Listener migrado.",
      `provider: ${args.provider}`,
      `origem: ${args.providerGroupId || "-"}`,
      `message_id: ${args.messageId || "-"}`,
      `tipo: ${args.notificationType || "-"}`,
      "",
      payloadPreview,
    ].join("\n");
  };

  const persistWelcomeAttempt = async (args: {
    supabase: any;
    groupId: string;
    groupProviderPhone: string;
    message: string;
    providerResponse?: unknown;
    errorMessage?: string | null;
    eventType: 'member_event' | 'first_message_fallback';
    memberId?: string | null;
  }) => {
    const metadata: Record<string, unknown> = {
      source: 'welcome_automation',
      event_type: args.eventType,
    };

    if (args.providerResponse !== undefined) {
      metadata.zapi_response = args.providerResponse;
    }
    if (args.errorMessage) {
      metadata.error = args.errorMessage;
    }

    await args.supabase.from('messages').insert({
      group_id: args.groupId,
      member_id: args.memberId || null,
      message_type: 'text',
      provider: 'whatsapp',
      from_me: true,
      direction: 'outbound',
      status: args.errorMessage ? 'FAILED' : 'SENT',
      chat_whatsapp_provider_id: args.groupProviderPhone,
      content: sanitizeForMessageContent(args.message),
      text: sanitizeForMessageContent(args.message),
      metadata,
    });
  };

  return async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: any = null;
  let syncedGroupId: string | null = null;

  try {
    const supabaseUrl = env.get('SUPABASE_URL')!;
    const serviceKey = env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClientImpl(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = await req.json();
    const bodyPayload = asObject(payload.body);
    const input: any = bodyPayload ?? payload;
    const provider = input.provider || payload.provider || 'zapi';

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
        input.provider_phone,
        input.groupProviderId,
        input.chatId,
        input.phone,
        input?.chat?.id,
        input?.message?.provider_phone,
        input?.message?.groupProviderId,
        input?.message?.chatId,
        input?.message?.chat?.id,
        input?.data?.provider_phone,
        input?.data?.groupProviderId,
        input?.data?.chatId,
        input?.data?.chat?.id
      );
    };

    const getGroup = async (): Promise<{ id: string; name?: string | null; provider_phone?: string | null } | null> => {
      const providerGroupId = getGroupProviderId();
      if (!providerGroupId) return null;
      const variants = buildGroupProviderIdVariants(providerGroupId);
      let group: { id: string; name?: string | null; provider_phone?: string | null } | null = null;
      let err: any = null;

      ({ data: group, error: err } = await supabase
        .from('groups')
        .select('id,name,provider_phone')
        .in('provider_phone', variants)
        .limit(1)
        .maybeSingle());

      if ((!group && !err) || (err && isUnknownColumnError(err))) {
          ({ data: group, error: err } = await supabase
          .from('groups')
          .select('id,name,provider_phone')
          .in('whatsapp_provider_id', variants)
          .limit(1)
          .maybeSingle());
      }

      if (err) {
        throw err;
      }

      return group || null;
    };

    const providerGroupId = getGroupProviderId();
    const notificationType = firstString(
      input.notification,
      input.event_type,
      input.eventType,
      input.webhookEvent,
      input.webhook_event,
      input.subscriptionType,
      input.subscription_type,
      input.type,
      input?.message?.type,
      input?.data?.event_type,
      input?.data?.eventType,
      input?.data?.type
    );
    const messageId: string | null = firstString(
      input.messageId,
      input.id,
      input.message_id,
      input?.message?.messageId,
      input?.message?.id,
      input?.data?.messageId,
      input?.data?.id
    );

    const group = await getGroup();
    const groupId = group?.id || null;
    syncedGroupId = groupId;
    if (!groupId) {
      const notGroupPayload = !isLikelyGroupPayload(input, payload, providerGroupId);
      const mateusPhone = normalizeMemberProviderId(env.get("MATEUS_PHONE_E164") || env.get("MATEUS_PHONE") || null);

      if (notGroupPayload && mateusPhone) {
        try {
          const alertMessage = buildMateusAlertMessage({
            provider,
            providerGroupId,
            messageId,
            notificationType,
            payload,
          });
          const providerResponse = await sendZapiText({
            env,
            phone: mateusPhone,
            message: alertMessage,
            fetchImpl,
          });

          return new Response(
            JSON.stringify({
              success: true,
              notifiedMateus: true,
              reason: 'non_group_payload',
              providerResponse,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (notifyError) {
          console.error('webhook-zapi-messages failed to notify Mateus for non-group payload', notifyError);
          const notifyMessage = notifyError instanceof Error ? notifyError.message : 'Unknown notify Mateus error';
          return new Response(
            JSON.stringify({
              success: true,
              notifiedMateus: false,
              reason: 'non_group_payload',
              error: notifyMessage,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          ignored: true,
          reason: notGroupPayload ? 'non_group_without_mateus_destination' : 'group_not_found',
          message: 'group not found for provider id',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const touchGroupSync = async () => {
      await supabase
        .from('groups')
        .update({ last_sync_at: new Date().toISOString(), sync_status: 'active', sync_error: null })
        .eq('id', groupId);
    };

    const resolveMember = async (args: {
      phone?: string | null;
      providerMemberId?: string | null;
      lid?: string | null;
      name?: string | null;
      photoUrl?: string | null;
      isAdmin?: boolean | null;
      isSuperAdmin?: boolean | null;
      createdAt?: string | null;
      allowCreate?: boolean;
      metadataSource: string;
    }) => {
      const phone = normalizePhoneE164(args.phone || null);
      const providerMemberId = normalizeMemberProviderId(args.providerMemberId || null);
      const lid = normalizeLid(args.lid || null);
      const displayName = firstString(args.name);
      const photoUrl = firstString(args.photoUrl);
      const isAdmin = typeof args.isAdmin === 'boolean' ? args.isAdmin : null;
      const isSuperAdmin = typeof args.isSuperAdmin === 'boolean' ? args.isSuperAdmin : null;

      let member: { id: string; metadata?: unknown } | null = null;

      if (lid) {
        const { data } = await supabase
          .from('members')
          .select('id,metadata')
          .eq('group_id', groupId)
          .eq('lid', lid)
          .maybeSingle();
        member = data || null;
      }

      if (!member && phone) {
        const { data } = await supabase
          .from('members')
          .select('id,metadata')
          .eq('group_id', groupId)
          .eq('phone_e164', phone)
          .maybeSingle();
        member = data || null;
      }

      if (!member && providerMemberId) {
        const { data } = await supabase
          .from('members')
          .select('id,metadata')
          .eq('group_id', groupId)
          .eq('whatsapp_provider_id', providerMemberId)
          .maybeSingle();
        member = data || null;
      }

      if (!member && args.allowCreate && (phone || lid || providerMemberId)) {
        const nowIso = new Date().toISOString();
        const joinedAt = args.createdAt || nowIso;
        const memberName = displayName || phone || lid || providerMemberId || "Membro";
        const { data: createdMember } = await supabase
          .from('members')
          .insert({
            group_id: groupId,
            phone_e164: phone,
            name: memberName,
            display_name: memberName,
            provider: 'whatsapp',
            whatsapp_provider_id: providerMemberId,
            lid,
            profile_pic_url: photoUrl,
            is_admin: isAdmin ?? false,
            is_super_admin: isSuperAdmin ?? false,
            first_seen_at: joinedAt,
            joined_at: joinedAt,
            status: 'active',
            metadata: { source: args.metadataSource },
          })
          .select('id,metadata')
          .single();
        member = createdMember || null;
      }

      if (member?.id) {
        const patch: Record<string, unknown> = {};
        if (displayName) {
          patch.name = displayName;
          patch.display_name = displayName;
        }
        if (photoUrl) patch.profile_pic_url = photoUrl;
        if (phone) patch.phone_e164 = phone;
        if (providerMemberId) patch.whatsapp_provider_id = providerMemberId;
        if (lid) patch.lid = lid;
        if (isAdmin !== null) patch.is_admin = isAdmin;
        if (isSuperAdmin !== null) patch.is_super_admin = isSuperAdmin;

        if (Object.keys(patch).length > 0) {
          await supabase
            .from('members')
            .update(patch)
            .eq('id', member.id);
        }

        const metadata = asPlainObject(member.metadata);
        return {
          id: member.id,
          metadata,
          phone,
          lid,
          providerMemberId,
        };
      }

      return {
        id: null,
        metadata: {},
        phone,
        lid,
        providerMemberId,
      };
    };

    const reactionEmoji = firstString(
      input.reaction?.emoji,
      input.reaction?.text,
      input.reaction?.value,
      input.reactionText,
      input.reaction_text,
      input.emoji,
      input.reaction,
      input?.message?.reaction?.emoji,
      input?.message?.reaction?.text,
      input?.message?.reactionText,
      input?.data?.reaction?.emoji,
      input?.data?.reaction?.text,
    );
    const reactionTargetMessageId = firstString(
      input.reaction?.messageId,
      input.reaction?.message_id,
      input.reaction?.referencedMessage?.messageId,
      input.reaction?.referencedMessage?.message_id,
      input.reaction?.referenced_message?.messageId,
      input.reaction?.referenced_message?.message_id,
      input.reactionToMessageId,
      input.reaction_to_message_id,
      input.referencedMessageId,
      input.referenced_message_id,
      input?.message?.reaction?.messageId,
      input?.message?.reaction?.message_id,
      input?.message?.reaction?.referencedMessage?.messageId,
      input?.message?.reaction?.referencedMessage?.message_id,
      input?.data?.reaction?.messageId,
      input?.data?.reaction?.message_id,
      input?.data?.reaction?.referencedMessage?.messageId,
      input?.data?.reaction?.referencedMessage?.message_id,
      input?.contextInfo?.stanzaId,
      input?.message?.contextInfo?.stanzaId,
    );
    const reactionRemoved =
      Boolean(
        input.reactionRemoved ??
        input.reaction_removed ??
        input.removed ??
        input.isRemoved ??
        input.is_removed ??
        input.reaction?.removed ??
        input.reaction?.isRemoved ??
        input?.message?.reaction?.removed ??
        input?.data?.reaction?.removed
      ) || !reactionEmoji;
    const looksLikeReaction =
      normalizeEventKey(
        input.notification ||
        input.event_type ||
        input.eventType ||
        input.webhookEvent ||
        input.webhook_event ||
        input.subscriptionType ||
        input.subscription_type ||
        input.type ||
        input?.message?.type ||
        input?.data?.event_type ||
        input?.data?.eventType ||
        input?.data?.type
      ).includes('REACTION') ||
      !!reactionTargetMessageId ||
      !!input.reaction?.referencedMessage ||
      !!input?.message?.reaction?.referencedMessage ||
      !!input?.data?.reaction?.referencedMessage;

    if (looksLikeReaction && reactionTargetMessageId) {
      const reactedAt = parseTimestampToIso(
        input.timestamp ||
        input.messageTimestamp ||
        input.message_ts ||
        input?.message?.timestamp ||
        input?.message?.t ||
        input.momment ||
        null
      ) || new Date().toISOString();

      const senderProviderIdRaw = firstString(
        input.participantPhone,
        input.participant_phone,
        input.senderPhone,
        input.sender_phone,
        input.from,
        input.author,
        input?.message?.from,
        input?.message?.author,
        input?.data?.participantPhone,
        input?.data?.participant_phone,
      );
      const senderName = firstString(
        input.senderName,
        input.sender_name,
        input.pushName,
        input.participantName,
        input.participant_name,
        input?.message?.senderName,
        input?.message?.pushName,
        input?.data?.senderName,
      );
      const senderLid = normalizeLid(firstString(
        input.participantLid,
        input.participant_lid,
        input.senderLid,
        input.sender_lid,
        input.lid,
        input?.message?.participantLid,
        input?.message?.participant_lid,
        input?.message?.senderLid,
        input?.message?.sender_lid,
        input?.data?.participantLid,
      ));

      const { data: targetMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('provider', provider)
        .eq('whatsapp_provider_id', reactionTargetMessageId)
        .maybeSingle();

      if (!targetMessage?.id) {
        await touchGroupSync();
        return new Response(
          JSON.stringify({ success: true, type: 'reaction', skipped: 'target_message_not_found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const member = await resolveMember({
        phone: senderProviderIdRaw,
        providerMemberId: senderProviderIdRaw,
        lid: senderLid,
        name: senderName,
        createdAt: reactedAt,
        allowCreate: true,
        metadataSource: 'zapi_reaction',
      });

      if (reactionRemoved) {
        let removeBuilder = supabase
          .from('message_reactions')
          .update({
            removed_at: reactedAt,
            status: 'removed',
            raw_provider: payload,
          })
          .eq('group_id', groupId)
          .eq('message_id', targetMessage.id)
          .is('removed_at', null);

        if (member.id) {
          removeBuilder = removeBuilder.eq('member_id', member.id);
        } else if (reactionEmoji) {
          removeBuilder = removeBuilder.eq('emoji', reactionEmoji);
        }

        await removeBuilder;
        await touchGroupSync();

        return new Response(
          JSON.stringify({ success: true, type: 'reaction', removed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmoji = reactionEmoji!;
      let existingReactionQuery = supabase
        .from('message_reactions')
        .select('id')
        .eq('group_id', groupId)
        .eq('message_id', targetMessage.id)
        .eq('emoji', normalizedEmoji)
        .is('removed_at', null);

      if (member.id) {
        existingReactionQuery = existingReactionQuery.eq('member_id', member.id);
      }

      const { data: existingReaction } = await existingReactionQuery.maybeSingle();
      if (!existingReaction?.id) {
        const { error: insertReactionError } = await supabase
          .from('message_reactions')
          .insert({
            group_id: groupId,
            message_id: targetMessage.id,
            member_id: member.id,
            emoji: normalizedEmoji,
            reacted_at: reactedAt,
            provider,
            whatsapp_provider_id: reactionTargetMessageId,
            provider_reaction_key: messageId,
            raw_provider: payload,
            metadata: { source: 'zapi_webhook' },
          });

        if (insertReactionError) throw insertReactionError;
      }

      await touchGroupSync();

      return new Response(
        JSON.stringify({ success: true, type: 'reaction', deduped: !!existingReaction?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POLL
    if (input.poll) {
      const pollPayload = input as ZapiPollPayload;
      const question = pollPayload.poll.question || '[Enquete]';
      const maxOptionsRaw = pollPayload.poll.pollMaxOptions;
      const maxOptions = Number.isFinite(Number(maxOptionsRaw)) ? Number(maxOptionsRaw) : null;
      const maxVotesPerMember = normalizePollMaxVotesPerMember(maxOptionsRaw);
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
            max_votes_per_member: maxVotesPerMember,
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
    if (input.pollVote) {
      const votePayload = input as ZapiPollVotePayload;
      const voteOpts = Array.isArray(votePayload.pollVote.options) ? votePayload.pollVote.options : [];
      const votedTexts = normalizeStringArray(voteOpts.map((o) => o.name));

      const tsRaw = (votePayload.timestamp && Number(votePayload.timestamp)) || (input.momment && Number(input.momment));
      const createdAt = Number.isFinite(tsRaw) ? new Date(tsRaw).toISOString() : undefined;

      const voteMessageId = firstString(
        votePayload.messageId,
        input.messageId,
        input.id,
        input.message_id,
        input?.message?.messageId,
        input?.message?.id,
        input?.data?.messageId,
        input?.data?.id
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
        input?.participantLid,
        input?.participant_lid,
        input?.senderLid,
        input?.sender_lid,
        input?.message?.participantLid,
        input?.message?.participant_lid,
        input?.message?.senderLid,
        input?.message?.sender_lid
      ));
      const member = await resolveMember({
        phone: votePayload.participantPhone || null,
        providerMemberId: votePayload.participantPhone || null,
        lid: participantLid,
        name: votePayload.participantPhone || participantLid,
        photoUrl: firstString(
          input.photoUrl,
          input.photo_url,
          input.profilePicUrl,
          input.profile_pic_url,
          input?.participant?.photoUrl,
          input?.participant?.photo_url,
          input?.data?.photoUrl,
          input?.data?.photo_url
        ),
        isAdmin: typeof (input.isAdmin ?? input.is_admin) === 'boolean' ? Boolean(input.isAdmin ?? input.is_admin) : null,
        isSuperAdmin: typeof (input.isSuperAdmin ?? input.is_super_admin) === 'boolean' ? Boolean(input.isSuperAdmin ?? input.is_super_admin) : null,
        createdAt,
        allowCreate: true,
        metadataSource: 'zapi_poll_vote',
      });
      const personId = member.id;

      let voteSequence: number | null = null;
      if (personId) {
        const { data: existingVotes } = await supabase
          .from('poll_votes')
          .select('id,voted_options,vote_sequence')
          .eq('poll_id', poll.id)
          .eq('person_id', personId);

        const currentVotes = Array.isArray(existingVotes) ? existingVotes : [];
        const latestVote = currentVotes.reduce((latest: any, candidate: any) => {
          if (!latest) return candidate;
          return Number(candidate?.vote_sequence ?? 0) > Number(latest?.vote_sequence ?? 0) ? candidate : latest;
        }, null);

        if (latestVote && sameStringArray(asArray(latestVote.voted_options).map(String), votedTexts)) {
          await touchGroupSync();
          return new Response(
            JSON.stringify({ success: true, type: 'poll_vote', deduped: true, reason: 'same_vote_state' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const maxPreviousSequence = currentVotes.reduce(
          (max: number, row: any) => Math.max(max, Number(row?.vote_sequence ?? 0)),
          0,
        );
        voteSequence = maxPreviousSequence + 1;

        if (currentVotes.length > 0) {
          await supabase
            .from('poll_votes')
            .delete()
            .eq('poll_id', poll.id)
            .eq('person_id', personId);
        }
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

    const memberEventType = normalizeMemberEventType(
      input.notification ||
      input.event_type ||
      input.eventType ||
      input.webhookEvent ||
      input.webhook_event ||
      input.subscriptionType ||
      input.subscription_type ||
      input.type ||
      input?.message?.type ||
      input?.data?.event_type ||
      input?.data?.eventType ||
      input?.data?.type
    );

    if (memberEventType) {
      const participantSources = [
        ...asArray(input.participants),
        ...asArray(input.members),
        ...asArray(input.users),
        ...asArray(input.data?.participants),
        ...asArray(input.data?.members),
        ...asArray(input.message?.participants),
        ...asArray(input.message?.members),
      ];

      const participantObjects = participantSources
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => !!entry);

      const topLevelParticipant = {
        participantPhone:
          input.memberPhone ??
          input.member_phone ??
          input.userPhone ??
          input.user_phone ??
          (Array.isArray(input.notificationParameters) && input.notificationParameters.length > 0
            ? null
            : (input.participantPhone ?? input.participant_phone ?? null)),
        participantLid: input.notificationParameters?.[0] ?? input.participantLid ?? input.participant_lid ?? input.lid ?? input.memberLid ?? input.member_lid,
        participantName: input.participantName ?? input.participant_name ?? input.name ?? input.memberName ?? input.member_name,
        displayName: input.displayName ?? input.display_name ?? input.pushName ?? input.memberDisplayName ?? input.member_display_name,
        actorPhone: input.participantPhone ?? input.participant_phone ?? input.connectedPhone ?? null,
      };

      const participants = participantObjects.length > 0
        ? participantObjects
        : [topLevelParticipant];

      const occurredAt = parseTimestampToIso(
        input.timestamp ||
        input.createdAt ||
        input.created_at ||
        input.occurredAt ||
        input.occurred_at ||
        input.messageTimestamp ||
        input?.message?.timestamp ||
        input?.data?.timestamp ||
        input.momment ||
        null
      ) || new Date().toISOString();

      const eventRows = [];
      for (const participant of participants) {
          const participantObj = asObject(participant) ?? {};
          const participantPhone = normalizePhoneE164(firstString(
            participantObj.participantPhone,
            participantObj.participant_phone,
            participantObj.phone,
            participantObj.memberPhone,
            participantObj.member_phone,
            participantObj.userPhone,
            participantObj.user_phone,
            participantObj.id
          ));
          const participantProviderId = normalizeMemberProviderId(firstString(
            participantObj.participantPhone,
            participantObj.participant_phone,
            participantObj.phone,
            participantObj.memberPhone,
            participantObj.member_phone,
            participantObj.userPhone,
            participantObj.user_phone,
            participantObj.id
          ));
          const participantLid = normalizeLid(firstString(
            participantObj.participantLid,
            participantObj.participant_lid,
            participantObj.lid,
            participantObj.memberLid,
            participantObj.member_lid,
            participantObj.userLid,
            participantObj.user_lid
          ));
          const memberLid = participantProviderId || participantLid;
          if (!memberLid) continue;

          const participantName = firstString(
            participantObj.participantName,
            participantObj.participant_name,
            participantObj.name,
            participantObj.memberName,
            participantObj.member_name,
            participantObj.displayName,
            participantObj.display_name,
            participantObj.pushName
          );
          const participantPhotoUrl = firstString(
            participantObj.photoUrl,
            participantObj.photo_url,
            participantObj.profilePicUrl,
            participantObj.profile_pic_url
          );
          const participantIsAdmin = typeof (participantObj.isAdmin ?? participantObj.is_admin) === 'boolean'
            ? Boolean(participantObj.isAdmin ?? participantObj.is_admin)
            : null;
          const participantIsSuperAdmin = typeof (participantObj.isSuperAdmin ?? participantObj.is_super_admin) === 'boolean'
            ? Boolean(participantObj.isSuperAdmin ?? participantObj.is_super_admin)
            : null;

          const member = await resolveMember({
            phone: participantPhone,
            providerMemberId: participantProviderId,
            lid: participantLid,
            name: participantName,
            photoUrl: participantPhotoUrl,
            isAdmin: participantIsAdmin,
            isSuperAdmin: participantIsSuperAdmin,
            createdAt: occurredAt,
            allowCreate: memberEventType === 'GROUP_PARTICIPANT_ADD' || memberEventType === 'GROUP_PARTICIPANT_INVITE',
            metadataSource: 'zapi_member_event',
          });

          eventRows.push({
            group_id: groupId,
            member_id: member.id,
            event_type: memberEventType,
            member_lid: memberLid,
            source: provider,
            occurred_at: occurredAt,
            payload_raw: payload,
            meta: {
              phone_e164: participantPhone,
              lid: participantLid,
              provider_member_id: participantProviderId,
              name: participantName,
              display_name: participantName,
              actor_phone_e164: normalizePhoneE164(firstString(
                participantObj.actorPhone,
                participantObj.actor_phone,
                input.participantPhone,
                input.participant_phone,
                input.connectedPhone
              )),
            },
          });
      }

      if (eventRows.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'member event without participant identifier' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: memberEventsError } = await supabase
        .from('member_events')
        .insert(eventRows);

      if (memberEventsError) {
        throw memberEventsError;
      }

      let welcomeSentCount = 0;
      const welcomeResults: Array<Record<string, unknown>> = [];
      if (memberEventType === 'GROUP_PARTICIPANT_ADD' || memberEventType === 'GROUP_PARTICIPANT_INVITE') {
        const { data: groupSettings } = await supabase
          .from('group_settings')
          .select('welcome_message_enabled')
          .eq('group_id', groupId)
          .maybeSingle();

        if (groupSettings?.welcome_message_enabled && group?.provider_phone) {
          for (const row of eventRows) {
          const memberId = row.member_id || null;
          let memberMetadata: Record<string, unknown> = {};
          if (memberId) {
            const { data: memberRecord } = await supabase
              .from('members')
              .select('metadata')
              .eq('id', memberId)
              .maybeSingle();
            memberMetadata = asPlainObject(memberRecord?.metadata);
          }

          const alreadyWelcomedAt = typeof memberMetadata.welcome_sent_at === 'string'
            ? memberMetadata.welcome_sent_at
              : null;

            if (alreadyWelcomedAt) {
              welcomeResults.push({
                member_lid: row.member_lid,
                sent: false,
                skipped: true,
                reason: 'already_welcomed',
              });
              continue;
            }

            const welcomeMessage = buildWelcomeMessage({
              groupName: group?.name || null,
              memberName: String((row.meta as any)?.name || (row.meta as any)?.display_name || '').trim() || null,
            });
            try {
              const providerResponse = await sendZapiText({
                env,
                phone: String(group.provider_phone),
                message: welcomeMessage,
                fetchImpl,
              });
              await persistWelcomeAttempt({
                supabase,
                groupId,
                groupProviderPhone: String(group.provider_phone),
                message: welcomeMessage,
                providerResponse,
                eventType: 'member_event',
                memberId,
              });

              if (memberId) {
                const nextMetadata = {
                  ...memberMetadata,
                  welcome_sent_at: new Date().toISOString(),
                  welcome_sent_source: 'member_event',
                };

                await supabase
                  .from('members')
                  .update({ metadata: nextMetadata })
                  .eq('id', memberId);
              }

              welcomeSentCount += 1;
              welcomeResults.push({
                member_lid: row.member_lid,
                sent: true,
                provider_response: providerResponse,
              });
            } catch (welcomeError) {
              console.error('webhook-zapi-messages welcome send failed', welcomeError);
              const errorMessage = welcomeError instanceof Error ? welcomeError.message : 'Unknown welcome send error';
              await persistWelcomeAttempt({
                supabase,
                groupId,
                groupProviderPhone: String(group.provider_phone),
                message: welcomeMessage,
                errorMessage,
                eventType: 'member_event',
                memberId,
              });
              welcomeResults.push({
                member_lid: row.member_lid,
                sent: false,
                error: errorMessage,
              });
            }
          }
        }
      }

      await touchGroupSync();

      return new Response(
        JSON.stringify({ success: true, type: 'member_event', eventType: memberEventType, count: eventRows.length, welcomeSentCount, welcomeResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle standard messages (text/media)
    {
      const rawType = input.messageType || input.type || input?.message?.type || input?.message?.messageType;
      const messageType = mapMessageType(rawType);

      const senderProviderIdRaw = firstString(
        input.participantPhone ||
          input.participant_phone ||
          input.senderPhone ||
          input.sender_phone ||
          input.from ||
          input.author ||
          input?.message?.from ||
          input?.message?.author ||
          null
      );
      const senderProviderId = normalizeMemberProviderId(senderProviderIdRaw);
      const senderLid = normalizeLid(firstString(
        input.participantLid,
        input.participant_lid,
        input.senderLid,
        input.sender_lid,
        input.lid,
        input?.message?.participantLid,
        input?.message?.participant_lid,
        input?.message?.senderLid,
        input?.message?.sender_lid,
        input?.message?.lid,
        input?.data?.participantLid,
        input?.data?.participant_lid,
        input?.data?.senderLid,
        input?.data?.sender_lid,
        input?.data?.lid
      ));

      const senderPhone = normalizePhoneE164(
        input.participantPhone ||
          input.participant_phone ||
          input.senderPhone ||
          input.sender_phone ||
          input.from ||
          input.author ||
          input?.message?.from ||
          input?.message?.author ||
          null
      );

      const senderName: string | null =
        (input.senderName ||
          input.sender_name ||
          input.pushName ||
          input.participantName ||
          input.participant_name ||
          input?.message?.senderName ||
          input?.message?.pushName ||
          null) as string | null;
      const senderPhotoUrl = firstString(
        input.photoUrl,
        input.photo_url,
        input.profilePicUrl,
        input.profile_pic_url,
        input?.message?.photoUrl,
        input?.message?.photo_url,
        input?.sender?.photoUrl,
        input?.sender?.photo_url,
        input?.data?.photoUrl,
        input?.data?.photo_url
      );
      const senderIsAdmin = typeof (input.isAdmin ?? input.is_admin ?? input?.sender?.isAdmin ?? input?.sender?.is_admin) === 'boolean'
        ? Boolean(input.isAdmin ?? input.is_admin ?? input?.sender?.isAdmin ?? input?.sender?.is_admin)
        : null;
      const senderIsSuperAdmin = typeof (input.isSuperAdmin ?? input.is_super_admin ?? input?.sender?.isSuperAdmin ?? input?.sender?.is_super_admin) === 'boolean'
        ? Boolean(input.isSuperAdmin ?? input.is_super_admin ?? input?.sender?.isSuperAdmin ?? input?.sender?.is_super_admin)
        : null;

      const fromMe =
        Boolean(
          input.fromMe ??
            input.from_me ??
            input.isFromMe ??
            input.is_from_me ??
            input.self ??
            input.owner ??
            input?.message?.fromMe ??
            input?.message?.from_me
        ) || false;

      const createdAtISO =
        parseTimestampToIso(
          input.timestamp ||
            input.messageTimestamp ||
            input.message_ts ||
            input?.message?.timestamp ||
            input?.message?.t ||
            input.momment ||
            null
        );

      const replyToWhatsappProviderId = firstString(
        input.reply_to_whatsapp_provider_id,
        input.replyToWhatsappProviderId,
        input.replyToMessageId,
        input.reply_to_message_id,
        input.quotedMessageId,
        input.quoted_message_id,
        input?.message?.replyToMessageId,
        input?.message?.reply_to_message_id,
        input?.message?.quotedMessageId,
        input?.message?.quoted_message_id,
        input?.context?.replyToMessageId,
        input?.context?.quotedMessageId,
        input?.contextInfo?.stanzaId,
        input?.contextInfo?.quotedMessageId,
        input?.message?.contextInfo?.stanzaId,
        input?.message?.contextInfo?.quotedMessageId
      );

      const referenceMessageId = firstString(
        input.reference_message_id,
        input.referenceMessageId,
        input.reference_message,
        input?.message?.reference_message_id,
        input?.message?.referenceMessageId
      );

      const textCandidate =
        input.text?.message ||
        input.text?.text ||
        input.text ||
        input.body ||
        input.message ||
        input.content ||
        input?.message?.text ||
        input?.message?.body ||
        input?.message?.content ||
        input.caption ||
        input?.message?.caption ||
        null;

      const text = typeof textCandidate === 'string' ? textCandidate : textCandidate != null ? String(textCandidate) : null;
      const trimmedText = text ? text.trim() : null;

      const mediaUrl: string | null =
        (input.mediaUrl ||
          input.media_url ||
          input.fileUrl ||
          input.file_url ||
          input?.message?.mediaUrl ||
          input?.message?.media_url ||
          input?.media?.url ||
          input?.file?.url ||
          input?.image?.url ||
          input?.video?.url ||
          input?.audio?.url ||
          input?.document?.url ||
          null) as string | null;

      const thumbnailUrl: string | null =
        (input.thumbnailUrl ||
          input.thumbnail_url ||
          input?.message?.thumbnailUrl ||
          input?.message?.thumbnail_url ||
          input?.media?.thumbnail ||
          input?.image?.thumbnail ||
          input?.video?.thumbnail ||
          null) as string | null;

      const mediaMimeType: string | null =
        (input.mimeType ||
          input.mimetype ||
          input.mediaMimeType ||
          input.media_mime_type ||
          input?.message?.mimeType ||
          input?.message?.mimetype ||
          input?.media?.mimeType ||
          input?.file?.mimeType ||
          null) as string | null;

      const mediaCaption: string | null =
        (input.mediaCaption ||
          input.media_caption ||
          input.caption ||
          input?.message?.caption ||
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

          const member = await resolveMember({
            phone: senderPhone,
            providerMemberId: senderProviderId,
            lid: senderLid,
            name: senderName || senderPhone || senderLid,
            photoUrl: senderPhotoUrl,
            isAdmin: senderIsAdmin,
            isSuperAdmin: senderIsSuperAdmin,
            createdAt: createdAtISO,
            allowCreate: !fromMe,
            metadataSource: 'zapi_webhook',
          });
          const memberId = member.id;
          const memberMetadata = member.metadata;

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

          if (!fromMe && memberId && group?.provider_phone) {
            const { data: groupSettings } = await supabase
              .from('group_settings')
              .select('welcome_message_enabled')
              .eq('group_id', groupId)
              .maybeSingle();

            const alreadyWelcomedAt = typeof memberMetadata.welcome_sent_at === 'string'
              ? memberMetadata.welcome_sent_at
              : null;

            if (groupSettings?.welcome_message_enabled && !alreadyWelcomedAt) {
              const { count: previousMessagesCount } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('group_id', groupId)
                .eq('member_id', memberId);

              if ((previousMessagesCount ?? 0) <= 1) {
                try {
                  const message = buildWelcomeMessage({
                    groupName: group?.name || null,
                    memberName: senderName || null,
                  });
                  const providerResponse = await sendZapiText({
                    env,
                    phone: String(group.provider_phone),
                    message,
                    fetchImpl,
                  });

                  await persistWelcomeAttempt({
                    supabase,
                    groupId,
                    groupProviderPhone: String(group.provider_phone),
                    message,
                    providerResponse,
                    eventType: 'first_message_fallback',
                    memberId,
                  });

                  const nextMetadata = {
                    ...memberMetadata,
                    welcome_sent_at: new Date().toISOString(),
                    welcome_sent_source: 'first_message_fallback',
                  };

                  await supabase
                    .from('members')
                    .update({ metadata: nextMetadata })
                    .eq('id', memberId);
                } catch (welcomeError) {
                  console.error('webhook-zapi-messages fallback welcome send failed', welcomeError);
                  await persistWelcomeAttempt({
                    supabase,
                    groupId,
                    groupProviderPhone: String(group.provider_phone),
                    message: buildWelcomeMessage({
                      groupName: group?.name || null,
                      memberName: senderName || null,
                    }),
                    errorMessage: welcomeError instanceof Error ? welcomeError.message : 'Unknown fallback welcome send error',
                    eventType: 'first_message_fallback',
                    memberId,
                  });
                }
              }
            }
          }
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

    if (supabase && syncedGroupId) {
      try {
        await supabase
          .from('groups')
          .update({
            sync_status: 'error',
            sync_error: message.slice(0, 1000),
          })
          .eq('id', syncedGroupId);
      } catch (syncUpdateError) {
        console.error('webhook-zapi-messages failed to persist sync error:', syncUpdateError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  };
}

if (import.meta.main) {
  serve(createWebhookZapiMessagesHandler());
}
