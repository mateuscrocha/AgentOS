import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notify } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { formatDateSimpleBR } from "@/lib/date";

interface GroupRow {
  id: string;
  name: string;
  provider: string;
  status: string | null;
  organization_id: string;
  organizations?: { name: string } | null;
  invite_link?: string | null;
  created_at?: string;
  last_access_at?: string | null;
  members_count?: number;
}

interface OrganizationOption { id: string; name: string; }

const PAGE_SIZE = 10;

async function parseInvokeError(err: any): Promise<{ message: string; code?: string }> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
    } catch (_e) {
      void 0;
    }
  }

  const isFetchError =
    err instanceof FunctionsFetchError ||
    err?.name === "FunctionsFetchError" ||
    /failed to send a request to the edge function/i.test(message) ||
    /fetch failed/i.test(message) ||
    /networkerror/i.test(message);

  if (!code && isFetchError) {
    const isOffline = typeof navigator !== "undefined" && navigator?.onLine === false;
    code = "NETWORK_ERROR";
    message = isOffline
      ? "Sem conexão com a internet."
      : "Não foi possível comunicar com o servidor. Verifique sua conexão/VPN e tente novamente.";
  }

  return { message, code };
}

export default function SystemGroups() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<"created_at" | "name">("created_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [removeGroup, setRemoveGroup] = useState<GroupRow | null>(null);
  const [removingGroup, setRemovingGroup] = useState(false);
  const [editInviteGroup, setEditInviteGroup] = useState<GroupRow | null>(null);
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [cascadeGroup, setCascadeGroup] = useState<GroupRow | null>(null);
  const [deletingCascade, setDeletingCascade] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: organizations } = useQuery({
    queryKey: ["groups-organizations-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as OrganizationOption[];
    },
    enabled: isAuthenticated,
  });

  const { data: groupsData, isLoading, error, refetch } = useQuery({
    queryKey: ["system-groups", page, debouncedSearch, statusFilter, orgFilter, orderBy, orderDir],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("groups")
        .select("id, name, provider, status, organization_id, invite_link, created_at, organizations(name)", { count: "exact" });

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }
      if (orgFilter) {
        query = query.eq("organization_id", orgFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const items = (data ?? []) as GroupRow[];
      const groupIds = items.map((g) => g.id).filter(Boolean);
      if (groupIds.length) {
        const { data: overviewData, error: overviewErr } = await supabase
          .from("v_group_overview")
          .select("group_id, last_access_at, members_count")
          .in("group_id", groupIds);
        if (!overviewErr && Array.isArray(overviewData)) {
          const byId = new Map<string, any>();
          overviewData.forEach((row: any) => {
            if (row?.group_id) byId.set(row.group_id, row);
          });
          items.forEach((g) => {
            const o = byId.get(g.id);
            if (!o) return;
            g.last_access_at = o.last_access_at;
            g.members_count = typeof o.members_count === "number" ? o.members_count : Number(o.members_count ?? 0);
          });
        }
      }

      return { items, count: count ?? 0 };
    },
    enabled: isAuthenticated,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("groups")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Status atualizado", "Dados salvos com sucesso.");
      refetch();
    },
    onError: (err: any) => {
      notify.error("Não foi possível atualizar status", "Algo deu errado. Tente novamente.");
    },
  });

  const updateInviteMutation = useMutation({
    mutationFn: async ({ id, invite_link }: { id: string; invite_link: string | null }) => {
      const { error } = await supabase
        .from("groups")
        .update({ invite_link })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Convite atualizado", "Dados salvos com sucesso.");
      setEditInviteGroup(null);
      setInviteLinkInput("");
      refetch();
    },
    onError: (err: any) => {
      notify.error("Não foi possível atualizar convite", "Algo deu errado. Tente novamente.");
    },
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Gerenciar grupos" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const getStatusLabel = (status: GroupRow["status"]) => {
    if (!status) return "Indefinido";
    if (status === "active") return "Ativo";
    if (status === "inactive") return "Inativo";
    if (status === "suspended") return "Suspenso";
    return status;
  };

  const columns = [
    { key: "name", header: "Nome" },
    {
      key: "organizations",
      header: "Organização",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-sm text-muted-foreground">{g.organizations?.name || "-"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (g: GroupRow) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          g.status === "active"
            ? "bg-success/10 text-success"
            : g.status === "suspended"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
        }`}>
          {getStatusLabel(g.status)}
        </span>
      ),
    },
    {
      key: "members_count",
      header: "Membros",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-sm tabular-nums">{typeof g.members_count === "number" ? g.members_count.toLocaleString("pt-BR") : "—"}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-sm text-muted-foreground">{g.created_at ? formatDateSimpleBR(g.created_at) : "—"}</span>
      ),
    },
    {
      key: "last_access_at",
      header: "Último acesso",
      hideOn: "sm",
      render: (g: GroupRow) => (
        <span className="text-sm text-muted-foreground">{g.last_access_at ? formatDateSimpleBR(g.last_access_at) : "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right w-0",
      render: (g: GroupRow) => (
        <RowActions>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/groups/${g.id}`); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Abrir grupo
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: g.id, status: g.status === "active" ? "inactive" : "active" }); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            {g.status === "active" ? "Desativar" : "Reativar"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditInviteGroup(g); setInviteLinkInput(g.invite_link || ""); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Editar convite
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRemoveGroup(g); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Arquivar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCascadeGroup(g); }}
            className="w-full text-left px-2 py-1.5 text-sm text-destructive"
          >
            Excluir grupo
          </button>
        </RowActions>
      ),
    },
  ];

  return (
    <AdminLayout title="Gerenciar grupos" subtitle="Central de Comando › Grupos">
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Grupos" }]}
          title="Grupos"
          description="Gerenciar grupos do sistema"
          filters={(
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar por nome"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
              <select
                value={orgFilter}
                onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="">Todas as organizações</option>
                {(organizations ?? []).map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="created_at">Ordenar por Data</option>
                <option value="name">Ordenar por Nome</option>
              </select>
              <select
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          )}
          showClearFilters={!!search || !!orgFilter || statusFilter !== 'all'}
          onClearFilters={() => { setSearch(""); setOrgFilter(""); setStatusFilter('all'); setOrderBy('created_at'); setOrderDir('desc'); setPage(1); }}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Total de grupos</span>
          <Badge variant="secondary" className="tabular-nums">
            {typeof groupsData?.count === "number" ? groupsData.count.toLocaleString("pt-BR") : "—"}
          </Badge>
        </div>

        <BorisTable
          columns={columns as any}
          data={groupsData?.items ?? []}
          keyExtractor={(g) => g.id}
          onRowClick={(g) => navigate(`/groups/${g.id}`)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={groupsData?.count}
          onPageChange={setPage}
          loading={isLoading}
          error={!!error}
          onRetry={() => refetch()}
          emptyIcon={Users}
          emptyMessage="Não há grupos cadastrados."
        />

        <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Arquivar grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                O grupo será arquivado e não aparecerá nas listas. Os dados históricos serão preservados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!removeGroup) return;
                  setRemovingGroup(true);
                  try {
                    const { error } = await supabase
                      .from("groups")
                      .update({ is_archived: true })
                      .eq("id", removeGroup.id);
                    if (error) throw error;
                    notify.success("Grupo arquivado", "Tudo certo.");
                    setRemoveGroup(null);
                    refetch();
                  } catch (err: any) {
                    notify.error("Não foi possível arquivar", "Algo deu errado. Tente novamente.");
                  } finally {
                    setRemovingGroup(false);
                  }
                }}
                disabled={removingGroup}
              >
                Confirmar arquivamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!editInviteGroup} onOpenChange={(open) => !open && setEditInviteGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Editar link de convite</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Informe o link de convite do WhatsApp para revalidar o grupo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={inviteLinkInput}
                onChange={(e) => setInviteLinkInput(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setEditInviteGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!editInviteGroup) return;
                  const v = inviteLinkInput.trim();
                  const value = v.length ? v : null;
                  updateInviteMutation.mutate({ id: editInviteGroup.id, invite_link: value });
                }}
              >
                Salvar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!cascadeGroup} onOpenChange={(open) => !open && setCascadeGroup(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo e todos os dados associados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              {deletingCascade && (
                <div className="text-xs text-muted-foreground">Excluindo…</div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setCascadeGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!cascadeGroup) return;
                  setDeletingCascade(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: {
                        resourceType: "group",
                        resourceId: cascadeGroup.id,
                      },
                    });
                    if (error) throw error;
                    notify.success("Grupo excluído", "Tudo certo.");
                    setCascadeGroup(null);
                    refetch();
                  } catch (err: any) {
                    const parsed = await parseInvokeError(err);
                    if (parsed.code === "NETWORK_ERROR") {
                      notify.error("Falha de conexão", parsed.message);
                      return;
                    }
                    if (parsed.code === "DEPENDENCIES_EXIST") {
                      notify.warning("Dependências existentes", "Ainda há registros vinculados a este grupo.");
                      return;
                    }
                    if (parsed.code === "FORBIDDEN" || /forbidden/i.test(parsed.message)) {
                      notify.error("Acesso negado", "Apenas admins do sistema podem excluir grupos.");
                      return;
                    }
                    if (parsed.code === "UNAUTHORIZED" || /unauthorized/i.test(parsed.message)) {
                      notify.error("Sessão expirada", "Faça login novamente.");
                      return;
                    }
                    notify.error("Não foi possível excluir", parsed.message);
                  } finally {
                    setDeletingCascade(false);
                  }
                }}
                disabled={deletingCascade}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AdminLayout>
  );
}
