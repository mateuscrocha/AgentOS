export function isAlertsPathname(pathname: string) {
  return pathname === "/alerts" || pathname === "/system/alerts";
}

export function isAlertDefinitionsPathname(pathname: string) {
  return pathname === "/alert-definitions" || pathname === "/system/alert-definitions";
}

export function getCanonicalAlertsPath(isSystemAdmin: boolean) {
  return isSystemAdmin ? "/system/alerts" : "/alerts";
}

export function getCanonicalAlertDefinitionsPath(isSystemAdmin: boolean) {
  return isSystemAdmin ? "/system/alert-definitions" : "/alert-definitions";
}

export function shouldRedirectAlertsPath(args: {
  pathname: string;
  isSystemAdmin: boolean;
}) {
  if (!isAlertsPathname(args.pathname)) return false;
  return args.pathname !== getCanonicalAlertsPath(args.isSystemAdmin);
}

export function shouldRedirectAlertDefinitionsPath(args: {
  pathname: string;
  isSystemAdmin: boolean;
}) {
  if (!isAlertDefinitionsPathname(args.pathname)) return false;
  return args.pathname !== getCanonicalAlertDefinitionsPath(args.isSystemAdmin);
}
