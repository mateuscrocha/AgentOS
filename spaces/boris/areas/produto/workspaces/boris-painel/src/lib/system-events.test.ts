import { describe, expect, it } from "vitest";
import {
  buildAuditOverview,
  buildSystemEventSearchText,
  getAuditOutcome,
  getAuditSeverity,
  getEventActorLabel,
  getEventOriginLabel,
  getEventSummary,
  getEventTargetLabel,
  isSensitiveEvent,
  matchesAuditQuickFilter,
  type AuditEvent,
} from "./system-events";

const baseEvent: AuditEvent = {
  id: "evt-1",
  event_type: "USER_ROLE_ADDED",
  entity_type: "user",
  entity_id: "00000000-0000-4000-8000-000000000999",
  user_id: "00000000-0000-4000-8000-000000000111",
  metadata: {
    target_user_id: "00000000-0000-4000-8000-000000000222",
    role: "ORG_ADMIN",
    requested_by: "00000000-0000-4000-8000-000000000333",
  },
  created_at: "2026-03-12T12:00:00.000Z",
};

describe("system-events helpers", () => {
  it("resume eventos administrativos em linguagem humana", () => {
    expect(getEventSummary(baseEvent)).toContain("Papel ORG_ADMIN concedido");
    expect(getEventActorLabel(baseEvent)).toContain("00000000-0000-4000-8000-000000000333");
    expect(getEventTargetLabel(baseEvent)).toContain("Usuário");
  });

  it("detecta eventos sensíveis e severidade de falha", () => {
    const failureEvent: AuditEvent = {
      ...baseEvent,
      event_type: "GROUP_WEBHOOK_FAILED",
      entity_type: "group",
      entity_id: "group-1",
      metadata: { code: "WEBHOOK_NOT_CONFIGURED" },
    };

    expect(isSensitiveEvent(baseEvent)).toBe(true);
    expect(getAuditOutcome(failureEvent)).toBe("failure");
    expect(getAuditSeverity(failureEvent)).toBe("high");
    expect(getEventOriginLabel(failureEvent)).toContain("Código");
  });

  it("aplica filtros rápidos e busca textual", () => {
    expect(matchesAuditQuickFilter(baseEvent, "admins")).toBe(true);
    expect(matchesAuditQuickFilter(baseEvent, "failures")).toBe(false);
    expect(buildSystemEventSearchText(baseEvent)).toContain("org_admin".toLowerCase());
  });

  it("agrega overview de auditoria", () => {
    const overview = buildAuditOverview([
      baseEvent,
      {
        ...baseEvent,
        id: "evt-2",
        event_type: "GROUP_WEBHOOK_FAILED",
        entity_type: "group",
        entity_id: "group-1",
        metadata: { code: "WEBHOOK_NOT_CONFIGURED" },
      },
    ]);

    expect(overview.total).toBe(2);
    expect(overview.failures).toBe(1);
    expect(overview.sensitive).toBe(1);
    expect(overview.recentAlerts).toHaveLength(2);
  });

  it("trata alerta de cobrança da OpenAI como falha sensível", () => {
    const event: AuditEvent = {
      id: "evt-openai",
      event_type: "OPENAI_BILLING_ALERT",
      entity_type: "system",
      entity_id: "openai-billing",
      user_id: null,
      metadata: {
        operation: "generate-group-summary",
        group_name: "Comunidade Auto Mate +",
        status: 429,
      },
      created_at: "2026-03-31T23:05:00.000Z",
    };

    expect(getAuditOutcome(event)).toBe("failure");
    expect(getAuditSeverity(event)).toBe("high");
    expect(getEventSummary(event)).toContain("OpenAI bloqueou");
    expect(buildSystemEventSearchText(event)).toContain("comunidade auto mate".toLowerCase());
  });
});
