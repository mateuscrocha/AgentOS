import { formatDateKeySP, formatDateTickBR } from "@/lib/date";

export interface AuditEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export type AuditQuickFilter = "all" | "failures" | "sensitive" | "admins" | "groups";
export type AuditOutcome = "success" | "failure" | "neutral";
export type AuditSeverity = "high" | "medium" | "low";

const FAILURE_KEYWORDS = ["FAILED", "ERROR", "DENIED", "BLOCKED", "INVALID"];
const SUCCESS_KEYWORDS = ["ADDED", "ASSIGNED", "CREATED", "COMPLETED", "UPDATED", "REMOVED", "DELETED"];
const SENSITIVE_KEYWORDS = [
  "ADMIN",
  "ROLE",
  "USER_DELETED",
  "DELETE",
  "AUTH",
  "LOGIN",
  "PASSWORD",
  "ACCESS",
];

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function compactId(value: string | null | undefined) {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

export function humanizeEventType(eventType: string) {
  if (eventType === "OPENAI_BILLING_ALERT") return "Alerta de cobrança OpenAI";
  return eventType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getAuditOutcome(event: Pick<AuditEvent, "event_type">): AuditOutcome {
  const type = normalize(event.event_type);
  if (type === "OPENAI_BILLING_ALERT") return "failure";
  if (FAILURE_KEYWORDS.some((keyword) => type.includes(keyword))) return "failure";
  if (SUCCESS_KEYWORDS.some((keyword) => type.includes(keyword))) return "success";
  return "neutral";
}

export function isAdminRelatedEvent(event: Pick<AuditEvent, "event_type" | "metadata">) {
  const type = normalize(event.event_type);
  const role = normalize(event.metadata?.role);
  return type.includes("ADMIN") || role.includes("ADMIN") || type.includes("SYSTEM");
}

export function isSensitiveEvent(event: Pick<AuditEvent, "event_type" | "metadata">) {
  const type = normalize(event.event_type);
  const code = normalize(event.metadata?.code);
  const role = normalize(event.metadata?.role);
  if (type === "OPENAI_BILLING_ALERT") return true;
  return (
    SENSITIVE_KEYWORDS.some((keyword) => type.includes(keyword)) ||
    SENSITIVE_KEYWORDS.some((keyword) => code.includes(keyword)) ||
    SENSITIVE_KEYWORDS.some((keyword) => role.includes(keyword))
  );
}

export function getAuditSeverity(event: Pick<AuditEvent, "event_type" | "metadata">): AuditSeverity {
  if (getAuditOutcome(event as Pick<AuditEvent, "event_type">) === "failure") return "high";
  if (isSensitiveEvent(event)) return "medium";
  return "low";
}

export function getEventActorLabel(event: AuditEvent) {
  const metadata = event.metadata ?? {};
  return metadata.requested_by || metadata.actor_user_id || event.user_id || "Sistema interno";
}

export function getEventTargetLabel(event: AuditEvent) {
  const metadata = event.metadata ?? {};

  if (metadata.target_user_id) return `Usuário ${compactId(String(metadata.target_user_id))}`;
  if (metadata.group_name) return `Grupo ${String(metadata.group_name)}`;
  if (metadata.organization_name) return `Organização ${String(metadata.organization_name)}`;
  if (metadata.role) return `Papel ${String(metadata.role)}`;

  const entityPrefix = event.entity_type === "user"
    ? "Usuário"
    : event.entity_type === "group"
      ? "Grupo"
      : event.entity_type === "organization"
        ? "Organização"
        : "Entidade";

  return `${entityPrefix} ${compactId(event.entity_id)}`;
}

export function getEventOriginLabel(event: AuditEvent) {
  const metadata = event.metadata ?? {};
  const ip = metadata.ip || metadata.source_ip || metadata.origin_ip;
  if (ip) return `IP ${String(ip)}`;
  if (metadata.provider) return String(metadata.provider);
  if (metadata.code) return `Código ${String(metadata.code)}`;
  if (metadata.correlation_id) return `Corr. ${compactId(String(metadata.correlation_id))}`;
  return "Interno";
}

export function getEventSummary(event: AuditEvent) {
  const metadata = event.metadata ?? {};

  switch (event.event_type) {
    case "OPENAI_BILLING_ALERT":
      return `A OpenAI bloqueou ${metadata.operation === "generate-group-topics-keywords" ? "a geração de tópicos/keywords" : "a geração do resumo"}${metadata.group_name ? ` para o grupo ${metadata.group_name}` : ""} por limite, quota ou cobrança.`;
    case "GROUP_ADDED":
      return `Grupo ${metadata.group_name || compactId(event.entity_id)} adicionado à organização ${metadata.organization_name || compactId(metadata.organization_id)}.`;
    case "GROUP_WEBHOOK_FAILED":
      return `Falha ao provisionar o grupo ${metadata.group_name || compactId(event.entity_id)} para automação.`;
    case "USER_ROLE_ADDED":
      return `Papel ${metadata.role || "informado"} concedido ao usuário ${compactId(metadata.target_user_id || event.entity_id)}.`;
    case "USER_ROLE_REMOVED":
      return `Papel ${metadata.role || "informado"} removido do usuário ${compactId(metadata.target_user_id || event.entity_id)}.`;
    case "ORG_ADMIN_ASSIGNED":
      return `Acesso administrativo concedido para a organização ${metadata.organization_name || compactId(metadata.organization_id)}.`;
    case "USER_DELETED":
      return `Usuário ${compactId(metadata.target_user_id || event.entity_id)} excluído do sistema.`;
    default: {
      const base = humanizeEventType(event.event_type);
      const target = getEventTargetLabel(event);
      return `${base} em ${target}.`;
    }
  }
}

export function buildSystemEventSearchText(event: AuditEvent) {
  return [
    event.event_type,
    event.entity_type,
    event.entity_id,
    event.user_id,
    getEventActorLabel(event),
    getEventTargetLabel(event),
    getEventOriginLabel(event),
    getEventSummary(event),
    JSON.stringify(event.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesAuditQuickFilter(event: AuditEvent, quickFilter: AuditQuickFilter) {
  switch (quickFilter) {
    case "failures":
      return getAuditOutcome(event) === "failure";
    case "sensitive":
      return isSensitiveEvent(event);
    case "admins":
      return isAdminRelatedEvent(event);
    case "groups":
      return event.entity_type === "group";
    default:
      return true;
  }
}

export function buildAuditOverview(events: AuditEvent[]) {
  const failures = events.filter((event) => getAuditOutcome(event) === "failure").length;
  const sensitive = events.filter(isSensitiveEvent).length;
  const adminActions = events.filter(isAdminRelatedEvent).length;
  const uniqueActors = new Set(
    events
      .map(getEventActorLabel)
      .filter((value) => value && value !== "Sistema interno"),
  ).size;

  const recentAlerts = events
    .filter((event) => getAuditSeverity(event) !== "low" || getAuditOutcome(event) === "failure")
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      summary: getEventSummary(event),
      createdAt: event.created_at,
      severity: getAuditSeverity(event),
      outcome: getAuditOutcome(event),
      typeLabel: humanizeEventType(event.event_type),
    }));

  return {
    total: events.length,
    failures,
    sensitive,
    adminActions,
    uniqueActors,
    recentAlerts,
  };
}

export function buildDailyAuditSeries(events: AuditEvent[], from: Date, to: Date) {
  const counts = new Map<string, number>();
  const cursor = new Date(from);
  const end = new Date(to);

  while (cursor <= end) {
    counts.set(formatDateKeySP(cursor), 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const event of events) {
    const key = formatDateKeySP(new Date(event.created_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({
    date,
    count,
    label: formatDateTickBR(date),
  }));
}
