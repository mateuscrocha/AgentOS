/**
 * Admin V4 - Core Frozen após Passo 10
 * @see FREEZE.md para detalhes sobre mudanças permitidas
 */
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { AuthProvider } from "@/hooks/use-auth";
import { queryClient } from "@/lib/query-client";
import { installConsoleErrorNoiseFilter } from "@/lib/console-error-filter";

const Index = lazy(() => import("./pages/Index"));
const SystemEvents = lazy(() => import("./pages/SystemEvents"));
const SystemOrganizations = lazy(() => import("./pages/SystemOrganizations"));
const SystemGroups = lazy(() => import("./pages/SystemGroups"));
const SystemActivity = lazy(() => import("./pages/SystemActivity"));
const Org = lazy(() => import("./pages/Org"));
const Group = lazy(() => import("./pages/Group"));
const GroupMembers = lazy(() => import("./pages/GroupMembers"));
const GroupMessages = lazy(() => import("./pages/GroupMessages"));
const GroupSummaries = lazy(() => import("./pages/GroupSummaries"));
const GroupEvents = lazy(() => import("./pages/GroupEvents"));
const GroupPoll = lazy(() => import("./pages/GroupPoll"));
const GroupPolls = lazy(() => import("./pages/GroupPolls"));
const GroupEdit = lazy(() => import("./pages/GroupEdit"));
const Account = lazy(() => import("./pages/Account"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const NoAccess = lazy(() => import("./pages/NoAccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DevTestUsers = lazy(() => import("./pages/DevTestUsers"));
const Users = lazy(() => import("./pages/Users"));
const Alerts = lazy(() => import("./pages/Alerts"));

installConsoleErrorNoiseFilter();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthGuard>
            <Suspense fallback={<div className="p-4 sm:p-6"><PageSkeleton /></div>}>
              <Routes>
              {/* Auth and protected routes */}
              <Route path="/" element={<Index />} />
              {/* Legacy redirects */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/system/overview" element={<Navigate to="/" replace />} />
              {/* System Admin home */}
              <Route path="/system" element={<Index />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/system/organizations" element={<SystemOrganizations />} />
              <Route path="/system/groups" element={<SystemGroups />} />
              <Route path="/system/users" element={<Users />} />
              <Route path="/system/events" element={<SystemEvents />} />
              <Route path="/system/activity" element={<SystemActivity />} />
              <Route path="/system/settings" element={<Settings />} />
              <Route path="/system/alerts" element={<Alerts />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/org/:orgId" element={<Org />} />
              <Route path="/organization/:orgId" element={<Org />} />
              <Route path="/organization/:orgId/groups" element={<Org />} />
              <Route path="/organization/:orgId/dashboard" element={<Org />} />
              <Route path="/organization/:orgId/keywords" element={<Org />} />
              {/* Group Admin routes (legacy + standardized aliases) */}
              <Route path="/group/:groupId" element={<Group />} />
              <Route path="/group/:groupId/members" element={<GroupMembers />} />
              <Route path="/group/:groupId/messages" element={<GroupMessages />} />
              <Route path="/group/:groupId/summaries" element={<GroupSummaries />} />
              <Route path="/group/:groupId/polls" element={<GroupPolls />} />
              <Route path="/group/:groupId/polls/:pollId" element={<GroupPoll />} />
              <Route path="/group/:groupId/events" element={<GroupEvents />} />
              <Route path="/group/:groupId/edit" element={<GroupEdit />} />
              <Route path="/groups/:groupId" element={<Group />} />
              <Route path="/groups/:groupId/members" element={<GroupMembers />} />
              <Route path="/groups/:groupId/messages" element={<GroupMessages />} />
              <Route path="/groups/:groupId/summaries" element={<GroupSummaries />} />
              <Route path="/groups/:groupId/polls" element={<GroupPolls />} />
              <Route path="/groups/:groupId/polls/:pollId" element={<GroupPoll />} />
              <Route path="/groups/:groupId/events" element={<GroupEvents />} />
              <Route path="/groups/:groupId/dashboard" element={<Group />} />
              <Route path="/groups/:groupId/edit" element={<GroupEdit />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/no-access" element={<NoAccess />} />
              <Route path="/dev/test-users" element={<DevTestUsers />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthGuard>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
