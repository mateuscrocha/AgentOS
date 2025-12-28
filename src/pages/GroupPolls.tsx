import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { Users, MessageSquare, Activity, ListChecks, Eye } from "lucide-react";
import { GroupTabs } from "@/components/group-navigation/GroupTabs";
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
      hideOn: "md",
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
      hideOn: "sm",
      render: (p: PollItem) => (
        <span className="text-xs text-muted-foreground">{summaryMap?.[p.id] ?? 0}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (p: PollItem) => (
        <RowActions>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/groups/${groupId}/polls/${p.id}`); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Ver detalhes
          </button>
        </RowActions>
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

          <GroupTabs groupId={groupId as string} activeTab="enquetes" />
        </div>

        <BorisTable
          columns={columns as any}
          data={pollsData?.items ?? []}
          keyExtractor={(p: PollItem) => p.id}
          onRowClick={(p: PollItem) => navigate(`/groups/${groupId}/polls/${p.id}`)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={pollsData?.count}
          onPageChange={setPage}
          loading={isLoading}
          emptyIcon={ListChecks}
          emptyMessage="Este grupo ainda não possui enquetes."
        />
      </div>
    </AdminLayout>
  );
}
