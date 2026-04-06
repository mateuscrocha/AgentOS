import { describe, expect, it } from "vitest";
import {
  getCanonicalAlertDefinitionsPath,
  getCanonicalAlertsPath,
  isAlertDefinitionsPathname,
  isAlertsPathname,
  shouldRedirectAlertDefinitionsPath,
  shouldRedirectAlertsPath,
} from "@/lib/alerts-routing";

describe("alerts routing", () => {
  it("usa rota canônica de system admin", () => {
    expect(getCanonicalAlertsPath(true)).toBe("/system/alerts");
  });

  it("usa rota canônica de admins não-system/gestor", () => {
    expect(getCanonicalAlertsPath(false)).toBe("/alerts");
  });

  it("usa rota canônica de definições para system admin", () => {
    expect(getCanonicalAlertDefinitionsPath(true)).toBe("/system/alert-definitions");
  });

  it("usa rota canônica de definições para admins não-system/gestor", () => {
    expect(getCanonicalAlertDefinitionsPath(false)).toBe("/alert-definitions");
  });

  it("redireciona system admin que entrou em /alerts", () => {
    expect(
      shouldRedirectAlertsPath({
        pathname: "/alerts",
        isSystemAdmin: true,
      }),
    ).toBe(true);
  });

  it("não redireciona system admin já em /system/alerts", () => {
    expect(
      shouldRedirectAlertsPath({
        pathname: "/system/alerts",
        isSystemAdmin: true,
      }),
    ).toBe(false);
  });

  it("redireciona não-system que entrou em /system/alerts", () => {
    expect(
      shouldRedirectAlertsPath({
        pathname: "/system/alerts",
        isSystemAdmin: false,
      }),
    ).toBe(true);
  });

  it("não redireciona não-system já em /alerts", () => {
    expect(
      shouldRedirectAlertsPath({
        pathname: "/alerts",
        isSystemAdmin: false,
      }),
    ).toBe(false);
  });

  it("não tenta redirecionar páginas que não são de alertas", () => {
    expect(isAlertsPathname("/system/organizations")).toBe(false);
    expect(isAlertDefinitionsPathname("/system/organizations")).toBe(false);
    expect(
      shouldRedirectAlertsPath({
        pathname: "/system/organizations",
        isSystemAdmin: true,
      }),
    ).toBe(false);
    expect(
      shouldRedirectAlertDefinitionsPath({
        pathname: "/system/organizations",
        isSystemAdmin: true,
      }),
    ).toBe(false);
  });

  it("redireciona system admin que entrou em /alert-definitions", () => {
    expect(
      shouldRedirectAlertDefinitionsPath({
        pathname: "/alert-definitions",
        isSystemAdmin: true,
      }),
    ).toBe(true);
  });

  it("não redireciona não-system já em /alert-definitions", () => {
    expect(
      shouldRedirectAlertDefinitionsPath({
        pathname: "/alert-definitions",
        isSystemAdmin: false,
      }),
    ).toBe(false);
  });
});
