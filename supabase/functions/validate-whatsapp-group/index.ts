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
  whatsapp_provider_id: string;
};

type WebhookParticipant = {
  phone: string;
  lid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type WebhookGroup = {
  phone: string;
  description: string;
  subject: string;
  name: string;
  owner?: string;
  creation: number;
  participants: WebhookParticipant[];
  invitationLink?: string;
  invitationLinkError?: string;
  communityId?: string;
  adminOnlyMessage?: boolean;
  adminOnlySettings?: boolean;
  requireAdminApproval?: boolean;
  isGroupAnnouncement?: boolean;
  subjectTime?: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

const readString = (obj: Record<string, unknown>, key: string, path: string): string => {
  const v = obj[key];
  if (typeof v !== 'string') return fail(path, 'esperado string não vazia');
  if (v.trim() === '') return fail(path, 'esperado string não vazia');
  return v;
};

const readOptionalString = (obj: Record<string, unknown>, key: string, path: string): string | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return fail(path, 'esperado string');
  return v;
};

const readBoolean = (obj: Record<string, unknown>, key: string, path: string): boolean => {
  const v = obj[key];
  if (typeof v !== 'boolean') return fail(path, 'esperado boolean');
  return v;
};

const readOptionalBoolean = (obj: Record<string, unknown>, key: string, path: string): boolean | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') return fail(path, 'esperado boolean');
  return v;
};

const readNumber = (obj: Record<string, unknown>, key: string, path: string): number => {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(path, 'esperado número válido');
  return v;
};

const readOptionalNumber = (obj: Record<string, unknown>, key: string, path: string): number | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(path, 'esperado número válido');
  return v;
};

const toDigits = (raw: unknown): string => String(raw ?? '').replace(/\D/g, '');

const toE164 = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (s.startsWith('+')) {
    const digits = toDigits(s);
    if (!digits) return null;
    if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
    return '+55' + digits;
  }

  const digits = toDigits(s);
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  return '+' + digits;
};

const validateWebhookParticipant = (raw: unknown, index: number): WebhookParticipant => {
  const pathBase = `participants[${index}]`;
  if (!isRecord(raw)) fail(pathBase, 'esperado objeto');

  const obj = raw as Record<string, unknown>;

  const phone = readString(obj, 'phone', `${pathBase}.phone`);
  const lid = readString(obj, 'lid', `${pathBase}.lid`);
  const isAdmin = readBoolean(obj, 'isAdmin', `${pathBase}.isAdmin`);
  const isSuperAdmin = readBoolean(obj, 'isSuperAdmin', `${pathBase}.isSuperAdmin`);

  return { phone, lid, isAdmin, isSuperAdmin };
};

export const validateWebhookGroupPayload = (raw: unknown): WebhookGroup => {
  if (!isRecord(raw)) fail('group', 'esperado objeto');

  const obj = raw as Record<string, unknown>;

  const phone = readString(obj, 'phone', 'group.phone');
  if (!phone.endsWith('-group')) fail('group.phone', 'deve terminar com "-group"');

  const description = readString(obj, 'description', 'group.description');
  const subject = readString(obj, 'subject', 'group.subject');
  const name = readString(obj, 'name', 'group.name');
  const owner = readOptionalString(obj, 'owner', 'group.owner');
  const creation = readNumber(obj, 'creation', 'group.creation');

  const participantsRaw = obj['participants'];
  if (!Array.isArray(participantsRaw)) fail('group.participants', 'esperado array');
  const participants = (participantsRaw as unknown[]).map((p, idx) => validateWebhookParticipant(p, idx));
  if (participants.length === 0) fail('group.participants', 'deve conter ao menos 1 participante');

  if (owner !== undefined) {
    if (owner.trim() === '') fail('group.owner', 'esperado string não vazia');

    const ownerE164 = toE164(owner);
    if (!ownerE164) fail('group.owner', 'esperado telefone válido');

    const ownerKey = toDigits(ownerE164);
    const matches = participants.some((p) => {
      const pE164 = toE164(p.phone);
      if (!pE164) return false;
      return toDigits(pE164) === ownerKey;
    });
    if (!matches) fail('group.owner', 'deve corresponder ao phone de um participante');
  }

  const invitationLink = readOptionalString(obj, 'invitationLink', 'group.invitationLink');
  const invitationLinkError = readOptionalString(obj, 'invitationLinkError', 'group.invitationLinkError');
  const communityId = readOptionalString(obj, 'communityId', 'group.communityId');
  const adminOnlyMessage = readOptionalBoolean(obj, 'adminOnlyMessage', 'group.adminOnlyMessage');
  const adminOnlySettings = readOptionalBoolean(obj, 'adminOnlySettings', 'group.adminOnlySettings');
  const requireAdminApproval = readOptionalBoolean(obj, 'requireAdminApproval', 'group.requireAdminApproval');
  const isGroupAnnouncement = readOptionalBoolean(obj, 'isGroupAnnouncement', 'group.isGroupAnnouncement');
  const subjectTime = readOptionalNumber(obj, 'subjectTime', 'group.subjectTime');

  return {
    phone,
    description,
    subject,
    name,
    owner,
    creation,
    participants,
    invitationLink,
    invitationLinkError,
    communityId,
    adminOnlyMessage,
    adminOnlySettings,
    requireAdminApproval,
    isGroupAnnouncement,
    subjectTime,
  };
};

const normalizeWebhookParticipants = (participants: WebhookParticipant[]): NormalizedParticipant[] => {
  return participants.map((p) => {
    const isSuperAdmin = !!p.isSuperAdmin;
    const isAdmin = !!p.isAdmin || isSuperAdmin;
    return {
      phone: p.phone,
      name: p.phone,
      is_admin: isAdmin,
      is_super_admin: isSuperAdmin,
      whatsapp_provider_id: p.lid || p.phone,
    };
  });
};

type Env = {
  get: (key: string) => string | undefined;
};

export const createValidateWhatsAppGroupHandler = (args?: {
  env?: Env;
  fetchImpl?: typeof fetch;
}) => {
  const envImpl = args?.env?.get ?? env;
  const fetchImpl = args?.fetchImpl ?? fetch;

  const cache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();

  const readInt = (key: string, fallback: number) => {
    const raw = envImpl(key);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };

  const cacheMaxEntries = readInt('VALIDATE_WHATSAPP_GROUP_CACHE_MAX_ENTRIES', 200);
  const cacheTtlMs = readInt('VALIDATE_WHATSAPP_GROUP_CACHE_TTL_MS', 60_000);
  const negativeCacheTtlMs = readInt('VALIDATE_WHATSAPP_GROUP_NEGATIVE_CACHE_TTL_MS', 10_000);
  const upstreamTimeoutMs = readInt('VALIDATE_WHATSAPP_GROUP_UPSTREAM_TIMEOUT_MS', 4_500);
  const slowThresholdMs = readInt('VALIDATE_WHATSAPP_GROUP_SLOW_THRESHOLD_MS', 5_000);

  const cacheGet = (key: string, now: number) => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= now) {
      cache.delete(key);
      return null;
    }
    cache.delete(key);
    cache.set(key, hit);
    return hit.value;
  };

  const cacheSet = (key: string, now: number, ttlMs: number, value: Record<string, unknown>) => {
    if (cacheMaxEntries <= 0 || ttlMs <= 0) return;
    cache.delete(key);
    cache.set(key, { expiresAt: now + ttlMs, value });
    while (cache.size > cacheMaxEntries) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (!firstKey) break;
      cache.delete(firstKey);
    }
  };

  const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  const requestStartedAt = Date.now();
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

    const n8nWebhookUrl = envImpl('N8N_CHECK_GROUP_ENTRY_URL') ?? envImpl('VITE_N8N_CHECK_GROUP_ENTRY_URL');
    
    if (!n8nWebhookUrl) {
      console.error('N8N_CHECK_GROUP_ENTRY_URL not configured', JSON.stringify({ correlation_id: correlationId }));
      return json(
        {
          success: false,
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'URL do webhook não configurada',
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

    const cacheKey = String(invite_link).trim();
    const now = Date.now();
    const cached = cacheGet(cacheKey, now);
    if (cached) {
      const totalMs = Date.now() - requestStartedAt;
      if (totalMs > slowThresholdMs) {
        console.warn('SLOW_VALIDATE_WHATSAPP_GROUP', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, cached: true }));
      }
      return json({ ...cached, cached: true });
    }

    console.log('Validating WhatsApp group', JSON.stringify({ correlation_id: correlationId, invite_link: inviteLinkHash }));

    const upstreamStartedAt = Date.now();
    let response: Response;
    try {
      response = await fetchWithTimeout(
        n8nWebhookUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': correlationId,
          },
          body: JSON.stringify({ invite_link }),
        },
        upstreamTimeoutMs
      );
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError';
      const totalMs = Date.now() - requestStartedAt;
      console.error('n8n webhook timeout', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: Date.now() - upstreamStartedAt }));
      return json(
        {
          success: false,
          code: isTimeout ? 'VALIDATION_TIMEOUT' : 'VALIDATION_UPSTREAM_FAILED',
          message: isTimeout ? 'Validation timed out' : 'Failed to validate group',
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
        },
        isTimeout ? 504 : 502
      );
    }

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
      const body = {
        success: true,
        is_valid: true,
        is_boris_in_group: false,
        provider: 'whatsapp',
        whatsapp_provider_id: '',
        group_name: '',
        participants_count: 0,
        participants: [],
      } as const;
      cacheSet(cacheKey, Date.now(), negativeCacheTtlMs, body as unknown as Record<string, unknown>);

      const totalMs = Date.now() - requestStartedAt;
      const upstreamMs = Date.now() - upstreamStartedAt;
      console.log('validate-whatsapp-group timing', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
      if (totalMs > slowThresholdMs) {
        console.warn('SLOW_VALIDATE_WHATSAPP_GROUP', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
      }

      return json(body as unknown as Record<string, unknown>);
    }

    // Check if response is an array (Bóris IS in the group)
    if (Array.isArray(data) && data.length > 0) {
      const groupData = data[0];

      let validatedGroup: WebhookGroup;
      try {
        validatedGroup = validateWebhookGroupPayload(groupData);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);

        const ownerMismatch = /^group\.owner:\s*/.test(message) && message.includes('deve corresponder ao phone de um participante');
        const code = ownerMismatch ? 'OWNER_MISMATCH' : 'INVALID_WEBHOOK_PAYLOAD';
        const status = ownerMismatch ? 422 : 502;

        const ownerRaw = isRecord(groupData) ? (groupData as any).owner : undefined;
        const ownerE164 = ownerRaw ? toE164(ownerRaw) : null;
        const ownerDigits = ownerE164 ? toDigits(ownerE164) : null;
        const maskedOwner = ownerDigits ? `${ownerDigits.slice(0, 4)}…${ownerDigits.slice(-4)}` : null;

        console.error('Invalid group payload from n8n', JSON.stringify({
          correlation_id: correlationId,
          code,
          message,
          owner: maskedOwner,
          participants_count: Array.isArray((groupData as any)?.participants) ? (groupData as any).participants.length : null,
        }));

        return json(
          {
            success: false,
            code,
            message: ownerMismatch
              ? 'Não foi possível validar: o dono do grupo não está na lista de participantes.'
              : message,
            is_valid: false,
            is_boris_in_group: false,
            provider: 'whatsapp',
            whatsapp_provider_id: '',
            group_name: '',
            participants_count: 0,
            participants: [],
          },
          status
        );
      }

      const groupName = validatedGroup.name;
      const providerId = validatedGroup.phone;

      console.log('Bóris IS in the group', JSON.stringify({
        correlation_id: correlationId,
        group_name: groupName,
      }));

      const participants = normalizeWebhookParticipants(validatedGroup.participants);

      const ownerPhoneE164 = validatedGroup.owner ? toE164(validatedGroup.owner) : null;

      const body = {
        success: true,
        is_valid: true,
        is_boris_in_group: true,
        provider: 'whatsapp',
        whatsapp_provider_id: providerId,
        group_name: groupName,
        owner_phone_e164: ownerPhoneE164,
        participants_count: participants.length,
        participants,
      } as const;

      cacheSet(cacheKey, Date.now(), cacheTtlMs, body as unknown as Record<string, unknown>);

      const totalMs = Date.now() - requestStartedAt;
      const upstreamMs = Date.now() - upstreamStartedAt;
      console.log('validate-whatsapp-group timing', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
      if (totalMs > slowThresholdMs) {
        console.warn('SLOW_VALIDATE_WHATSAPP_GROUP', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
      }

      return json(body as unknown as Record<string, unknown>);
    }

    // Unknown response format
    console.error('Unknown n8n response format', JSON.stringify({ correlation_id: correlationId }));
    const totalMs = Date.now() - requestStartedAt;
    const upstreamMs = Date.now() - upstreamStartedAt;
    console.log('validate-whatsapp-group timing', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
    if (totalMs > slowThresholdMs) {
      console.warn('SLOW_VALIDATE_WHATSAPP_GROUP', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: upstreamMs, cached: false }));
    }
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
    const totalMs = Date.now() - requestStartedAt;
    if (totalMs > slowThresholdMs) {
      console.warn('SLOW_VALIDATE_WHATSAPP_GROUP', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, cached: false }));
    }
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
  };
};

serve(createValidateWhatsAppGroupHandler());
