import { describe, expect, it } from "vitest";
import { getCanonicalAlertsPath, isAlertsPathname, shouldRedirectAlertsPath } from "@/lib/alerts-routing";

describe("alerts routing", () => {
  it("usa rota canônica de system admin", () => {
    expect(getCanonicalAlertsPath(true)).toBe("/system/alerts");
  });

  it("usa rota canônica de admins não-system/gestor", () => {
    expect(getCanonicalAlertsPath(false)).toBe("/alerts");
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
    expect(
      shouldRedirectAlertsPath({
        pathname: "/system/organizations",
        isSystemAdmin: true,
      }),
    ).toBe(false);
  });
});
