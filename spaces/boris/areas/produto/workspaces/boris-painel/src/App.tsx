/**
 * Admin V4 - Core Frozen após Passo 10
 * @see FREEZE.md para detalhes sobre mudanças permitidas
 */
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { AuthProvider } from "@/hooks/use-auth";
import { useActivityTracking } from "@/hooks/use-activity-tracking";
import { queryClient } from "@/lib/query-client";
import { installConsoleErrorNoiseFilter } from "@/lib/console-error-filter";
import { SUPABASE_CONFIG_ERROR } from "@/integrations/supabase/client";

const Index = lazy(() => import("./pages/Index"));
const SystemEvents = lazy(() => import("./pages/SystemEvents"));
const SystemOrganizations = lazy(() => import("./pages/SystemOrganizations"));
const SystemGroups = lazy(() => import("./pages/SystemGroups"));
const SystemActivity = lazy(() => import("./pages/SystemActivity"));
const SystemTrends = lazy(() => import("./pages/SystemTrends"));
const SystemCRM = lazy(() => import("./pages/SystemCRM"));
const Org = lazy(() => import("./pages/Org"));
const Group = lazy(() => import("./pages/Group"));
const GroupMembers = lazy(() => import("./pages/GroupMembers"));
const GroupMessages = lazy(() => import("./pages/GroupMessages"));
const GroupSummaries = lazy(() => import("./pages/GroupSummaries"));
const GroupEvents = lazy(() => import("./pages/GroupEvents"));
const GroupSupport = lazy(() => import("./pages/GroupSupport"));
const GroupPoll = lazy(() => import("./pages/GroupPoll"));
const GroupPolls = lazy(() => import("./pages/GroupPolls"));
const GroupEdit = lazy(() => import("./pages/GroupEdit"));
const Account = lazy(() => import("./pages/Account"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const NoAccess = lazy(() => import("./pages/NoAccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DevTestUsers = lazy(() => import("./pages/dev/DevTestUsers"));
const Users = lazy(() => import("./pages/Users"));
const Alerts = lazy(() => import("./pages/Alerts"));
const CRMScreenshotSandbox = lazy(() => import("./pages/dev/CRMScreenshotSandbox"));

const legacyRedirects = [
  { path: "/dashboard", to: "/" },
  { path: "/system/overview", to: "/" },
  { path: "/overview", to: "/" },
  { path: "/organization", to: "/system/organizations" },
  { path: "/system/support", to: "/system/activity" },
  { path: "/system/crm", to: "/system/crm/pipeline" },
  { path: "/onboarding", to: "/signup" },
] as const;

const systemCrmRoutes = [
  "/system/crm/pipeline",
  "/system/crm/companies",
  "/system/crm/contacts",
  "/system/crm/tasks",
] as const;

const organizationRoutes = [
  "/organization/:orgId",
  "/organization/:orgId/groups",
  "/organization/:orgId/dashboard",
  "/organization/:orgId/keywords",
  "/organization/:orgId/profile",
] as const;

const groupRoutes = [
  { path: "/groups/:groupId", element: <Group /> },
  { path: "/groups/:groupId/members", element: <GroupMembers /> },
  { path: "/groups/:groupId/support", element: <GroupSupport /> },
  { path: "/groups/:groupId/messages", element: <GroupMessages /> },
  { path: "/groups/:groupId/summaries", element: <GroupSummaries /> },
  { path: "/groups/:groupId/polls", element: <GroupPolls /> },
  { path: "/groups/:groupId/polls/:pollId", element: <GroupPoll /> },
  { path: "/groups/:groupId/events", element: <GroupEvents /> },
  { path: "/groups/:groupId/dashboard", element: <Group /> },
  { path: "/groups/:groupId/edit", element: <GroupEdit /> },
] as const;

const internalDevRoutes = [
  { path: "/dev/crm-sandbox", element: <CRMScreenshotSandbox /> },
  { path: "/dev/test-users", element: <DevTestUsers /> },
] as const;

installConsoleErrorNoiseFilter();

function ActivityTrackingBoundary() {
  useActivityTracking();
  return null;
}

const MisconfiguredApp = ({ message }: { message: string }) => (
  <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <div className="w-full rounded-xl border border-rose-500/30 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-xl font-semibold text-rose-300">Falha de configuração no deploy</h1>
        <p className="mt-3 text-sm text-slate-300">
          O frontend foi publicado sem as variáveis obrigatórias do Supabase no momento do build.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-rose-200">{message}</pre>
        <p className="mt-4 text-sm text-slate-300">
          Configure os build args/envs `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`) e gere um novo deploy.
        </p>
      </div>
    </div>
  </main>
);

function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<div className="p-4 sm:p-6"><PageSkeleton /></div>}>
      <ActivityTrackingBoundary />
      <Routes key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/system" element={<Index />} />
        <Route path="/system/organizations" element={<SystemOrganizations />} />
        <Route path="/system/groups" element={<SystemGroups />} />
        <Route path="/system/users" element={<Users />} />
        <Route path="/system/events" element={<SystemEvents />} />
        <Route path="/system/activity" element={<SystemActivity />} />
        <Route path="/system/trends" element={<SystemTrends />} />
        <Route path="/system/settings" element={<Settings />} />
        <Route path="/system/alerts" element={<Alerts />} />
        <Route path="/system/alert-definitions" element={<Alerts />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alert-definitions" element={<Alerts />} />

        {systemCrmRoutes.map((path) => (
          <Route key={path} path={path} element={<SystemCRM />} />
        ))}

        <Route path="/org/:orgId/*" element={<LegacyOrgAliasRedirect />} />
        {organizationRoutes.map((path) => (
          <Route key={path} path={path} element={<Org />} />
        ))}

        <Route path="/group/:groupId/*" element={<LegacyGroupAliasRedirect />} />
        {groupRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}

        <Route path="/account" element={<Account />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signup" element={<Onboarding />} />
        <Route path="/no-access" element={<NoAccess />} />

        {internalDevRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}

        {legacyRedirects.map(({ path, to }) => (
          <Route key={path} path={path} element={<Navigate to={to} replace />} />
        ))}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function LegacyOrgAliasRedirect() {
  const { orgId, "*": rest } = useParams();
  const location = useLocation();
  if (!orgId) return <Navigate to="/" replace />;
  const suffix = rest ? `/${rest}` : "";
  return <Navigate to={`/organization/${orgId}${suffix}${location.search}${location.hash}`} replace />;
}

function LegacyGroupAliasRedirect() {
  const { groupId, "*": rest } = useParams();
  const location = useLocation();
  if (!groupId) return <Navigate to="/" replace />;
  const suffix = rest ? `/${rest}` : "";
  return <Navigate to={`/groups/${groupId}${suffix}${location.search}${location.hash}`} replace />;
}

const App = () => (
  SUPABASE_CONFIG_ERROR ? (
    <MisconfiguredApp message={SUPABASE_CONFIG_ERROR} />
  ) : (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AuthGuard>
            <AppRoutes />
          </AuthGuard>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  )
);

export default App;
