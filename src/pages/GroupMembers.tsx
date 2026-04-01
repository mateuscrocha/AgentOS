import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams } from "react-router-dom";
import { Users, Search, X, Filter, ChevronLeft, ChevronRight, Loader2, Shield, BarChart3, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { buildPagination, cn, formatPhoneE164BR, getInitialsFromName, getMemberAccessLevel } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge, RoleBadge, StatusBadge, type MemberStatusKey } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterTriggerButton } from "@/components/ui/filter-trigger-button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 
import AccessDenied from "./AccessDenied";
import { MemberDetailsDrawer } from "@/components/members/MemberDetailsDrawer";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/sonner";
import { formatDateSimpleBR } from "@/lib/date";

const PAGE_SIZE = 10;
const EXPORT_PAGE_SIZE = 500;

const ROLE_FILTER_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "superadmin", label: "Superadmins" },
  { key: "admin", label: "Admins" },
  { key: "member", label: "Membros" },
] as const;

interface Member {
  id: string;
  name: string;
  phone_e164: string | null;
  display_name: string | null;
  lid: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  provider: string;
  whatsapp_provider_id: string | null;
  profile_pic_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  last_seen_message_at: string | null;
  status: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
  raw_provider: Record<string, any> | null;
}

const MEMBER_EXPORT_HEADERS = [
  "id",
  "group_id",
  "name",
  "display_name",
  "phone_e164",
  "lid",
  "is_admin",
  "is_super_admin",
  "is_owner",
  "status",
  "provider",
  "provider_member_id",
  "whatsapp_provider_id",
  "profile_pic_url",
  "joined_at",
  "left_at",
  "last_seen_message_at",
  "created_at",
  "updated_at",
  "deleted_at",
  "metadata",
  "raw_provider",
] as const;

const escapeCsvValue = (value: unknown) => {
  const stringValue =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const escapedValue = stringValue.replace(/"/g, '""');
  return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
};

const buildMembersCsv = (rows: Array<Member & { group_id: string; is_owner: boolean | null; provider_member_id: string | null }>) => {
  const lines = [MEMBER_EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(MEMBER_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(","));
  }
  return lines.join("\n");
};

const sanitizeFilenamePart = (value?: string | null) =>
  (value || "grupo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "grupo";

type MemberRoleKey = "SUPERADMIN" | "ADMIN" | "MEMBRO";

const getMemberRoleKey = (m: Pick<Member, "is_super_admin" | "is_admin">): MemberRoleKey => {
  const level = getMemberAccessLevel(m);
  if (level === "superadmin") return "SUPERADMIN";
  if (level === "admin") return "ADMIN";
  return "MEMBRO";
};

const GroupMembers = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "admin" | "member">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  


  // Fetch group info for breadcrumbs
  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('name, organization_id, provider, sync_status')
        .eq('id', groupId)
        .maybeSingle();
      
      if (!group) return null;

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.organization_id)
        .maybeSingle();

      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id, provider: group.provider, syncStatus: group.sync_status };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch members
  const { data: membersData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['group-members', groupId, page, debouncedSearch, roleFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('members')
        .select('*', { count: 'exact' })
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (roleFilter === 'superadmin') {
        query = query.eq('is_super_admin', true);
      }

      if (roleFilter === 'admin') {
        query = query.eq('is_admin', true).eq('is_super_admin', false);
      }

      if (roleFilter === 'member') {
        query = query.eq('is_admin', false).eq('is_super_admin', false);
      }
      
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,phone_e164.ilike.%${debouncedSearch}%,display_name.ilike.%${debouncedSearch}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: (data ?? []) as Member[], count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ['group-members-total', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .neq('status', 'inactive');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ['group-last-message', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const last30StartISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const { data: membersOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ["group-members-overview", groupId, last30StartISO],
    queryFn: async () => {
      const [activeMembers, admins, inactive30d, msgs30d] = await Promise.all([
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .is("deleted_at", null)
          .is("left_at", null)
          .eq("status", "active"),
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .is("deleted_at", null)
          .is("left_at", null)
          .or("is_super_admin.eq.true,is_admin.eq.true"),
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .is("deleted_at", null)
          .is("left_at", null)
          .or(`last_seen_message_at.is.null,last_seen_message_at.lt.${last30StartISO}`),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .is("deleted_at", null)
          .gte("created_at", last30StartISO),
      ]);

      const err = activeMembers.error || admins.error || inactive30d.error || msgs30d.error;
      if (err) throw err;

      const activeCount = activeMembers.count ?? 0;
      const messagesCount = msgs30d.count ?? 0;
      const avg = activeCount > 0 ? messagesCount / activeCount : 0;

      return {
        activeCount,
        adminsCount: admins.count ?? 0,
        inactive30dCount: inactive30d.count ?? 0,
        avgMsgsPerActiveLast30d: avg,
      };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Loading state
  if (authLoading) {
    return (
      <AdminLayout title="Membros" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Check access via error
  const errorCode = (error as any)?.code;
  if (error && (error.message?.includes('permission') || errorCode === 'PGRST301')) {
    return (
      <AccessDenied 
        message="Você não tem permissão para acessar os membros deste grupo."
      />
    );
  }

  const hasActiveFilters = !!search.trim() || roleFilter !== "all";
  const activeFiltersCount = (search.trim() ? 1 : 0) + (roleFilter !== "all" ? 1 : 0);
  const isSearching = search !== debouncedSearch;
  const roleFilterLabel = ROLE_FILTER_OPTIONS.find((opt) => opt.key === roleFilter)?.label;
  const filteredCountLabel = hasActiveFilters
    ? ` • ${(membersData?.count ?? 0).toLocaleString("pt-BR")} encontrados`
    : "";

  const handleExportMembers = async () => {
    if (!groupId || isExporting) return;

    setIsExporting(true);

    try {
      let from = 0;
      const rows: Array<Member & { group_id: string; is_owner: boolean | null; provider_member_id: string | null }> = [];

      while (true) {
        const to = from + EXPORT_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("members")
          .select(`
            id,
            group_id,
            name,
            display_name,
            phone_e164,
            lid,
            is_admin,
            is_super_admin,
            is_owner,
            status,
            provider,
            provider_member_id,
            whatsapp_provider_id,
            profile_pic_url,
            joined_at,
            left_at,
            last_seen_message_at,
            created_at,
            updated_at,
            deleted_at,
            metadata,
            raw_provider
          `)
          .eq("group_id", groupId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const batch = (data ?? []) as Array<Member & { group_id: string; is_owner: boolean | null; provider_member_id: string | null }>;
        rows.push(...batch);

        if (batch.length < EXPORT_PAGE_SIZE) break;
        from += EXPORT_PAGE_SIZE;
      }

      if (rows.length === 0) {
        notify.info("Nenhum membro para exportar", "Esse grupo ainda não possui membros disponíveis para download.");
        return;
      }

      const csv = buildMembersCsv(rows);
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFilenamePart(groupInfo?.groupName)}-membros-completo.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify.success("Exportacao concluida", `${rows.length.toLocaleString("pt-BR")} membros baixados com todas as informacoes.`);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : "Tente novamente em alguns instantes.";
      notify.error("Nao foi possivel baixar os membros", message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminLayout 
      title="Membros" 
      subtitle={`${(totalMembersCount ?? 0).toLocaleString("pt-BR")} membros${filteredCountLabel}`}
    >
      <TooltipProvider>
        <div className="mx-auto max-w-[1480px] animate-fade-in space-y-6 bg-gradient-to-b from-background via-background to-info/5 pb-8 sm:pb-10">
          <GroupPageTop
            breadcrumbItems={[
              { label: "Central de Comando", href: "/" },
              { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
              { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
              { label: "Membros" },
            ]}
            group={{
              groupId: groupId as string,
              organizationId: groupInfo?.orgId || undefined,
              name: groupInfo?.groupName || "",
              provider: groupInfo?.provider || "",
              totalMembers: (totalMembersCount ?? 0) as number,
              lastMessageAt: lastMessageAt ?? null,
              syncStatus: groupInfo?.syncStatus || null,
            }}
            filters={(
              <div className="w-full space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Buscar pessoas..."
                      aria-label="Buscar membros"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="h-11 w-full pl-10 pr-16"
                    />

                    {isSearching || isFetching ? (
                      <Loader2 className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin", search ? "right-10" : "right-3")} />
                    ) : null}

                    {search ? (
                      <button
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label="Limpar busca"
                        type="button"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ) : null}
                  </div>

                  <div className="sm:hidden">
                    <FilterTriggerButton
                      className="w-auto"
                      onClick={() => setFiltersOpen(true)}
                      icon={Filter}
                      activeCount={hasActiveFilters ? activeFiltersCount : undefined}
                    />
                  </div>
                </div>

                {hasActiveFilters ? (
                  <FilterChips
                    items={[
                      ...(search.trim()
                        ? [{
                            key: "search",
                            label: `Busca: ${search.trim()}`,
                            onRemove: () => {
                              setSearch("");
                              setPage(1);
                            },
                            ariaLabel: "Remover filtro de busca",
                          }]
                        : []),
                      ...(roleFilter !== "all"
                        ? [{
                            key: "role",
                            label: `Função: ${roleFilterLabel || roleFilter}`,
                            onRemove: () => {
                              setRoleFilter("all");
                              setPage(1);
                            },
                            ariaLabel: "Remover filtro de função",
                          }]
                        : []),
                    ]}
                  />
                ) : null}

                <div className="hidden rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle sm:flex sm:flex-col sm:items-start sm:gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>Função no grupo</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ROLE_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          roleFilter === opt.key
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-card/95 border-border/80 text-foreground hover:bg-secondary/35"
                        )}
                        onClick={() => {
                          setRoleFilter(opt.key);
                          setPage(1);
                        }}
                      >
                        {opt.label}
                      </button>
                      ))}
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 rounded-xl"
                      onClick={() => {
                        setSearch("");
                        setRoleFilter("all");
                        setPage(1);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>

                <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <DrawerContent className="border-border bg-card">
                    <DrawerHeader className="text-left">
                      <DrawerTitle>Filtrar membros</DrawerTitle>
                      <DrawerDescription>Refine por função para navegar mais rápido.</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-2">
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-foreground">Função</div>
                        <div className="flex flex-wrap gap-2">
                          {ROLE_FILTER_OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              className={cn(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                roleFilter === opt.key
                                  ? "bg-primary text-primary-foreground border-transparent"
                                  : "bg-card/90 border-border/80 text-foreground hover:bg-secondary/25"
                              )}
                              onClick={() => {
                                setRoleFilter(opt.key);
                                setPage(1);
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DrawerFooter>
                      {hasActiveFilters ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setSearch("");
                            setRoleFilter("all");
                            setPage(1);
                            setFiltersOpen(false);
                          }}
                        >
                          Limpar filtros
                        </Button>
                      ) : null}
                      <DrawerClose asChild>
                        <Button type="button">Ver resultados</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
            )}
            showClearFilters={hasActiveFilters}
            onClearFilters={() => {
              setSearch("");
              setRoleFilter("all");
              setPage(1);
            }}
            rightActions={
              <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={handleExportMembers} disabled={isExporting || isLoading}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar membros
              </Button>
            }
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatsCard
              title="Total de membros"
              value={(totalMembersCount ?? 0).toLocaleString("pt-BR")}
              icon={Users}
              variant="kpi"
              help={{
                whatIs: "Quantidade total de membros cadastrados neste grupo.",
                howToInterpret: "Mostra o tamanho atual da base do grupo, independentemente de atividade recente.",
                whatToObserve: "Compare com ‘Admins’ e com métricas de atividade para entender distribuição e engajamento.",
              }}
              className="border-info/20"
              isLoading={overviewLoading}
            />
            <StatsCard
              title="Admins"
              value={(membersOverview?.adminsCount ?? 0).toLocaleString("pt-BR")}
              icon={Shield}
              variant="kpi"
              help={{
                whatIs: "Quantidade de administradores entre os membros do grupo.",
                howToInterpret: "Indica o tamanho da camada de gestão/liderança no grupo.",
                whatToObserve: "Observe a proporção de admins sobre o total para evitar excesso ou falta de cobertura.",
              }}
              className="border-info/20"
              isLoading={overviewLoading}
            />
            <StatsCard
              title="Média msgs/ativo (30d)"
              value={(membersOverview?.avgMsgsPerActiveLast30d ?? 0).toFixed(1).replace(".", ",")}
              icon={BarChart3}
              variant="kpi"
              help={{
                whatIs: "Média de mensagens por membro ativo neste grupo nos últimos 30 dias.",
                howToInterpret: "Mede intensidade média de participação entre quem falou no período.",
                whatToObserve: "Se subir com menos ativos, pode indicar concentração da conversa em poucas pessoas.",
              }}
              className="border-info/20"
              isLoading={overviewLoading}
            />
          </div>

        {isLoading ? (
          <LoadingState message="Carregando membros..." />
        ) : error ? (
          <ErrorState title="Não foi possível carregar os membros" message="Tente novamente em alguns instantes." retry={() => refetch()} />
        ) : (membersData?.items ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title={search.trim() || roleFilter !== "all" ? "Nenhum resultado" : "Nenhum membro"}
            message={search.trim() || roleFilter !== "all" ? "Não encontramos ninguém com esses filtros." : "Este grupo ainda não possui membros."}
            action={hasActiveFilters ? { label: "Limpar filtros", onClick: () => { setSearch(""); setRoleFilter("all"); setPage(1); } } : undefined}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {(membersData?.items ?? []).map((m) => {
                const role = getMemberRoleKey(m);
                const displayName = (m.display_name || m.name || "").toString();
                const hasLeftGroup = !!m.left_at;
                const hasRecentActivity =
                  !hasLeftGroup &&
                  !!m.last_seen_message_at &&
                  new Date(m.last_seen_message_at).getTime() >= new Date(last30StartISO).getTime();
                const statusKey: MemberStatusKey = hasLeftGroup ? "SAIU" : hasRecentActivity ? "ATIVO" : "INATIVO";
                return (
                  <article
                    key={m.id}
                    className="cursor-pointer rounded-[24px] border border-slate-200/90 bg-white px-4 py-4 shadow-[0_22px_45px_-38px_rgba(15,23,42,0.35)] transition-[transform,background-color,box-shadow,border-color] hover:border-info/30 hover:bg-white hover:shadow-[0_30px_60px_-42px_rgba(14,165,233,0.28)] hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
                    onClick={() => setSelectedMemberId(m.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedMemberId(m.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-11 w-11 ring-1 ring-border/60">
                          {m.profile_pic_url ? (
                            <AvatarImage src={m.profile_pic_url} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <AvatarFallback className="bg-muted/40 text-[12px]">{getInitialsFromName(displayName) || ""}</AvatarFallback>
                          )}
                        </Avatar>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0">
                              <div className="text-[15px] sm:text-[16px] font-semibold text-foreground truncate">{displayName}</div>
                            </div>
                            <RoleBadge role={role} />
                          </div>

                          {m.phone_e164 ? (
                            <div className="mt-1 text-xs text-muted-foreground tabular-nums truncate">
                              {formatPhoneE164BR(m.phone_e164) || m.phone_e164}
                            </div>
                          ) : null}

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                              {m.last_seen_message_at ? `Última atividade em ${formatDateSimpleBR(m.last_seen_message_at)}` : "Sem atividade recente"}
                            </span>
                            {m.joined_at ? (
                              <span className="rounded-full border border-info/20 bg-info/10 px-2.5 py-1 font-medium text-info">
                                Entrou em {formatDateSimpleBR(m.joined_at)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <StatusBadge status={statusKey} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {statusKey === "ATIVO"
                              ? "Ativo = enviou mensagem nos últimos 30 dias."
                              : statusKey === "INATIVO"
                                ? "Inativo = sem mensagens nos últimos 30 dias."
                                : "Saiu do grupo."}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {(() => {
              const totalCount = Number(membersData?.count ?? 0);
              const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
              if (totalPages <= 1) return null;
              const items = buildPagination(page, totalPages);
              return (
                <div className="rounded-[var(--radius-lg)] border border-info/20 bg-card/95 px-4 py-3 shadow-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Página <span className="font-medium text-foreground tabular-nums">{page}</span> de{" "}
                      <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
                    </div>

                    <Pagination className="sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            size="default"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page <= 1) return;
                              setPage(page - 1);
                            }}
                            className={cn("gap-1 pl-2.5", page <= 1 && "pointer-events-none opacity-50")}
                            aria-label="Página anterior"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Anterior</span>
                          </PaginationLink>
                        </PaginationItem>

                        <div className="hidden sm:flex items-center gap-1">
                          {items.map((it, idx) => (
                            <PaginationItem key={`${it}-${idx}`}>
                              {it === "ellipsis" ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  href="#"
                                  isActive={it === page}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setPage(it);
                                  }}
                                >
                                  {it}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ))}
                        </div>

                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            size="default"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page >= totalPages) return;
                              setPage(page + 1);
                            }}
                            className={cn("gap-1 pr-2.5", page >= totalPages && "pointer-events-none opacity-50")}
                            aria-label="Próxima página"
                          >
                            <span>Próxima</span>
                            <ChevronRight className="h-4 w-4" />
                          </PaginationLink>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <MemberDetailsDrawer
          open={!!selectedMemberId}
          onOpenChange={(open) => {
            if (!open) setSelectedMemberId(null);
          }}
          memberId={selectedMemberId || ""}
          groupId={groupId}
        />
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
};

export default GroupMembers;
