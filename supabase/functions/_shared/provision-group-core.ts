import { insertMembersFromParticipantsForGroup } from "./members-from-participants.ts";

type ParticipantLike = {
  phone?: unknown;
  name?: unknown;
  is_admin?: unknown;
  is_super_admin?: unknown;
  is_owner?: unknown;
  whatsapp_provider_id?: unknown;
};

type ProvisionGroupInput = {
  provider?: unknown;
  whatsapp_provider_id?: unknown;
  name?: unknown;
  invite_link?: unknown;
};

export class ProvisionCoreError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(args: { code: string; message: string; status?: number; details?: unknown }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.details = args.details;
  }
}

const isUnknownColumnError = (err: any): boolean => {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  const msg = message.toLowerCase();
  return (
    code === '42703' ||
    (msg.includes('column') && msg.includes('does not exist')) ||
    (msg.includes('column') && msg.includes('schema cache')) ||
    (msg.includes('could not find the') && msg.includes('column'))
  );
};

const isUniqueViolation = (err: any): boolean => String(err?.code || '') === '23505';

const toE164 = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (s.startsWith('+')) {
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
    return '+55' + digits;
  }

  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  return '+' + digits;
};

const toDigits = (raw: unknown): string => String(raw ?? '').replace(/\D/g, '');

const normalizeParticipants = (participants: unknown) => {
  const invalid: Array<{ index: number; reason: string }> = [];
  if (!Array.isArray(participants) || participants.length === 0) {
    return { normalized: [] as ParticipantLike[], invalid };
  }

  const normalized: ParticipantLike[] = [];
  const seen = new Set<string>();

  participants.forEach((p: ParticipantLike, index) => {
    const providerIdRaw = String(p?.whatsapp_provider_id ?? '').trim();
    const providerDigits = toDigits(providerIdRaw);
    const phoneRaw = String(p?.phone ?? '').trim();
    const phoneE164 = toE164(phoneRaw) ?? (providerDigits.length >= 10 ? toE164(providerDigits) : null);
    if (!phoneE164) {
      invalid.push({ index, reason: 'PHONE_INVALID' });
      return;
    }

    const digits = toDigits(phoneE164);
    const providerId = providerIdRaw || digits;
    if (!providerId) {
      invalid.push({ index, reason: 'PROVIDER_ID_MISSING' });
      return;
    }

    const key = digits || toDigits(providerId) || providerId.trim() || phoneE164;
    if (!key) {
      invalid.push({ index, reason: 'KEY_MISSING' });
      return;
    }

    if (seen.has(key)) return;
    seen.add(key);

    const isOwner = !!p?.is_owner;
    const isSuperAdmin = !!p?.is_super_admin;
    const isAdmin = !!p?.is_admin || isOwner || isSuperAdmin;

    normalized.push({
      phone: phoneE164,
      name: String(p?.name ?? '').trim() || null,
      is_admin: isAdmin,
      is_super_admin: isSuperAdmin,
      is_owner: isOwner,
      whatsapp_provider_id: providerId,
    });
  });

  return { normalized, invalid };
};

const findExistingGroup = async (args: {
  supabase: any;
  externalId: string;
}) => {
  const { supabase, externalId } = args;
  let existing: any = null;
  let err: any = null;

  ({ data: existing, error: err } = await supabase
    .from('groups')
    .select('id, name')
    .eq('whatsapp_provider_id', externalId)
    .maybeSingle());

  if (err && isUnknownColumnError(err)) {
    ({ data: existing, error: err } = await supabase
      .from('groups')
      .select('id, name')
      .eq('provider_group_id', externalId)
      .maybeSingle());
  }

  if (err) throw err;
  return existing;
};

const tryInsertGroup = async (args: {
  supabase: any;
  organizationId: string;
  groupName: string;
  externalId: string;
  inviteLink?: string | null;
}) => {
  const { supabase, organizationId, groupName, externalId } = args;
  const inviteLink = args.inviteLink ?? null;

  const base: any = {
    name: groupName,
    organization_id: organizationId,
    provider: 'whatsapp',
    invite_link: inviteLink,
    invite_link_status: inviteLink ? 'valid' : undefined,
    status: 'active',
    is_active: true,
    is_archived: false,
  };

  const attempts: any[] = [
    { ...base, whatsapp_provider_id: externalId },
    { ...base, provider_group_id: externalId },
    { name: groupName, organization_id: organizationId, provider: 'whatsapp', invite_link: inviteLink, whatsapp_provider_id: externalId },
    { name: groupName, organization_id: organizationId, provider: 'whatsapp', invite_link: inviteLink, provider_group_id: externalId },
    { name: groupName, organization_id: organizationId, provider: 'whatsapp', whatsapp_provider_id: externalId },
    { name: groupName, organization_id: organizationId, provider: 'whatsapp', provider_group_id: externalId },
  ];

  let lastUnknown: any = null;
  for (const ins of attempts) {
    const res = await supabase.from('groups').insert(ins).select('id').single();
    if (!res.error) return res;
    if (isUnknownColumnError(res.error)) {
      lastUnknown = res.error;
      continue;
    }
    return res;
  }

  return { data: null, error: lastUnknown ?? new Error('Falha ao inserir grupo') };
};

export type ProvisionGroupCoreOptions = {
  participantsPolicy?: 'strict' | 'lenient';
  requireParticipants?: boolean;
  requireMembersInserted?: boolean;
  membersMode?: 'required' | 'best_effort';
};

export const provisionGroupWithMembersCore = async (args: {
  supabase: any;
  organizationId: string;
  group: ProvisionGroupInput;
  participants: unknown;
  options?: ProvisionGroupCoreOptions;
}) => {
  const { supabase, organizationId } = args;

  const provider = String(args.group?.provider ?? 'whatsapp');
  if (provider && provider !== 'whatsapp') {
    throw new ProvisionCoreError({
      code: 'UNSUPPORTED_PROVIDER',
      message: 'Only WhatsApp provider is supported',
      status: 400,
    });
  }

  const groupName = String(args.group?.name ?? '').trim();
  const externalId = String(args.group?.whatsapp_provider_id ?? '').trim();
  const inviteLink = String(args.group?.invite_link ?? '').trim() || null;

  if (!organizationId) {
    throw new ProvisionCoreError({ code: 'ORG_ID_REQUIRED', message: 'Organization ID is required', status: 400 });
  }

  if (!groupName || !externalId) {
    throw new ProvisionCoreError({ code: 'GROUP_DATA_INCOMPLETE', message: 'Group data is incomplete', status: 400 });
  }

  const opts = args.options ?? {};
  const participantsPolicy = opts.participantsPolicy ?? 'lenient';
  const requireParticipants = opts.requireParticipants ?? false;
  const requireMembersInserted = opts.requireMembersInserted ?? requireParticipants;
  const membersMode = opts.membersMode ?? (requireMembersInserted ? 'required' : 'best_effort');

  const { normalized: normalizedParticipants, invalid } = normalizeParticipants(args.participants);
  if (participantsPolicy === 'strict' && invalid.length > 0) {
    throw new ProvisionCoreError({
      code: 'WEBHOOK_CONTRACT_INVALID',
      message: 'Participantes inválidos no payload',
      status: 400,
      details: { invalid },
    });
  }

  const participantsForInsert = participantsPolicy === 'strict'
    ? normalizedParticipants
    : normalizedParticipants;

  if (requireParticipants && participantsForInsert.length === 0) {
    throw new ProvisionCoreError({
      code: 'WEBHOOK_CONTRACT_INVALID',
      message: 'Lista de membros ausente ou vazia no payload',
      status: 400,
      details: { invalid_count: invalid.length },
    });
  }

  const existing = await findExistingGroup({ supabase, externalId }).catch(() => null);
  if (existing) {
    throw new ProvisionCoreError({
      code: 'GROUP_ALREADY_EXISTS',
      message: 'Grupo já existe',
      status: 409,
      details: { existing_group: existing },
    });
  }

  const { data: groupRow, error: groupInsertError } = await tryInsertGroup({
    supabase,
    organizationId,
    groupName,
    externalId,
    inviteLink,
  });

  if (groupInsertError) {
    if (isUniqueViolation(groupInsertError)) {
      const again = await findExistingGroup({ supabase, externalId }).catch(() => null);
      throw new ProvisionCoreError({
        code: 'GROUP_ALREADY_EXISTS',
        message: 'Grupo já existe',
        status: 409,
        details: { existing_group: again },
      });
    }
    throw groupInsertError;
  }

  const groupId = (groupRow as any)?.id as string | undefined;
  if (!groupId) {
    throw new ProvisionCoreError({ code: 'GROUP_INSERT_FAILED', message: 'Falha ao incluir grupo', status: 500 });
  }

  if (participantsForInsert.length > 0) {
    try {
      await insertMembersFromParticipantsForGroup({ supabase, groupId, participants: participantsForInsert });
    } catch (e: any) {
      if (membersMode !== 'required') {
        void e;
      } else {
        throw e;
      }
    }
  }

  if (requireMembersInserted) {
    const { count, error } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .is('deleted_at', null);
    if (error) throw error;
    const n = Number(count || 0);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ProvisionCoreError({
        code: 'MEMBERS_INTEGRITY_FAILED',
        message: 'Nenhum Member encontrado após inserção',
        status: 500,
      });
    }
  }

  return {
    group_id: groupId,
    invalid_participants: invalid,
    inserted_participants_count: participantsForInsert.length,
  };
};
