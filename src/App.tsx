import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import System from "./pages/System";
import Org from "./pages/Org";
import Group from "./pages/Group";
import GroupMembers from "./pages/GroupMembers";
import GroupMessages from "./pages/GroupMessages";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/system" element={<System />} />
          <Route path="/org/:orgId" element={<Org />} />
          <Route path="/group/:groupId" element={<Group />} />
          <Route path="/group/:groupId/members" element={<GroupMembers />} />
          <Route path="/group/:groupId/messages" element={<GroupMessages />} />
          <Route path="/account" element={<Account />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
