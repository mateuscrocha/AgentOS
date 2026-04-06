import { DEFAULT_SUPPORT_BUSINESS_HOURS, businessMsBetween } from "@/lib/business-time";

type GroupRow = {
  id: string;
  name: string;
  organization_id: string;
};

type GroupOverviewRow = {
  group_id: string;
  last_access_at: string | null;
};

export type SupportNowStatus = "awaiting_attendant" | "awaiting_customer" | "in_progress" | "inactive";

export type SupportNowItem = {
  groupId: string;
  groupName: string;
  organizationId: string;
  status: SupportNowStatus;
  lastMessageAt: string | null;
  waitingSinceAt: string | null;
  waitingBusinessMs: number | null;
  slaBreached: boolean;
  assignedAttendants: number;
};

export type SupportNowSummary = {
  items: SupportNowItem[];
  counts: Record<SupportNowStatus, number>;
};

const INACTIVITY_DAYS = 7;
const NOW_IN_PROGRESS_WINDOW_HOURS = 6;

function normalizePhoneForIdentity(phone?: string | null) {
  const raw = (phone || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

export function memberIdentityKey(member: Pick<{ id: string; phone_e164: string | null; lid: string | null }, "id" | "phone_e164" | "lid">) {
  const phone = normalizePhoneForIdentity(member.phone_e164);
  if (phone) return `phone:${phone}`;
  if (member.lid) return `lid:${String(member.lid).trim()}`;
  return `member:${member.id}`;
}

export function messageIdentityKey(
  message: { member_id: string | null; sender_phone: string | null },
  memberIdentityById: Map<string, string>,
) {
  if (message.member_id && memberIdentityById.has(message.member_id)) {
    return memberIdentityById.get(message.member_id)!;
  }
  const phone = normalizePhoneForIdentity(message.sender_phone);
  if (phone) return `phone:${phone}`;
  return null;
}

function daysSince(date?: string | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  const diff = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(diff)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export function buildSupportNowSummary(args: {
  filteredGroupIds: string[];
  nowMessagesSample: Array<{ group_id: string; member_id: string | null; sender_phone: string | null; created_at: string }>;
  supportIdentityKeysByGroup: Map<string, Set<string>>;
  memberIdentityById: Map<string, string>;
  groupById: Map<string, GroupRow>;
  overviewByGroupId: Map<string, GroupOverviewRow>;
  responseSlaBusinessMinutes: number;
  now?: Date;
}): SupportNowSummary {
  const now = args.now ?? new Date();
  const stateByGroup = new Map<string, {
    lastMessageAt: string | null;
    lastActor: "support" | "client" | null;
    pendingAt: string | null;
    recentSupportAt: string | null;
    recentClientAt: string | null;
  }>();

  for (const groupId of args.filteredGroupIds) {
    stateByGroup.set(groupId, {
      lastMessageAt: null,
      lastActor: null,
      pendingAt: null,
      recentSupportAt: null,
      recentClientAt: null,
    });
  }

  for (const msg of args.nowMessagesSample) {
    const current = stateByGroup.get(msg.group_id);
    if (!current) continue;

    const identity = messageIdentityKey(msg, args.memberIdentityById);
    const supportSet = args.supportIdentityKeysByGroup.get(msg.group_id);
    const isSupport = !!identity && !!supportSet?.has(identity);

    current.lastMessageAt = msg.created_at;
    current.lastActor = isSupport ? "support" : "client";

    if (isSupport) {
      current.recentSupportAt = msg.created_at;
      if (current.pendingAt) current.pendingAt = null;
      continue;
    }

    current.recentClientAt = msg.created_at;
    current.pendingAt = msg.created_at;
  }

  const items: SupportNowItem[] = args.filteredGroupIds.map((groupId) => {
    const group = args.groupById.get(groupId);
    const state = stateByGroup.get(groupId);
    const lastMessageAt = state?.lastMessageAt ?? args.overviewByGroupId.get(groupId)?.last_access_at ?? null;
    const pendingAt = state?.pendingAt ?? null;
    const inactiveForDays = daysSince(lastMessageAt);
    const inProgressThresholdMs = NOW_IN_PROGRESS_WINDOW_HOURS * 60 * 60 * 1000;
    const supportSet = args.supportIdentityKeysByGroup.get(groupId);
    const assignedAttendants = supportSet?.size ?? 0;

    let status: SupportNowStatus = "inactive";
    let waitingBusinessMs: number | null = null;
    let slaBreached = false;

    if (pendingAt) {
      status = "awaiting_attendant";
      waitingBusinessMs = businessMsBetween(pendingAt, now, DEFAULT_SUPPORT_BUSINESS_HOURS);
      slaBreached = waitingBusinessMs > args.responseSlaBusinessMinutes * 60 * 1000;
    } else if (
      state?.recentSupportAt &&
      state?.recentClientAt &&
      Math.abs(new Date(state.recentSupportAt).getTime() - new Date(state.recentClientAt).getTime()) <= inProgressThresholdMs &&
      lastMessageAt &&
      now.getTime() - new Date(lastMessageAt).getTime() <= inProgressThresholdMs
    ) {
      status = "in_progress";
    } else if (state?.lastActor === "support") {
      status = "awaiting_customer";
    } else if (inactiveForDays < INACTIVITY_DAYS) {
      status = "awaiting_customer";
    }

    return {
      groupId,
      groupName: group?.name ?? "Grupo",
      organizationId: group?.organization_id ?? "",
      status,
      lastMessageAt,
      waitingSinceAt: pendingAt,
      waitingBusinessMs,
      slaBreached,
      assignedAttendants,
    };
  }).sort((a, b) => {
    const priority = {
      awaiting_attendant: 0,
      in_progress: 1,
      awaiting_customer: 2,
      inactive: 3,
    } as const;
    const priorityDiff = priority[a.status] - priority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
  });

  const counts: Record<SupportNowStatus, number> = {
    awaiting_attendant: 0,
    awaiting_customer: 0,
    in_progress: 0,
    inactive: 0,
  };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return { items, counts };
}
