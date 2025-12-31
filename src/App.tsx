/**
 * Admin V4 - Core Frozen após Passo 10
 * @see FREEZE.md para detalhes sobre mudanças permitidas
 */
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import Index from "./pages/Index";
import SystemEvents from "./pages/SystemEvents";
import SystemOrganizations from "./pages/SystemOrganizations";
import SystemGroups from "./pages/SystemGroups";
import Org from "./pages/Org";
import Group from "./pages/Group";
import GroupMembers from "./pages/GroupMembers";
import GroupMessages from "./pages/GroupMessages";
import GroupEvents from "./pages/GroupEvents";
import GroupPoll from "./pages/GroupPoll";
import GroupPolls from "./pages/GroupPolls";
import GroupEdit from "./pages/GroupEdit";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";
import DevTestUsers from "./pages/DevTestUsers";
import Onboarding from "./pages/Onboarding";
import OnboardingError from "./pages/OnboardingError";
import Users from "./pages/Users";

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args.length === 0) {
    return;
  }
  const joined = args.map((a) => String(a)).join(" ");
  if (
    joined.includes("net::ERR_ABORTED") ||
    joined.includes("AbortError") ||
    joined.includes("net::ERR_INSUFFICIENT_RESOURCES")
  ) {
    return;
  }
  originalConsoleError(...args);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthGuard>
          <Routes>
            {/* Public onboarding routes */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/onboarding/error" element={<OnboardingError />} />
            
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
            <Route path="/system/settings" element={<Settings />} />
            <Route path="/org/:orgId" element={<Org />} />
            <Route path="/organization/:orgId" element={<Org />} />
            <Route path="/organization/:orgId/groups" element={<Org />} />
            <Route path="/organization/:orgId/dashboard" element={<Org />} />
            <Route path="/organization/:orgId/keywords" element={<Org />} />
            {/* Group Admin routes (legacy + standardized aliases) */}
            <Route path="/group/:groupId" element={<Group />} />
            <Route path="/group/:groupId/members" element={<GroupMembers />} />
            <Route path="/group/:groupId/messages" element={<GroupMessages />} />
            <Route path="/group/:groupId/polls" element={<GroupPolls />} />
            <Route path="/group/:groupId/polls/:pollId" element={<GroupPoll />} />
            <Route path="/group/:groupId/events" element={<GroupEvents />} />
            <Route path="/group/:groupId/edit" element={<GroupEdit />} />
            <Route path="/groups/:groupId" element={<Group />} />
            <Route path="/groups/:groupId/members" element={<GroupMembers />} />
            <Route path="/groups/:groupId/messages" element={<GroupMessages />} />
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
        </AuthGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
