import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_GROUP_ID = "bd0f288d-310b-47d4-bca5-e10da4beb2ab";

type Payload = {
  group_id: string;
  operation?: "full_sync" | "clean_sync" | string;
  triggered_by_user_id?: string | null;
};

type N8nParticipant = {
  phone: string;
  name?: string | null;
  whatsapp_provider_id?: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  lid?: string;
};

function toE164(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.length > 18) return null;
  if (digits.startsWith("55") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function uniqStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function env(key: string): string | undefined {
  return (globalThis as any)?.Deno?.env?.get?.(key);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, code: "AUTH_REQUIRED", message: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    const groupId = (payload?.group_id || "").trim();
    if (!groupId) {
      return new Response(JSON.stringify({ success: false, code: "GROUP_ID_REQUIRED", message: "group_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = env("SUPABASE_URL")!;
    const supabaseAnonKey = env("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, code: "AUTH_INVALID", message: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = payload.triggered_by_user_id || userData.user.id;
    const operationRaw = (payload.operation || "full_sync").toString().trim() || "full_sync";

    const { data: group, error: groupError } = await supabaseUser
      .from("groups")
      .select("id, name, invite_link, whatsapp_provider_id, provider, organization_id, is_test")
      .eq("id", groupId)
      .is("deleted_at", null)
      .maybeSingle();

    if (groupError || !group) {
      return new Response(JSON.stringify({ success: false, code: "GROUP_NOT_FOUND", message: "Grupo não encontrado ou sem acesso" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((group.provider || "") !== "whatsapp") {
      return new Response(JSON.stringify({ success: false, code: "UNSUPPORTED_PROVIDER", message: "Apenas grupos WhatsApp" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowAny = (env("ALLOW_ANY_GROUP_SYNC") || "").toLowerCase() === "true";
    const isTestGroup = !!(group as any)?.is_test;
    const operation = operationRaw === "clean_sync" ? "clean_sync" : "full_sync";

    if (operation === "clean_sync") {
      if (!isTestGroup) {
        return new Response(
          JSON.stringify({ success: false, code: "NOT_ALLOWED", message: "Modo limpeza disponível apenas para grupos de teste" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      if (!allowAny && !isTestGroup && groupId !== TEST_GROUP_ID) {
        return new Response(
          JSON.stringify({ success: false, code: "NOT_ENABLED", message: "Sincronização não habilitada para este grupo" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const inviteLink = (group.invite_link || "").trim();
    if (!inviteLink) {
      return new Response(
        JSON.stringify({ success: false, code: "INVITE_LINK_REQUIRED", message: "Grupo não tem invite_link para validação" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const n8nWebhookUrl = env("N8N_VALIDATE_GROUP_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      return new Response(JSON.stringify({ success: false, code: "N8N_NOT_CONFIGURED", message: "Webhook URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_link: inviteLink }),
    });

    if (!n8nResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "WHATSAPP_FETCH_FAILED",
          message: "Não foi possível buscar os participantes do grupo no WhatsApp agora. Tente novamente mais tarde.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const n8nData = await n8nResponse.json();
    if (n8nData && typeof n8nData === "object" && !Array.isArray(n8nData) && (n8nData as any).checkBotEnabled === false) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "BORIS_NOT_IN_GROUP",
          message: "O Bóris não está no grupo. Não é possível sincronizar agora.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(n8nData) || n8nData.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "UNEXPECTED_PROVIDER_RESPONSE",
          message: "Resposta inesperada ao buscar participantes do WhatsApp.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const providerGroup = n8nData[0] as any;
    const providerParticipants = (providerGroup?.participants || []) as N8nParticipant[];
    const providerGroupId = (providerGroup?.phone || "") as string;

    const normalizedParticipants = providerParticipants
      .map((p) => {
        const phoneE164 = toE164(p.phone);
        const whatsappProviderId = (p.whatsapp_provider_id || p.lid || p.phone || "").toString().trim();
        return {
          phone_raw: (p.phone || "").toString(),
          phone_e164: phoneE164,
          whatsapp_provider_id: whatsappProviderId || null,
          is_admin: !!(p.isAdmin || p.isSuperAdmin),
          is_super_admin: !!p.isSuperAdmin,
          name: (p.name || "").toString().trim() || null,
        };
      })
      .filter((p) => !!p.phone_e164 && !!p.whatsapp_provider_id);

    const participantsUnique: typeof normalizedParticipants = [];
    const seenParticipantKeys = new Set<string>();
    for (const p of normalizedParticipants) {
      const key = (p.whatsapp_provider_id || p.phone_e164 || "").trim();
      if (!key) continue;
      if (seenParticipantKeys.has(key)) continue;
      seenParticipantKeys.add(key);
      participantsUnique.push(p);
    }

    const waPhones = new Set(participantsUnique.map((p) => p.phone_e164!).filter(Boolean));
    const waProviderIds = new Set(participantsUnique.map((p) => p.whatsapp_provider_id!).filter(Boolean));

    const { data: members, error: membersError } = await supabaseUser
      .from("members")
      .select(
        "id, name, display_name, profile_pic_url, phone_e164, provider_member_id, whatsapp_provider_id, lid, status, joined_at, first_seen_at, left_at, deleted_at, last_seen_message_at, is_admin, is_super_admin, is_owner, updated_at, name_detected",
      )
      .eq("group_id", groupId)
      .is("deleted_at", null);

    if (membersError) {
      return new Response(JSON.stringify({ success: false, code: "MEMBERS_FETCH_FAILED", message: membersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existing = (members || []) as Array<{
      id: string;
      name: string | null;
      display_name: string | null;
      profile_pic_url: string | null;
      phone_e164: string | null;
      provider_member_id: string | null;
      whatsapp_provider_id: string | null;
      lid: string | null;
      status: string | null;
      joined_at: string | null;
      first_seen_at: string | null;
      left_at: string | null;
      last_seen_message_at: string | null;
      is_admin: boolean | null;
      is_super_admin: boolean | null;
      is_owner: boolean | null;
      updated_at: string | null;
      name_detected: string | null;
    }>;

    if (operation === "clean_sync") {
      const operationId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const { data: deletedMembers } = await supabaseUser
        .from("members")
        .select(
          "id, name, display_name, profile_pic_url, phone_e164, provider_member_id, whatsapp_provider_id, lid, status, left_at, deleted_at, last_seen_message_at, is_admin, is_super_admin, is_owner, updated_at, name_detected",
        )
        .eq("group_id", groupId)
        .not("deleted_at", "is", null);

      const deletedExisting = (deletedMembers || []) as Array<{
        id: string;
        phone_e164: string | null;
        provider_member_id: string | null;
        deleted_at: string | null;
      }>;

      const { data: overviewRows } = await supabaseUser
        .from("vw_groups_members")
        .select("member_id, messages_count, last_message_at")
        .eq("group_id", groupId);

      const msgCountByMemberId = new Map<string, number>();
      const lastMsgAtByMemberId = new Map<string, string | null>();
      (overviewRows || []).forEach((r: any) => {
        const id = (r?.member_id || "").toString();
        if (!id) return;
        msgCountByMemberId.set(id, Number(r?.messages_count ?? 0));
        lastMsgAtByMemberId.set(id, (r?.last_message_at as string | null) ?? null);
      });

      const pickBest = (list: typeof existing): (typeof existing)[number] | null => {
        if (!list.length) return null;
        const sorted = [...list].sort((a, b) => {
          const ca = msgCountByMemberId.get(a.id) ?? 0;
          const cb = msgCountByMemberId.get(b.id) ?? 0;
          if (cb !== ca) return cb - ca;
          const ua = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const ub = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          if (ub !== ua) return ub - ua;
          return a.id.localeCompare(b.id);
        });
        return sorted[0] || null;
      };

      const byPhone = new Map<string, typeof existing>();
      const byProvider = new Map<string, typeof existing>();
      for (const m of existing) {
        if (m.phone_e164) {
          const k = m.phone_e164.trim();
          const list = byPhone.get(k) || [];
          list.push(m);
          byPhone.set(k, list);
        }
        const pid = (m.provider_member_id || m.whatsapp_provider_id || m.lid || "").trim();
        if (pid) {
          const list = byProvider.get(pid) || [];
          list.push(m);
          byProvider.set(pid, list);
        }
      }

      const deletedByPhone = new Map<string, typeof deletedExisting>();
      const deletedByProvider = new Map<string, typeof deletedExisting>();
      for (const m of deletedExisting) {
        if (m.phone_e164) {
          const k = m.phone_e164.trim();
          const list = deletedByPhone.get(k) || [];
          list.push(m);
          deletedByPhone.set(k, list);
        }
        const pid = (m.provider_member_id || "").trim();
        if (pid) {
          const list = deletedByProvider.get(pid) || [];
          list.push(m);
          deletedByProvider.set(pid, list);
        }
      }

      const pickMostRecentlyDeleted = (list: typeof deletedExisting): (typeof deletedExisting)[number] | null => {
        if (!list.length) return null;
        const sorted = [...list].sort((a, b) => {
          const da = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
          const db = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
          if (db !== da) return db - da;
          return a.id.localeCompare(b.id);
        });
        return sorted[0] || null;
      };

      const keptMemberIds = new Set<string>();
      const memberIdsToRemove = new Set<string>();
      const membersToUpdateRole: Array<{ memberId: string; isAdmin: boolean; isSuperAdmin: boolean; detectedName: string | null }> = [];
      const membersToRestore: Array<{ memberId: string; isAdmin: boolean; isSuperAdmin: boolean }> = [];
      const membersToInsert: Array<any> = [];

      const safeName = (name: string | null | undefined): string | null => {
        const v = (name || "").toString().trim();
        return v.length ? v : null;
      };

      for (const p of participantsUnique) {
        const phone = p.phone_e164!.trim();
        const pid = (p.whatsapp_provider_id || "").trim();
        const candidatesByPid = pid ? byProvider.get(pid) || [] : [];
        const candidatesByPhone = byPhone.get(phone) || [];
        const selected = pickBest(candidatesByPid.length ? candidatesByPid : candidatesByPhone);

        if (selected) {
          keptMemberIds.add(selected.id);
          const detected = safeName(p.name);
          const shouldSaveDetected = !!detected && (detected || "").trim() !== ((selected.name || "").trim() || (selected.display_name || "").trim());
          membersToUpdateRole.push({
            memberId: selected.id,
            isAdmin: !!(p.is_admin || p.is_super_admin),
            isSuperAdmin: !!p.is_super_admin,
            detectedName: shouldSaveDetected ? detected : null,
          });

          for (const extra of (candidatesByPid.length ? candidatesByPid : candidatesByPhone)) {
            if (extra.id !== selected.id) {
              memberIdsToRemove.add(extra.id);
            }
          }
          continue;
        }

        const deletedCandidatesByPid = pid ? deletedByProvider.get(pid) || [] : [];
        const deletedCandidatesByPhone = deletedByPhone.get(phone) || [];
        const restoreCandidate = pickMostRecentlyDeleted(deletedCandidatesByPid.length ? deletedCandidatesByPid : deletedCandidatesByPhone);

        if (restoreCandidate) {
          membersToRestore.push({
            memberId: restoreCandidate.id,
            isAdmin: !!(p.is_admin || p.is_super_admin),
            isSuperAdmin: !!p.is_super_admin,
          });
          keptMemberIds.add(restoreCandidate.id);
          continue;
        }

        membersToInsert.push({
          group_id: groupId,
          name: safeName(p.name) || p.phone_raw,
          phone_e164: p.phone_e164,
          is_admin: !!(p.is_admin || p.is_super_admin),
          is_super_admin: !!p.is_super_admin,
          whatsapp_provider_id: pid || null,
          provider: "whatsapp",
          first_seen_at: nowIso,
          joined_at: nowIso,
          status: "active",
        });
      }

      for (const m of existing) {
        if (keptMemberIds.has(m.id)) continue;
        memberIdsToRemove.add(m.id);
      }

      const membersKeptCount = keptMemberIds.size;
      const membersToRemoveList = uniqStrings(Array.from(memberIdsToRemove));

      if (membersToUpdateRole.length > 0) {
        const updates = membersToUpdateRole.map((u) => {
          const patch: Record<string, any> = {
            id: u.memberId,
            is_admin: u.isAdmin,
            is_super_admin: u.isSuperAdmin,
            status: "active",
            left_at: null,
          };
          if (u.detectedName) patch.name_detected = u.detectedName;
          return patch;
        });

        const { error: updateRoleError } = await supabaseUser.from("members").upsert(updates, { onConflict: "id" });
        if (updateRoleError) {
          return new Response(
            JSON.stringify({ success: false, code: "UPDATE_ROLES_FAILED", message: "Falha ao atualizar papéis: " + updateRoleError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (membersToRestore.length > 0) {
        const restoreIds = uniqStrings(membersToRestore.map((m) => m.memberId));
        const { error: restoreError } = await supabaseUser
          .from("members")
          .update({ deleted_at: null, status: "active", left_at: null })
          .in("id", restoreIds);
        if (restoreError) {
          return new Response(
            JSON.stringify({ success: false, code: "RESTORE_FAILED", message: "Falha ao reativar membros: " + restoreError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const rolePatches = membersToRestore.map((m) => ({ id: m.memberId, is_admin: m.isAdmin, is_super_admin: m.isSuperAdmin }));
        const { error: restoreRolesError } = await supabaseUser.from("members").upsert(rolePatches, { onConflict: "id" });
        if (restoreRolesError) {
          return new Response(
            JSON.stringify({ success: false, code: "RESTORE_ROLES_FAILED", message: "Falha ao atualizar papéis: " + restoreRolesError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (membersToInsert.length > 0) {
        const { error: insertError } = await supabaseUser.from("members").insert(membersToInsert);
        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, code: "ADD_FAILED", message: "Falha ao criar membros: " + insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      let archivedCount = 0;
      if (membersToRemoveList.length > 0) {
        const removedMembers = existing.filter((m) => memberIdsToRemove.has(m.id));

        const archiveRows = removedMembers.map((m) => ({
          operation_id: operationId,
          source: "sync_limpeza_zapi",
          group_id: groupId,
          member_id: m.id,
          phone_e164: m.phone_e164,
          provider_member_id: m.provider_member_id || m.whatsapp_provider_id || m.lid,
          member_name: m.name,
          member_display_name: m.display_name,
          profile_pic_url: m.profile_pic_url,
          joined_at: null,
          left_at: m.left_at,
          status: m.status,
          last_seen_message_at: m.last_seen_message_at,
          total_messages: msgCountByMemberId.get(m.id) ?? 0,
          last_message_at: lastMsgAtByMemberId.get(m.id) ?? null,
          cleaned_at: nowIso,
          metadata: {
            reason: waPhones.has((m.phone_e164 || "").trim()) || waProviderIds.has((m.provider_member_id || "").trim()) ? "duplicate" : "not_in_zapi",
          },
        }));

        const { error: archiveError } = await supabaseUser.from("group_members_archive").insert(archiveRows);
        if (archiveError) {
          return new Response(
            JSON.stringify({ success: false, code: "ARCHIVE_FAILED", message: "Falha ao arquivar membros: " + archiveError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        archivedCount = archiveRows.length;

        const { error: deleteError } = await supabaseUser
          .from("members")
          .update({ deleted_at: nowIso, status: "inactive", left_at: nowIso })
          .in("id", membersToRemoveList)
          .is("deleted_at", null);

        if (deleteError) {
          return new Response(
            JSON.stringify({ success: false, code: "CLEAN_REMOVE_FAILED", message: "Falha ao remover vínculo com o grupo: " + deleteError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (providerGroupId && !group.whatsapp_provider_id) {
        await supabaseUser
          .from("groups")
          .update({ whatsapp_provider_id: providerGroupId })
          .eq("id", groupId)
          .is("deleted_at", null);
      }

      const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await supabaseAdmin.from("events").insert({
        event_type: "GROUP_MEMBERS_SYNC",
        entity_type: "group",
        entity_id: groupId,
        user_id: actorUserId,
        metadata: {
          operation,
          operation_id: operationId,
          group_name: group.name,
          provider_group_id: providerGroupId || null,
          whatsapp_participants_count: participantsUnique.length,
          kept_count: membersKeptCount,
          added_count: membersToInsert.length,
          restored_count: membersToRestore.length,
          removed_archived_count: archivedCount,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          group_id: groupId,
          group_name: group.name,
          whatsapp_group_id: providerGroupId || group.whatsapp_provider_id || null,
          whatsapp_participants_count: participantsUnique.length,
          members_kept_count: membersKeptCount,
          members_added_count: membersToInsert.length,
          members_restored_count: membersToRestore.length,
          members_removed_archived_count: archivedCount,
          operation_id: operationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const byPhone = new Map<string, typeof existing>();
    const byProvider = new Map<string, typeof existing>();
    for (const m of existing) {
      if (m.phone_e164) {
        const k = m.phone_e164.trim();
        const list = byPhone.get(k) || [];
        list.push(m);
        byPhone.set(k, list);
      }
      const pid = (m.whatsapp_provider_id || m.lid || "").trim();
      if (pid) {
        const list = byProvider.get(pid) || [];
        list.push(m);
        byProvider.set(pid, list);
      }
    }

    const duplicatePhones = new Set(Array.from(byPhone.entries()).filter(([, list]) => list.length > 1).map(([k]) => k));
    const duplicateProviders = new Set(Array.from(byProvider.entries()).filter(([, list]) => list.length > 1).map(([k]) => k));

    const participantByPhone = new Map<string, (typeof participantsUnique)[number]>();
    const participantByProvider = new Map<string, (typeof participantsUnique)[number]>();
    for (const p of participantsUnique) {
      const phone = (p.phone_e164 || "").trim();
      if (phone) participantByPhone.set(phone, p);
      const pid = (p.whatsapp_provider_id || "").trim();
      if (pid) participantByProvider.set(pid, p);
    }

    const nowIso = new Date().toISOString();

    const membersToMarkLeft: string[] = [];
    const membersNeedLeftAt: string[] = [];
    const membersAlreadyHaveLeftAt: string[] = [];
    const membersToReactivate: string[] = [];
    const membersOk: string[] = [];
    const skippedWeird: string[] = [];

    const membersToSetJoinedAt: string[] = [];
    const membersToSetWhatsappProviderId: Array<{ id: string; whatsappProviderId: string }> = [];

    for (const m of existing) {
      const phone = m.phone_e164 ? m.phone_e164.trim() : "";
      const pid = (m.whatsapp_provider_id || m.lid || "").trim();
      const hasPhone = !!phone;
      const hasPid = !!pid;
      const inWa = (hasPhone && waPhones.has(phone)) || (hasPid && waProviderIds.has(pid));
      if (inWa) {
        membersOk.push(m.id);
        if (!m.joined_at) {
          membersToSetJoinedAt.push(m.id);
        }
        if (!m.whatsapp_provider_id) {
          const match = (hasPhone ? participantByPhone.get(phone) : null) || (hasPid ? participantByProvider.get(pid) : null);
          const nextPid = (match?.whatsapp_provider_id || phone.replace(/\D/g, "")).trim();
          if (nextPid) {
            membersToSetWhatsappProviderId.push({ id: m.id, whatsappProviderId: nextPid });
          }
        }
        if (m.left_at || (m.status || "").toLowerCase() === "inactive") {
          if (!hasPhone || duplicatePhones.has(phone) || (hasPid && duplicateProviders.has(pid))) {
            skippedWeird.push(m.id);
          } else {
            membersToReactivate.push(m.id);
          }
        }
        continue;
      }

      if (!hasPhone && !hasPid) {
        skippedWeird.push(m.id);
        continue;
      }
      if (hasPhone && duplicatePhones.has(phone)) {
        skippedWeird.push(m.id);
        continue;
      }
      if (hasPid && duplicateProviders.has(pid)) {
        skippedWeird.push(m.id);
        continue;
      }

      membersToMarkLeft.push(m.id);
      if (m.left_at) {
        membersAlreadyHaveLeftAt.push(m.id);
      } else {
        membersNeedLeftAt.push(m.id);
      }
    }

    const toAdd = participantsUnique.filter((p) => {
      const phone = p.phone_e164!.trim();
      const pid = (p.whatsapp_provider_id || "").trim();
      if (duplicatePhones.has(phone) || (pid && duplicateProviders.has(pid))) return false;
      const byPhoneList = byPhone.get(phone) || [];
      if (byPhoneList.length) return false;
      const byPidList = pid ? byProvider.get(pid) || [] : [];
      if (byPidList.length) return false;
      return true;
    });

    if (membersToSetJoinedAt.length > 0) {
      const { error: fixJoinedError } = await supabaseUser
        .from("members")
        .update({ joined_at: nowIso, status: "active", left_at: null })
        .in("id", uniqStrings(membersToSetJoinedAt))
        .is("joined_at", null)
        .is("deleted_at", null);

      if (fixJoinedError) {
        return new Response(
          JSON.stringify({ success: false, code: "FIX_JOINED_AT_FAILED", message: "Falha ao corrigir joined_at: " + fixJoinedError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (membersToSetWhatsappProviderId.length > 0) {
      const patches = membersToSetWhatsappProviderId.filter((p) => !!p.whatsappProviderId);
      for (let i = 0; i < patches.length; i += 25) {
        const chunk = patches.slice(i, i + 25);
        const results: Array<{ error: { message?: string } | null }> = await Promise.all(
          chunk.map(async (p) => {
            const { error } = await supabaseUser
              .from("members")
              .update({ whatsapp_provider_id: p.whatsappProviderId })
              .eq("id", p.id)
              .is("whatsapp_provider_id", null)
              .is("deleted_at", null);
            return { error: (error as any) };
          }),
        );
        const firstErr = results.find((r) => !!r.error)?.error || undefined;
        if (firstErr) {
          return new Response(
            JSON.stringify({
              success: false,
              code: "FIX_PROVIDER_ID_FAILED",
              message: "Falha ao corrigir whatsapp_provider_id: " + (firstErr.message || "Erro desconhecido"),
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    if (membersToReactivate.length > 0) {
      const { error: reactivateError } = await supabaseUser
        .from("members")
        .update({ left_at: null, status: "active" })
        .in("id", uniqStrings(membersToReactivate))
        .is("deleted_at", null);

      if (reactivateError) {
        return new Response(
          JSON.stringify({ success: false, code: "REACTIVATE_FAILED", message: "Falha ao reativar membros: " + reactivateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (membersNeedLeftAt.length > 0) {
      const { error: leftError } = await supabaseUser
        .from("members")
        .update({ left_at: nowIso, status: "inactive" })
        .in("id", uniqStrings(membersNeedLeftAt))
        .is("left_at", null)
        .is("deleted_at", null);

      if (leftError) {
        return new Response(
          JSON.stringify({ success: false, code: "MARK_LEFT_FAILED", message: "Falha ao marcar membros como fora do grupo: " + leftError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (membersAlreadyHaveLeftAt.length > 0) {
      const { error: leftError2 } = await supabaseUser
        .from("members")
        .update({ status: "inactive" })
        .in("id", uniqStrings(membersAlreadyHaveLeftAt))
        .is("deleted_at", null);

      if (leftError2) {
        return new Response(
          JSON.stringify({ success: false, code: "MARK_LEFT_FAILED", message: "Falha ao marcar membros como fora do grupo: " + leftError2.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (toAdd.length > 0) {
        const membersToInsert = toAdd.map((p) => ({
          group_id: groupId,
          name: p.name || p.phone_raw,
          phone_e164: p.phone_e164,
          is_admin: p.is_admin || false,
          is_super_admin: p.is_super_admin || false,
          whatsapp_provider_id: p.whatsapp_provider_id,
          provider: "whatsapp",
          first_seen_at: nowIso,
          joined_at: nowIso,
          status: "active",
        }));

      const { error: insertError } = await supabaseUser.from("members").insert(membersToInsert);
      if (insertError) {
        return new Response(
          JSON.stringify({ success: false, code: "ADD_FAILED", message: "Falha ao criar membros: " + insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (providerGroupId && !group.whatsapp_provider_id) {
      await supabaseUser
        .from("groups")
        .update({ whatsapp_provider_id: providerGroupId })
        .eq("id", groupId)
        .is("deleted_at", null);
    }

    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabaseAdmin.from("events").insert({
      event_type: "GROUP_MEMBERS_SYNC",
      entity_type: "group",
      entity_id: groupId,
      user_id: actorUserId,
      metadata: {
        operation: payload.operation || "full_sync",
        group_name: group.name,
        provider_group_id: providerGroupId || null,
        whatsapp_participants_count: participantsUnique.length,
        added_count: toAdd.length,
        marked_left_count: membersToMarkLeft.length,
        reactivated_count: membersToReactivate.length,
        ok_count: membersOk.length,
        skipped_count: skippedWeird.length,
        duplicate_phones_count: duplicatePhones.size,
        duplicate_providers_count: duplicateProviders.size,
        added_phones_sample: toAdd.slice(0, 30).map((p) => p.phone_e164),
        marked_left_ids_sample: membersToMarkLeft.slice(0, 30),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        group_id: groupId,
        group_name: group.name,
        whatsapp_group_id: providerGroupId || group.whatsapp_provider_id || null,
        whatsapp_participants_count: participantsUnique.length,
        members_to_add_count: toAdd.length,
        members_to_mark_as_left_count: membersToMarkLeft.length,
        members_reactivated_count: membersToReactivate.length,
        members_ok_count: membersOk.length,
        skipped_count: skippedWeird.length,
        duplicates: {
          phones: Array.from(duplicatePhones),
          provider_ids: Array.from(duplicateProviders),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, code: "UNEXPECTED_ERROR", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
