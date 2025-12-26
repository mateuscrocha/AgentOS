import { useState } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { Users, MessageSquare, Activity, ListChecks, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollItem {
  id: string;
  question: string;
  created_at: string;
  max_options: number | null;
  provider_poll_message_id: string | null;
}

const PAGE_SIZE = 10;

export default function GroupPolls() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);

  const tabs = [
    { label: "Visão Geral", href: `/groups/${groupId}`, end: true },
    { label: "Membros", href: `/groups/${groupId}/members`, icon: Users },
    { label: "Mensagens", href: `/groups/${groupId}/messages`, icon: MessageSquare },
    { label: "Enquetes", href: `/groups/${groupId}/polls`, icon: ListChecks },
    { label: "Atividade", href: `/groups/${groupId}/events`, icon: Activity },
  ];

  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, organization_id")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: pollsData, isLoading, error, refetch } = useQuery({
    queryKey: ["group-polls", groupId, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await (supabase as any)
        .from("polls")
        .select("id, question, created_at, max_options, provider_poll_message_id", { count: "exact" })
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as PollItem[], count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: summaryMap } = useQuery({
    queryKey: ["group-polls-summary", pollsData?.items?.map(p => p.id)],
    queryFn: async () => {
      const ids = (pollsData?.items || []).map(p => p.id);
      if (!ids.length) return {} as Record<string, number>;
      const { data } = await (supabase as any)
        .from("v_poll_summary")
        .select("poll_id, voters_count")
        .in("poll_id", ids);
      const map: Record<string, number> = {};
      for (const r of data || []) {
        map[r.poll_id as string] = Number(r.voters_count || 0);
      }
      return map;
    },
    enabled: !!pollsData?.items?.length,
  });

  if (authLoading) {
    return (
      <AdminLayout title="Enquetes" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  const errorCode = (error as any)?.code;
  if (error && (error.message?.includes("permission") || errorCode === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar as enquetes deste grupo." />;
  }

  const columns = [
    {
      key: "created_at",
      header: "Data",
      render: (p: PollItem) => (
        <span className="text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
      ),
    },
    {
      key: "question",
      header: "Pergunta",
      render: (p: PollItem) => (
        <span className="text-sm text-card-foreground line-clamp-1 max-w-[420px]">{p.question}</span>
      ),
    },
    {
      key: "voters",
      header: "Votantes",
      render: (p: PollItem) => (
        <span className="text-xs text-muted-foreground">{summaryMap?.[p.id] ?? 0}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (p: PollItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/groups/${groupId}/polls/${p.id}`);
          }}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout title="Enquetes" subtitle={groupInfo?.groupName || "Carregando..."}>
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs
          items={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Enquetes" },
          ]}
        />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <ListChecks className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Enquetes</h2>
              <p className="text-sm text-muted-foreground">
                {(pollsData?.count ?? 0)} enquetes neste grupo
              </p>
            </div>
          </div>

          <div className="flex gap-1 p-2 bg-secondary/30">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                end={tab.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-card text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Carregando enquetes..." />
        ) : (pollsData?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhuma enquete"
            message="Este grupo ainda não possui enquetes."
          />
        ) : (
          <DataTable
            columns={columns}
            data={pollsData?.items ?? []}
            keyExtractor={(p: PollItem) => p.id}
            onRowClick={(p: PollItem) => navigate(`/groups/${groupId}/polls/${p.id}`)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={pollsData?.count}
            onPageChange={setPage}
          />
        )}
      </div>
    </AdminLayout>
  );
}
