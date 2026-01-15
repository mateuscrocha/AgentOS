import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { insertMembersFromParticipantsForGroup } from "../_shared/members-from-participants.ts";

type Env = {
  get: (key: string) => string | undefined;
};

type CreateClient = typeof createClient;

type Deps = {
  createClient?: CreateClient;
  env?: Env;
  fetch?: typeof fetch;
  crypto?: Crypto;
};

const defaultEnv: Env = {
  get: (key: string) => (globalThis as any)?.Deno?.env?.get?.(key),
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    whatsapp_provider_id: string;
    name: string;
    invite_link: string;
  };
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    is_owner?: boolean;
    whatsapp_provider_id: string;
  }>;
}

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  provider: string;
  whatsapp_provider_id: string | null;
  provider_phone: string | null;
  invite_link: string | null;
  created_at: string;
  updated_at: string;
  assistant_id: string | null;
  has_assistant: boolean;
  metadata: unknown | null;
  raw_provider: unknown | null;
  status: string | null;
  sync_status: string | null;
  sync_error: string | null;
  [key: string]: unknown;
};

class WebhookError extends Error {
  code: string;
  status?: number;
  body?: string;

  constructor(args: { code: string; message: string; status?: number; body?: string }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.body = args.body;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRetryableStatus = (status: number) => {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
};

const truncateText = (text: string, max = 2000) => {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
};

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

const isUniqueViolation = (err: any): boolean => {
  const code = String(err?.code || '');
  return code === '23505';
};

const isForeignKeyViolation = (err: any): boolean => {
  const code = String(err?.code || '');
  return code === '23503';
};

const isMissingRpc = (err: any, fnName: string): boolean => {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes(`Could not find the function public.${fnName}`) ||
    message.includes(fnName)
  );
};

const sendCreateAssistantWebhook = async (args: {
  url: string;
  group: GroupRow;
  correlationId: string;
  fetchImpl: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
  maxAttempts?: number;
}) => {
  const { url, group, correlationId, fetchImpl, apiKey } = args;
  const timeoutMs = args.timeoutMs ?? 10_000;
  const maxAttempts = args.maxAttempts ?? 3;

  const payload = {
    id: group.id,
    name: group.name,
    description: group.description,
    organization_id: group.organization_id,
    whatsapp_group_id: group.whatsapp_provider_id,
    provider_phone: group.provider_phone,
    created_at: group.created_at,
    provider: group.provider,
    invite_link: group.invite_link,
    status: group.status,
    has_assistant: group.has_assistant,
    assistant_id: group.assistant_id,
    raw_group: group,
    source: 'supabase.functions.provision-onboarding',
    correlation_id: correlationId,
  };

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawBody = await res.text().catch(() => '');
      const bodyText = truncateText(rawBody);

      if (res.status === 401 || res.status === 403) {
        throw new WebhookError({
          code: 'WEBHOOK_AUTH_FAILED',
          message: `Falha de autenticação no webhook (HTTP ${res.status})`,
          status: res.status,
          body: bodyText,
        });
      }

      if (!res.ok) {
        throw new WebhookError({
          code: 'WEBHOOK_UPSTREAM_FAILED',
          message: `Webhook retornou erro (HTTP ${res.status} ${res.statusText})`,
          status: res.status,
          body: bodyText,
        });
      }

      let parsed: any = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsed = null;
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new WebhookError({
          code: 'WEBHOOK_RESPONSE_INVALID',
          message: 'Webhook retornou um corpo inválido (JSON esperado)',
          status: res.status,
          body: bodyText,
        });
      }

      const okFlag = (parsed as any).success ?? (parsed as any).ok;
      if (okFlag !== true) {
        throw new WebhookError({
          code: 'WEBHOOK_RESPONSE_INVALID',
          message: 'Webhook retornou payload inesperado (success/ok != true)',
          status: res.status,
          body: bodyText,
        });
      }

      return parsed;
    } catch (e: unknown) {
      lastError = e;
      const status = e instanceof WebhookError ? e.status : undefined;
      const retryable = typeof status === 'number' ? isRetryableStatus(status) : true;
      const shouldRetry = attempt < maxAttempts && retryable;
      if (!shouldRetry) throw e;

      const baseDelay = 400 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 150);
      await sleep(baseDelay + jitter);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new WebhookError({ code: 'WEBHOOK_UPSTREAM_FAILED', message: 'Falha desconhecida ao chamar webhook' });
};

export const createProvisionOnboardingHandler = (deps: Deps = {}) => {
  const env = deps.env ?? defaultEnv;
  const createClientImpl = deps.createClient ?? createClient;
  const fetchImpl = deps.fetch ?? fetch;
  const cryptoImpl = deps.crypto ?? crypto;

  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const correlationId = req.headers.get('x-correlation-id') ?? cryptoImpl.randomUUID();

    const json = (body: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify({ correlation_id: correlationId, ...body }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
      });

    try {
      const payload: ProvisionPayload = await req.json();

    console.log('Provisioning onboarding', JSON.stringify({
      correlation_id: correlationId,
      user_id: payload?.lead?.user_id,
      org_name: payload?.organization?.name,
      group_name: payload?.group?.name,
      whatsapp_provider_id: payload?.group?.whatsapp_provider_id,
      participants_count: Array.isArray(payload?.participants) ? payload.participants.length : 0,
    }));

    // Validate required fields
    if (!payload.lead?.user_id || !payload.lead?.email || !payload.lead?.name) {
      return json({ success: false, code: 'LEAD_DATA_INCOMPLETE', message: 'Lead data is incomplete' }, 400);
    }

    if (!payload.organization?.name) {
      return json({ success: false, code: 'ORG_NAME_REQUIRED', message: 'Organization name is required' }, 400);
    }

    if (!payload.group?.name || !payload.group?.whatsapp_provider_id) {
      return json({ success: false, code: 'GROUP_DATA_INCOMPLETE', message: 'Group data is incomplete' }, 400);
    }

    if (payload.group?.provider && payload.group.provider !== 'whatsapp') {
      return json({ success: false, code: 'UNSUPPORTED_PROVIDER', message: 'Only WhatsApp provider is supported' }, 400);
    }

    if (payload.participants && !Array.isArray(payload.participants)) {
      return json({ success: false, code: 'INVALID_PARTICIPANTS', message: 'Participants must be an array' }, 400);
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = env.get('SUPABASE_URL');
    const serviceRoleKey = env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl) {
      return json(
        {
          success: false,
          code: 'SUPABASE_URL_NOT_CONFIGURED',
          message: 'SUPABASE_URL não configurada no ambiente da função',
        },
        500
      );
    }

    if (!serviceRoleKey) {
      return json(
        {
          success: false,
          code: 'SERVICE_ROLE_NOT_CONFIGURED',
          message: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente da função',
        },
        500
      );
    }
    
    const supabase = createClientImpl(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const normalizePhone = (phone: string | null | undefined): string | null => {
      const raw = (phone || '').trim();
      if (!raw) return null;
      if (raw.startsWith('+')) return raw.replace(/\s+/g, '');
      const digits = raw.replace(/\D/g, '');
      if (!digits) return null;
      if (digits.startsWith('55') && digits.length >= 10) return '+' + digits;
      return '+55' + digits;
    };

    const primaryPhone = normalizePhone(payload.lead.whatsapp_phone);

    const hasParticipants = Array.isArray(payload.participants) && payload.participants.length > 0;
    if (!hasParticipants && !primaryPhone) {
      return json(
        {
          success: false,
          code: 'MEMBERS_SOURCE_MISSING',
          message: 'Não foi possível inferir participantes nem telefone do lead para inserir Members',
        },
        400
      );
    }


    let txData: unknown = null;
    let txError: any = null;
    let usedRpc: 'v2' | 'v1' | 'none' = 'v2';

    ({ data: txData, error: txError } = await supabase.rpc('public_onboarding_provision_tx_v2', {
      p_user_id: payload.lead.user_id,
      p_lead_name: payload.lead.name,
      p_lead_email: payload.lead.email,
      p_lead_phone: primaryPhone,
      p_organization_name: payload.organization.name,
      p_group_name: payload.group.name,
      p_group_invite_link: payload.group.invite_link,
      p_group_whatsapp_provider_id: payload.group.whatsapp_provider_id,
      p_participants: payload.participants ?? [],
    }));

    if (txError && isMissingRpc(txError, 'public_onboarding_provision_tx_v2')) {
      console.warn('RPC v2 não encontrada; usando fallback v1', JSON.stringify({
        correlation_id: correlationId,
        code: txError?.code,
        message: txError?.message,
      }));

      ({ data: txData, error: txError } = await supabase.rpc('public_onboarding_provision_tx', {
        p_user_id: payload.lead.user_id,
        p_lead_name: payload.lead.name,
        p_lead_email: payload.lead.email,
        p_lead_phone_e164: primaryPhone,
        p_organization_name: payload.organization.name,
        p_group_name: payload.group.name,
        p_group_invite_link: payload.group.invite_link,
        p_group_whatsapp_provider_id: payload.group.whatsapp_provider_id,
      }));

      usedRpc = 'v1';
    }

    if (txError && isMissingRpc(txError, 'public_onboarding_provision_tx')) {
      console.warn('RPC v1/v2 não encontradas; usando fallback sem transação', JSON.stringify({
        correlation_id: correlationId,
        code: txError?.code,
        message: txError?.message,
      }));

      usedRpc = 'none';

      const leadPhoneE164 = primaryPhone;
      let organizationId: string | null = null;
      let groupId: string | null = null;
      let canSetOwnerUserId = true;

      const cleanupOrg = async () => {
        if (!organizationId) return;
        try {
          if (groupId) {
            await supabase.from('groups').delete().eq('id', groupId);
          }
        } catch {
        }

        try {
          await supabase.from('organization_contacts').delete().eq('organization_id', organizationId);
        } catch {
        }

        try {
          await supabase.from('user_roles').delete().eq('organization_id', organizationId);
        } catch {
        }

        try {
          await supabase.from('events').delete().eq('entity_id', organizationId);
        } catch {
        }

        try {
          await supabase.from('organizations').delete().eq('id', organizationId);
        } catch {
        }
      };

      const tryInsertOrg = async () => {
        const insertBase: any = {
          name: payload.organization.name,
          status: 'active',
        };

        let insertPayload: any = insertBase;
        if (canSetOwnerUserId) {
          insertPayload = { ...insertPayload, owner_user_id: payload.lead.user_id };
        }

        let res = await supabase
          .from('organizations')
          .insert(insertPayload)
          .select('id')
          .maybeSingle();

        if (res.error && isUnknownColumnError(res.error)) {
          res = await supabase
            .from('organizations')
            .insert(insertBase)
            .select('id')
            .maybeSingle();
        }

        if (res.error) throw res.error;
        const data = res.data;
        organizationId = (data as any)?.id ?? null;
        if (!organizationId) throw new Error('Falha ao criar organização');

        const orgPatch: any = {
          contact_name: payload.lead.name,
          contact_email: payload.lead.email,
          contact_phone: leadPhoneE164,
          updated_at: new Date().toISOString(),
        };

        if (canSetOwnerUserId) {
          orgPatch.owner_user_id = payload.lead.user_id;
        }

        const { error: updErr } = await supabase.from('organizations').update(orgPatch).eq('id', organizationId);
        if (updErr && !isUnknownColumnError(updErr)) {
          throw updErr;
        }
      };

      const findExistingGroup = async () => {
        let existing: any = null;
        let err: any = null;
        ({ data: existing, error: err } = await supabase
          .from('groups')
          .select('id, name')
          .eq('whatsapp_provider_id', payload.group.whatsapp_provider_id)
          .maybeSingle());
        if (err && isUnknownColumnError(err)) {
          ({ data: existing, error: err } = await supabase
            .from('groups')
            .select('id, name')
            .eq('provider_group_id', payload.group.whatsapp_provider_id)
            .maybeSingle());
        }
        if (err) throw err;
        return existing;
      };

      const tryInsertGroup = async () => {
        const base: any = {
          organization_id: organizationId,
          name: payload.group.name,
          provider: 'whatsapp',
        };

        let ins: any = {
          ...base,
          whatsapp_provider_id: payload.group.whatsapp_provider_id,
        };

        let res = await supabase.from('groups').insert(ins).select('id').maybeSingle();
        if (res.error && isUnknownColumnError(res.error)) {
          ins = { ...base, provider_group_id: payload.group.whatsapp_provider_id };
          res = await supabase.from('groups').insert(ins).select('id').maybeSingle();
        }

        if (res.error && isUniqueViolation(res.error)) {
          const existing = await findExistingGroup().catch(() => null);
          return json(
            {
              success: false,
              code: 'GROUP_ALREADY_PROVISIONED',
              group_id: existing?.id ?? null,
              group_name: existing?.name ?? null,
              message: existing?.name
                ? `Esse grupo já foi cadastrado como "${existing.name}".`
                : 'Esse grupo já foi cadastrado.',
            },
            409
          );
        }

        if (res.error) throw res.error;
        groupId = (res.data as any)?.id ?? null;
        if (!groupId) throw new Error('Falha ao criar grupo');

        const groupPatch: any = {
          invite_link: payload.group.invite_link,
          invite_link_status: 'valid',
          status: 'active',
          is_active: true,
          is_archived: false,
          updated_at: new Date().toISOString(),
        };

        const { error: groupUpdErr } = await supabase.from('groups').update(groupPatch).eq('id', groupId);
        if (groupUpdErr && !isUnknownColumnError(groupUpdErr)) {
          throw groupUpdErr;
        }
      };

      const upsertProfile = async () => {
        const now = new Date().toISOString();

        const fullProfile: any = {
          id: payload.lead.user_id,
          name: payload.lead.name,
          phone_e164: leadPhoneE164,
          status: 'active',
          updated_at: now,
        };

        let { error } = await supabase.from('profiles').upsert(fullProfile, { onConflict: 'id' });
        if (!error) return;

        if (isForeignKeyViolation(error)) {
          canSetOwnerUserId = false;
          return;
        }

        if (isUnknownColumnError(error)) {
          const minimalProfile: any = {
            id: payload.lead.user_id,
          };
          const retry = await supabase.from('profiles').upsert(minimalProfile, { onConflict: 'id' });
          if (retry.error) {
            canSetOwnerUserId = false;
            if (isForeignKeyViolation(retry.error) || isUnknownColumnError(retry.error)) return;
            throw retry.error;
          }
          return;
        }

        throw error;
      };

      const upsertPrimaryContact = async () => {
        const contact: any = {
          organization_id: organizationId,
          user_id: payload.lead.user_id,
          name: payload.lead.name,
          email: payload.lead.email,
          phone: leadPhoneE164,
          role_title: 'responsável principal',
          contact_role: 'responsavel_principal',
          is_primary: true,
          updated_at: new Date().toISOString(),
        };
        const { error: insErr } = await supabase
          .from('organization_contacts')
          .insert(contact);

        if (!insErr) return;
        if (isUnknownColumnError(insErr)) return;
        if (!isUniqueViolation(insErr)) throw insErr;

        const { data: existing, error: selErr } = await supabase
          .from('organization_contacts')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_primary', true)
          .maybeSingle();
        if (selErr && !isUnknownColumnError(selErr)) throw selErr;

        if (existing?.id) {
          const { error: updErr } = await supabase
            .from('organization_contacts')
            .update({
              user_id: payload.lead.user_id,
              name: payload.lead.name,
              email: payload.lead.email,
              phone: leadPhoneE164,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (updErr && !isUnknownColumnError(updErr)) throw updErr;
        }
      };

      const insertMembersFromParticipants = async () => {
        if (!groupId) return;
        await insertMembersFromParticipantsForGroup({ supabase, groupId, participants: payload.participants });
      };

      const insertOrgAdminRole = async () => {
        const row: any = {
          user_id: payload.lead.user_id,
          role: 'ORG_ADMIN',
          organization_id: organizationId,
          group_id: null,
        };
        const { error } = await supabase.from('user_roles').insert(row);
        if (error && isForeignKeyViolation(error)) return;
        if (error && !isUniqueViolation(error) && !isUnknownColumnError(error)) throw error;
      };

      const insertEvent = async () => {
        const evt: any = {
          event_type: 'ONBOARDING_COMPLETED',
          entity_type: 'organization',
          entity_id: organizationId,
          user_id: payload.lead.user_id,
          metadata: {
            organization_name: payload.organization.name,
            group_name: payload.group.name,
            whatsapp_provider_id: payload.group.whatsapp_provider_id,
          },
        };
        const { error } = await supabase.from('events').insert(evt);
        if (error && isForeignKeyViolation(error)) return;
        if (error && !isUnknownColumnError(error)) throw error;
      };

      try {
        await upsertProfile();
        await tryInsertOrg();
        const conflictResponse = await tryInsertGroup();
        if (conflictResponse) {
          await cleanupOrg();
          return conflictResponse;
        }
        await upsertPrimaryContact();
        await insertMembersFromParticipants();
        await insertOrgAdminRole();
        await insertEvent();

        txData = [{ organization_id: organizationId, group_id: groupId }];
        txError = null;
      } catch (e: any) {
        await cleanupOrg();
        return json(
          {
            success: false,
            code: 'ONBOARDING_FALLBACK_FAILED',
            message: `Falha no provisionamento (fallback): ${e?.message || String(e)}`,
          },
          500
        );
      }
    }

    if (txError) {
      console.error('Error provisioning onboarding (tx)', JSON.stringify({
        correlation_id: correlationId,
        code: (txError as any)?.code,
        message: (txError as any)?.message,
        details: (txError as any)?.details,
        hint: (txError as any)?.hint,
      }));
      if ((txError as any)?.code === '23505') {
        const { data: existingGroup } = await supabase
          .from('groups')
          .select('id, name')
          .eq('whatsapp_provider_id', payload.group.whatsapp_provider_id)
          .maybeSingle();

        return json(
          {
            success: false,
            code: 'GROUP_ALREADY_PROVISIONED',
            group_id: existingGroup?.id ?? null,
            group_name: existingGroup?.name ?? null,
            message: existingGroup?.name
              ? `Esse grupo já foi cadastrado como "${existingGroup.name}".`
              : 'Esse grupo já foi cadastrado.',
          },
          409
        );
      }
      return json(
        {
          success: false,
          code: 'ONBOARDING_TX_FAILED',
          message: `Falha no provisionamento: ${txError.message}`,
        },
        500
      );
    }

    const row = Array.isArray(txData) ? txData[0] : null;
    const organizationId = row?.organization_id as string | undefined;
    const groupId = row?.group_id as string | undefined;
    if (!organizationId || !groupId) {
      return json(
        {
          success: false,
          code: 'ONBOARDING_TX_EMPTY',
          message: 'Provisionamento retornou vazio',
        },
        500
      );
    }

    const cleanupOrg = async () => {
      try {
        await supabase.from('groups').delete().eq('id', groupId);
      } catch {
      }

      try {
        await supabase.from('organization_contacts').delete().eq('organization_id', organizationId);
      } catch {
      }

      try {
        await supabase.from('user_roles').delete().eq('organization_id', organizationId);
      } catch {
      }

      try {
        await supabase.from('events').delete().eq('entity_id', organizationId);
      } catch {
      }

      try {
        await supabase.from('organizations').delete().eq('id', organizationId);
      } catch {
      }
    };

    const participantsForMembers = (() => {
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      if (participants.length > 0) return participants;
      return [
        {
          phone: primaryPhone,
          name: payload.lead.name,
          is_admin: true,
          is_super_admin: true,
          is_owner: true,
          whatsapp_provider_id: `lead:${payload.lead.user_id}`,
        },
      ];
    })();

    console.log('Inserção automática de Members baseada nos participantes (obrigatória)', JSON.stringify({
      correlation_id: correlationId,
      organization_id: organizationId,
      group_id: groupId,
      used_rpc: usedRpc,
      participants_count: Array.isArray(payload.participants) ? payload.participants.length : 0,
      members_source: Array.isArray(payload.participants) && payload.participants.length > 0 ? 'participants' : 'lead_fallback',
    }));

    try {
      const stats = await insertMembersFromParticipantsForGroup({ supabase, groupId, participants: participantsForMembers });

      console.log('Inserção automática de Members finalizada', JSON.stringify({
        correlation_id: correlationId,
        organization_id: organizationId,
        group_id: groupId,
        used_rpc: usedRpc,
        ...(stats ? { members_insert: stats } : {}),
      }));
    } catch (e: any) {
      console.error('Falha na inserção automática obrigatória de Members', JSON.stringify({
        correlation_id: correlationId,
        organization_id: organizationId,
        group_id: groupId,
        used_rpc: usedRpc,
        message: e?.message || String(e),
      }));

      await cleanupOrg();

      return json(
        {
          success: false,
          code: 'MEMBERS_AUTO_INSERT_FAILED',
          message: 'Falha ao inserir Members automaticamente durante o onboarding',
        },
        500
      );
    }

    try {
      const { data: groupRow, error: groupErr } = await supabase
        .from('groups')
        .select('id, organization_id')
        .eq('id', groupId)
        .maybeSingle();

      if (groupErr) throw groupErr;
      if (!groupRow?.id) throw new Error('Grupo não encontrado após provisionamento');
      if ((groupRow as any).organization_id && (groupRow as any).organization_id !== organizationId) {
        throw new Error('Inconsistência: group.organization_id não bate com organizationId retornado');
      }

      const { count: membersCount, error: membersCountErr } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId);

      if (membersCountErr) throw membersCountErr;
      const n = Number(membersCount || 0);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error('Nenhum Member encontrado após inserção automática');
      }

      console.log('Inserção automática de Members validada com sucesso', JSON.stringify({
        correlation_id: correlationId,
        organization_id: organizationId,
        group_id: groupId,
        members_count: n,
      }));
    } catch (e: any) {
      console.error('Falha ao validar integridade após inserção automática de Members', JSON.stringify({
        correlation_id: correlationId,
        organization_id: organizationId,
        group_id: groupId,
        message: e?.message || String(e),
      }));

      await cleanupOrg();

      return json(
        {
          success: false,
          code: 'MEMBERS_INTEGRITY_FAILED',
          message: 'Falha ao validar integridade após inserir Members automaticamente',
        },
        500
      );
    }

    const createAssistantWebhookUrl =
      env.get('VITE_N8N_WEBHOOK_CREATE_ASSISTANT_URL') ||
      env.get('N8N_WEBHOOK_CREATE_ASSISTANT_URL');

    const createAssistantWebhookApiKey =
      env.get('N8N_WEBHOOK_CREATE_ASSISTANT_API_KEY') ||
      env.get('VITE_N8N_WEBHOOK_CREATE_ASSISTANT_API_KEY') ||
      env.get('N8N_WEBHOOK_API_KEY') ||
      env.get('VITE_N8N_WEBHOOK_API_KEY');

    if (!createAssistantWebhookUrl) {
      console.error('Webhook de criação de assistant não configurado', JSON.stringify({
        correlation_id: correlationId,
      }));

      try {
        await supabase
          .from('events')
          .insert({
            event_type: 'ONBOARDING_WEBHOOK_FAILED',
            entity_type: 'group',
            entity_id: groupId,
            user_id: payload.lead.user_id,
            metadata: {
              organization_id: organizationId,
              code: 'WEBHOOK_NOT_CONFIGURED',
              correlation_id: correlationId,
            },
          });
      } catch {
      }

      await cleanupOrg();
      return json(
        {
          success: false,
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'Webhook de criação do assistente não está configurado',
        },
        500
      );
    } else {
      try {
        const { data: groupRow, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .maybeSingle();

        if (groupError) {
          throw groupError;
        }

        const fallbackGroup: GroupRow = {
          id: groupId,
          name: payload.group.name,
          description: null,
          organization_id: organizationId,
          provider: 'whatsapp',
          whatsapp_provider_id: payload.group.whatsapp_provider_id,
          provider_phone: null,
          invite_link: payload.group.invite_link,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assistant_id: null,
          has_assistant: false,
          metadata: null,
          raw_provider: null,
          status: null,
          sync_status: null,
          sync_error: null,
        };

        await sendCreateAssistantWebhook({
          url: createAssistantWebhookUrl,
          group: (groupRow as GroupRow) ?? fallbackGroup,
          correlationId,
          fetchImpl,
          apiKey: createAssistantWebhookApiKey,
          maxAttempts: 3,
          timeoutMs: 10_000,
        });
      } catch (e: unknown) {
        const code = e instanceof WebhookError ? e.code : 'WEBHOOK_UPSTREAM_FAILED';
        const status = e instanceof WebhookError ? e.status : undefined;
        const body = e instanceof WebhookError ? e.body : undefined;
        const message = e instanceof Error ? e.message : String(e);

        console.error('Falha ao chamar/validar webhook de criação de assistant', JSON.stringify({
          correlation_id: correlationId,
          code,
          status,
          message,
        }));

        try {
          await supabase
            .from('events')
            .insert({
              event_type: 'ONBOARDING_WEBHOOK_FAILED',
              entity_type: 'group',
              entity_id: groupId,
              user_id: payload.lead.user_id,
              metadata: {
                organization_id: organizationId,
                code,
                status,
                message,
                body,
                correlation_id: correlationId,
              },
            });
        } catch {
        }

        await cleanupOrg();

        const httpStatus = code === 'WEBHOOK_AUTH_FAILED' ? 502 : 502;
        return json(
          {
            success: false,
            code,
            message: 'Falha ao validar o webhook. Onboarding interrompido.',
          },
          httpStatus
        );
      }
    }

    console.log('Onboarding provisioning completed successfully');

    return json({
      success: true,
      organization_id: organizationId,
      group_id: groupId,
      message: 'Onboarding completed successfully',
    });

  } catch (error: unknown) {
    console.error('Error in provision-onboarding', JSON.stringify({
      correlation_id: correlationId,
      message: error instanceof Error ? error.message : String(error),
    }));
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ success: false, code: 'UNEXPECTED_ERROR', message }, 500);
    }
  };
};

serve(createProvisionOnboardingHandler());
