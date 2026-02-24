export function isAlertsPathname(pathname: string) {
  return pathname === "/alerts" || pathname === "/system/alerts";
}

export function getCanonicalAlertsPath(isSystemAdmin: boolean) {
  return isSystemAdmin ? "/system/alerts" : "/alerts";
}

export function shouldRedirectAlertsPath(args: {
  pathname: string;
  isSystemAdmin: boolean;
}) {
  if (!isAlertsPathname(args.pathname)) return false;
  return args.pathname !== getCanonicalAlertsPath(args.isSystemAdmin);
}
