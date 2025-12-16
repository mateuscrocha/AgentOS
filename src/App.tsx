/**
 * Admin V4 - Core Frozen após Passo 10
 * @see FREEZE.md para detalhes sobre mudanças permitidas
 */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import Index from "./pages/Index";
import System from "./pages/System";
import SystemEvents from "./pages/SystemEvents";
import Org from "./pages/Org";
import Group from "./pages/Group";
import GroupMembers from "./pages/GroupMembers";
import GroupMessages from "./pages/GroupMessages";
import GroupEvents from "./pages/GroupEvents";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGuard>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/system" element={<System />} />
            <Route path="/system/events" element={<SystemEvents />} />
            <Route path="/org/:orgId" element={<Org />} />
            <Route path="/group/:groupId" element={<Group />} />
            <Route path="/group/:groupId/members" element={<GroupMembers />} />
            <Route path="/group/:groupId/messages" element={<GroupMessages />} />
            <Route path="/group/:groupId/events" element={<GroupEvents />} />
            <Route path="/account" element={<Account />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/no-access" element={<NoAccess />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
