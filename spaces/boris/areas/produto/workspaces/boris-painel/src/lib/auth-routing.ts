export function getPostLoginRedirectPath(args: {
  isSystemAdmin: boolean;
  isOrgAdmin?: boolean;
  groupIds: string[];
  orgIds: string[];
}) {
  if (args.isSystemAdmin) return null;
  if (args.isOrgAdmin && args.orgIds.length > 0) return `/organization/${args.orgIds[0]}/dashboard`;
  if (args.groupIds.length > 0) return `/groups/${args.groupIds[0]}`;
  if (args.orgIds.length > 0) return `/organization/${args.orgIds[0]}`;
  return "/no-access";
}
