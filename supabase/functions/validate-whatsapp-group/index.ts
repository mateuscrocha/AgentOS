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

type WebhookParticipant = {
  phone: string;
  lid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type WebhookGroup = {
  phone: string;
  description: string;
  owner: string;
  subject: string;
  name: string;
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
  subjectOwner?: string;
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
  const owner = readString(obj, 'owner', 'group.owner');
  const subject = readString(obj, 'subject', 'group.subject');
  const name = readString(obj, 'name', 'group.name');
  const creation = readNumber(obj, 'creation', 'group.creation');

  const participantsRaw = obj['participants'];
  if (!Array.isArray(participantsRaw)) fail('group.participants', 'esperado array');
  const participants = (participantsRaw as unknown[]).map((p, idx) => validateWebhookParticipant(p, idx));
  if (participants.length === 0) fail('group.participants', 'deve conter ao menos 1 participante');

  const invitationLink = readOptionalString(obj, 'invitationLink', 'group.invitationLink');
  const invitationLinkError = readOptionalString(obj, 'invitationLinkError', 'group.invitationLinkError');
  const communityId = readOptionalString(obj, 'communityId', 'group.communityId');
  const adminOnlyMessage = readOptionalBoolean(obj, 'adminOnlyMessage', 'group.adminOnlyMessage');
  const adminOnlySettings = readOptionalBoolean(obj, 'adminOnlySettings', 'group.adminOnlySettings');
  const requireAdminApproval = readOptionalBoolean(obj, 'requireAdminApproval', 'group.requireAdminApproval');
  const isGroupAnnouncement = readOptionalBoolean(obj, 'isGroupAnnouncement', 'group.isGroupAnnouncement');
  const subjectTime = readOptionalNumber(obj, 'subjectTime', 'group.subjectTime');
  const subjectOwner = readOptionalString(obj, 'subjectOwner', 'group.subjectOwner');

  const superAdminPhones = participants.filter((p) => p.isSuperAdmin).map((p) => p.phone);
  if (superAdminPhones.length === 0) {
    fail('participants', 'deve conter ao menos 1 participante com isSuperAdmin=true');
  }
  if (!superAdminPhones.includes(owner)) {
    fail('group.owner', 'deve corresponder ao phone de um participante com isSuperAdmin=true');
  }
  if (subjectOwner !== undefined && subjectOwner !== owner) {
    fail('group.subjectOwner', 'deve ser igual a group.owner');
  }

  return {
    phone,
    description,
    owner,
    subject,
    name,
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
    subjectOwner,
  };
};

const normalizeWebhookParticipants = (args: {
  groupOwner: string;
  participants: WebhookParticipant[];
}): NormalizedParticipant[] => {
  const { groupOwner, participants } = args;
  return participants.map((p) => {
    const isOwner = p.phone === groupOwner;
    return {
      phone: p.phone,
      name: p.phone,
      is_admin: !!p.isAdmin,
      is_super_admin: !!p.isSuperAdmin,
      is_owner: isOwner,
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

  return async (req: Request) => {
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

    const n8nWebhookUrl = envImpl('VITE_N8N_CHECK_GROUP_ENTRY_URL');
    
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
    const response = await fetchImpl(n8nWebhookUrl, {
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

      let validatedGroup: WebhookGroup;
      try {
        validatedGroup = validateWebhookGroupPayload(groupData);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('Invalid group payload from n8n', JSON.stringify({ correlation_id: correlationId, message }));
        return json(
          {
            success: false,
            code: 'INVALID_WEBHOOK_PAYLOAD',
            message,
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

      const groupName = validatedGroup.name;
      const providerId = validatedGroup.phone;

      console.log('Bóris IS in the group', JSON.stringify({
        correlation_id: correlationId,
        group_name: groupName,
      }));

      const participants = normalizeWebhookParticipants({ groupOwner: validatedGroup.owner, participants: validatedGroup.participants });

      return json({
        success: true,
        is_valid: true,
        is_boris_in_group: true,
        provider: 'whatsapp',
        whatsapp_provider_id: providerId,
        group_name: groupName,
        participants_count: participants.length,
        participants,
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
  };
};

serve(createValidateWhatsAppGroupHandler());
