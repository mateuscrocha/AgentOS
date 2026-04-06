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
  lid: string;
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
  provider_phone: string;
  description?: string;
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
  if (v === undefined || v === null) return undefined;
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
  if (v === undefined || v === null) return undefined;
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
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(path, 'esperado número válido');
  return v;
};

const toDigits = (raw: unknown): string => String(raw ?? '').replace(/\D/g, '');

const isValidGroupProviderId = (value: string): boolean => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.endsWith('-group') || trimmed.endsWith('@g.us');
};

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

const normalizeInviteLink = (raw: unknown): string => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    url.search = '';
    url.hash = '';
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return (trimmed.split(/[?#]/, 1)[0] ?? '').trim();
  }
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

const unwrapLikelyGroupRecord = (raw: unknown): Record<string, unknown> | null => {
  if (!isRecord(raw)) return null;

  const hasParticipants = Array.isArray((raw as Record<string, unknown>).participants);
  const hasGroupName = ['subject', 'name', 'description'].some((key) => typeof (raw as Record<string, unknown>)[key] === 'string');
  const hasGroupId = ['provider_phone', 'phone', 'jid', 'id'].some((key) => typeof (raw as Record<string, unknown>)[key] === 'string');
  if ((hasParticipants && hasGroupName) || (hasParticipants && hasGroupId)) {
    return raw as Record<string, unknown>;
  }

  const wrapperKeys = ['data', 'value', 'result', 'response', 'group', 'metadata', 'payload'];
  for (const key of wrapperKeys) {
    const candidate = (raw as Record<string, unknown>)[key];
    const unwrapped = unwrapLikelyGroupRecord(candidate);
    if (unwrapped) return unwrapped;
  }

  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!isRecord(value)) continue;
    const unwrapped = unwrapLikelyGroupRecord(value);
    if (unwrapped) return unwrapped;
  }

  return raw as Record<string, unknown>;
};

const readFirstNonEmptyString = (
  obj: Record<string, unknown>,
  candidates: Array<{ key: string; path: string }>,
): string | undefined => {
  for (const candidate of candidates) {
    const value = obj[candidate.key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') fail(candidate.path, 'esperado string');
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

export const validateWebhookGroupPayload = (raw: unknown): WebhookGroup => {
  const obj = unwrapLikelyGroupRecord(raw);
  if (!obj) fail('group', 'esperado objeto');

  const providerPhone =
    readFirstNonEmptyString(obj, [
      { key: 'provider_phone', path: 'group.provider_phone' },
      { key: 'phone', path: 'group.phone' },
      { key: 'jid', path: 'group.jid' },
      { key: 'id', path: 'group.id' },
    ]) ?? fail('group.provider_phone', 'esperado string não vazia');

  if (!isValidGroupProviderId(providerPhone)) {
    fail('group.provider_phone', 'deve terminar com "-group" ou "@g.us"');
  }

  const phone = readOptionalString(obj, 'phone', 'group.phone') ?? providerPhone;

  const description = readOptionalString(obj, 'description', 'group.description');
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
    provider_phone: providerPhone,
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

const extractInvitationGroupPhone = (raw: unknown): string => {
  if (!isRecord(raw)) return '';

  const direct = readFirstNonEmptyString(raw as Record<string, unknown>, [
    { key: 'provider_phone', path: 'group.provider_phone' },
    { key: 'phone', path: 'group.phone' },
    { key: 'jid', path: 'group.jid' },
    { key: 'id', path: 'group.id' },
    { key: 'groupId', path: 'group.groupId' },
  ]);
  if (direct && isValidGroupProviderId(direct)) return direct;

  const wrapperKeys = ['data', 'value', 'result', 'response', 'group', 'metadata', 'payload'];
  for (const key of wrapperKeys) {
    const nested = extractInvitationGroupPhone((raw as Record<string, unknown>)[key]);
    if (nested) return nested;
  }

  return '';
};

const describePayloadShape = (raw: unknown, depth = 0): unknown => {
  if (depth > 2) return 'max-depth';
  if (Array.isArray(raw)) {
    return {
      type: 'array',
      length: raw.length,
      first: raw.length > 0 ? describePayloadShape(raw[0], depth + 1) : null,
    };
  }
  if (!isRecord(raw)) {
    return typeof raw;
  }

  const entries = Object.entries(raw as Record<string, unknown>).slice(0, 12);
  return {
    type: 'object',
    keys: entries.map(([key]) => key),
    nested: Object.fromEntries(
      entries
        .filter(([, value]) => isRecord(value) || Array.isArray(value))
        .map(([key, value]) => [key, describePayloadShape(value, depth + 1)]),
    ),
  };
};

const maskSensitiveString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}…`;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
};

const sanitizePayloadForDebug = (raw: unknown, depth = 0): unknown => {
  if (depth > 2) return 'max-depth';
  if (Array.isArray(raw)) {
    return raw.slice(0, 5).map((item) => sanitizePayloadForDebug(item, depth + 1));
  }
  if (!isRecord(raw)) {
    if (typeof raw === 'string') return maskSensitiveString(raw);
    return raw;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw).slice(0, 15)) {
    if (typeof value === 'string') {
      out[key] = maskSensitiveString(value);
      continue;
    }
    if (isRecord(value) || Array.isArray(value)) {
      out[key] = sanitizePayloadForDebug(value, depth + 1);
      continue;
    }
    out[key] = value;
  }
  return out;
};

const readUpstreamErrorMessage = (raw: unknown): string | null => {
  if (!isRecord(raw)) return null;
  const success = (raw as Record<string, unknown>).success;
  const message = (raw as Record<string, unknown>).message;
  if (success === false && typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  return null;
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
      lid: p.lid,
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
    const inviteLink = normalizeInviteLink(invite_link);

    if (!inviteLink) {
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

    const zapiBaseUrl = String(envImpl('ZAPI_BASE_URL') ?? 'https://api.z-api.io').trim().replace(/\/+$/, '');
    const zapiInstance = String(envImpl('ZAPI_INSTANCE') ?? '').trim();
    const zapiToken = String(envImpl('ZAPI_TOKEN') ?? '').trim();
    const zapiClientToken = String(envImpl('ZAPI_CLIENT_TOKEN') ?? '').trim();

    if (!zapiInstance || !zapiToken || !zapiClientToken) {
      console.error('Z-API not configured', JSON.stringify({ correlation_id: correlationId }));
      return json(
        {
          success: false,
          code: 'ZAPI_NOT_CONFIGURED',
          message: 'Credenciais da Z-API não configuradas',
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
      const raw = String(inviteLink);
      return raw.length <= 12 ? raw : `${raw.slice(0, 6)}…${raw.slice(-4)}`;
    })();

    const cacheKey = inviteLink;
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
    let invitationResponse: Response;
    try {
      invitationResponse = await fetchWithTimeout(
        `${zapiBaseUrl}/instances/${encodeURIComponent(zapiInstance)}/token/${encodeURIComponent(zapiToken)}/group-invitation-metadata?url=${encodeURIComponent(inviteLink)}`,
        {
          method: 'GET',
          headers: {
            'client-token': zapiClientToken,
            'x-correlation-id': correlationId,
          },
        },
        upstreamTimeoutMs
      );
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError';
      const totalMs = Date.now() - requestStartedAt;
      console.error('zapi invitation metadata timeout', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: Date.now() - upstreamStartedAt }));
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

    const invitationRaw = await invitationResponse.text().catch(() => '');
    let invitationData: any = null;
    try {
      invitationData = invitationRaw ? JSON.parse(invitationRaw) : null;
    } catch {
      invitationData = null;
    }

    const invitationIndicatesBotMissing =
      invitationResponse.status === 400 ||
      (invitationData && typeof invitationData === 'object' && !Array.isArray(invitationData) && invitationData.statusCode === 400);

    if (invitationIndicatesBotMissing) {
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

    if (!invitationResponse.ok) {
      console.error('zapi invitation metadata error', JSON.stringify({
        correlation_id: correlationId,
        status: invitationResponse.status,
        status_text: invitationResponse.statusText,
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
          debug_shape: describePayloadShape(invitationData),
          debug_payload: sanitizePayloadForDebug(invitationData),
        },
        502
      );
    }

    const invitationGroupPhone = extractInvitationGroupPhone(invitationData);
    if (!invitationGroupPhone) {
      console.error('Missing group phone in invitation metadata', JSON.stringify({ correlation_id: correlationId }));
      return json(
        {
          success: false,
          code: 'INVALID_UPSTREAM_PAYLOAD',
          message: 'Resposta inválida da Z-API ao consultar convite',
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
          debug_shape: describePayloadShape(invitationData),
          debug_payload: sanitizePayloadForDebug(invitationData),
        },
        502
      );
    }

    let metadataResponse: Response;
    try {
      metadataResponse = await fetchWithTimeout(
        `${zapiBaseUrl}/instances/${encodeURIComponent(zapiInstance)}/token/${encodeURIComponent(zapiToken)}/group-metadata/${encodeURIComponent(invitationGroupPhone)}`,
        {
          method: 'GET',
          headers: {
            'client-token': zapiClientToken,
            'x-correlation-id': correlationId,
          },
        },
        upstreamTimeoutMs
      );
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError';
      const totalMs = Date.now() - requestStartedAt;
      console.error('zapi group metadata timeout', JSON.stringify({ correlation_id: correlationId, ms_total: totalMs, ms_upstream: Date.now() - upstreamStartedAt }));
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

    if (!metadataResponse.ok) {
      console.error('zapi group metadata error', JSON.stringify({
        correlation_id: correlationId,
        status: metadataResponse.status,
        status_text: metadataResponse.statusText,
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
          debug_shape: describePayloadShape(groupData),
          debug_payload: sanitizePayloadForDebug(groupData),
        },
        502
      );
    }

    const groupData = await metadataResponse.json().catch(() => null);
    const upstreamMetadataError = readUpstreamErrorMessage(groupData);
    if (upstreamMetadataError) {
      const normalizedMessage = upstreamMetadataError.toLowerCase();
      const code =
        normalizedMessage.includes('forbidden') || normalizedMessage.includes('hidden') || normalizedMessage.includes('denied')
          ? 'GROUP_METADATA_FORBIDDEN'
          : 'VALIDATION_UPSTREAM_INVALID';
      return json(
        {
          success: false,
          code,
          message:
            code === 'GROUP_METADATA_FORBIDDEN'
              ? 'A Z-API encontrou o grupo, mas não conseguiu ler os metadados. Isso normalmente significa que o Bóris ainda não entrou no grupo ou não tem acesso suficiente.'
              : `Resposta inesperada da Z-API: ${upstreamMetadataError}`,
          is_valid: false,
          is_boris_in_group: false,
          provider: 'whatsapp',
          whatsapp_provider_id: '',
          group_name: '',
          participants_count: 0,
          participants: [],
          debug_shape: describePayloadShape(groupData),
          debug_payload: sanitizePayloadForDebug(groupData),
        },
        502
      );
    }

    console.log('zapi response', JSON.stringify({
      correlation_id: correlationId,
      type: Array.isArray(groupData) ? 'array' : typeof groupData,
    }));

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

      console.error('Invalid group payload from Z-API', JSON.stringify({
        correlation_id: correlationId,
        code,
        message,
        owner: maskedOwner,
        participants_count: Array.isArray((groupData as any)?.participants) ? (groupData as any).participants.length : null,
        group_shape: describePayloadShape(groupData),
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
          debug_shape: describePayloadShape(groupData),
          debug_payload: sanitizePayloadForDebug(groupData),
        },
        status
      );
    }

    const groupName = validatedGroup.name;
    const providerId = validatedGroup.provider_phone || validatedGroup.phone;

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
      provider_phone: providerId,
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

if ((import.meta as any).main) {
  serve(createValidateWhatsAppGroupHandler());
}
