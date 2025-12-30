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
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { Button } from "@/components/ui/button";
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
import { AddGroupModal } from "@/components/modals/AddGroupModal";

interface GroupRow {
  id: string;
  name: string;
  provider: string;
  status: string | null;
  organization_id: string;
  organizations?: { name: string } | null;
  invite_link?: string | null;
}

interface OrganizationOption { id: string; name: string; }

const PAGE_SIZE = 10;

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
  const [confirmCascadeName, setConfirmCascadeName] = useState("");
  const [deletingCascade, setDeletingCascade] = useState(false);

  const [selectCreateOrgOpen, setSelectCreateOrgOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupOrgId, setCreateGroupOrgId] = useState<string>("");

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
        .select("id, name, provider, status, organization_id, invite_link, organizations(name)", { count: "exact" });

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
      return { items: (data ?? []) as GroupRow[], count: count ?? 0 };
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
            onClick={(e) => { e.stopPropagation(); setCascadeGroup(g); setConfirmCascadeName(""); }}
            className="w-full text-left px-2 py-1.5 text-sm text-destructive"
          >
            Excluir em cascata
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
          actions={(
            <Button
              onClick={() => {
                if (orgFilter) {
                  setCreateGroupOrgId(orgFilter);
                  setCreateGroupOpen(true);
                  return;
                }

                if (!organizations?.length) {
                  notify.warning("Atenção", "Selecione uma organização para incluir um grupo.");
                  return;
                }

                setCreateGroupOrgId(organizations[0].id);
                setSelectCreateOrgOpen(true);
              }}
            >
              Novo grupo
            </Button>
          )}
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
              <AlertDialogTitle className="text-card-foreground">Excluir grupo em cascata</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível e removerá o grupo e todos os dados associados.
                Digite o nome do grupo para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={confirmCascadeName}
                onChange={(e) => setConfirmCascadeName(e.target.value)}
                placeholder={cascadeGroup?.name || "Nome do grupo"}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2" onClick={() => setCascadeGroup(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!cascadeGroup) return;
                  if (confirmCascadeName !== cascadeGroup.name) {
                    notify.warning("Confirmação incorreta", "Digite o nome do grupo exatamente.");
                    return;
                  }
                  setDeletingCascade(true);
                  try {
                    const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                      body: { resourceType: "group", resourceId: cascadeGroup.id },
                    });
                    if (error) throw error;
                    notify.success("Grupo excluído", "Tudo certo.");
                    setCascadeGroup(null);
                    refetch();
                  } catch (err: any) {
                    notify.error("Não foi possível excluir", "Algo deu errado. Tente novamente.");
                  } finally {
                    setDeletingCascade(false);
                  }
                }}
                disabled={deletingCascade || confirmCascadeName !== cascadeGroup?.name}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={selectCreateOrgOpen} onOpenChange={setSelectCreateOrgOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-card-foreground">Novo grupo</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Selecione a organização onde o grupo será incluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <select
                value={createGroupOrgId}
                onChange={(e) => setCreateGroupOrgId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                {(organizations ?? []).map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!createGroupOrgId) {
                    notify.warning("Atenção", "Selecione uma organização.");
                    return;
                  }
                  setOrgFilter(createGroupOrgId);
                  setPage(1);
                  setSelectCreateOrgOpen(false);
                  setCreateGroupOpen(true);
                }}
              >
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <AddGroupModal
        organizationId={createGroupOrgId}
        organizationName={(organizations ?? []).find((o) => o.id === createGroupOrgId)?.name || ""}
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={(groupId) => {
          refetch();
          navigate(`/groups/${groupId}`);
        }}
      />
    </AdminLayout>
  );
}
