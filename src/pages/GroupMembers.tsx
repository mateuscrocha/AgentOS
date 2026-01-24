import { AdminLayout } from "@/components/layout/AdminLayout";
import { RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams } from "react-router-dom";
import { Users, Search, X, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn, getMemberAccessLevel } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
 
import AccessDenied from "./AccessDenied";
import { MemberDetailsDrawer } from "@/components/members/MemberDetailsDrawer";

const PAGE_SIZE = 10;

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

type MemberRoleKey = "SUPERADMIN" | "ADMIN" | "MEMBRO";

const getMemberRoleKey = (m: Pick<Member, "is_super_admin" | "is_admin">): MemberRoleKey => {
  const level = getMemberAccessLevel(m);
  if (level === "superadmin") return "SUPERADMIN";
  if (level === "admin") return "ADMIN";
  return "MEMBRO";
};

const ROLE_BADGE: Record<MemberRoleKey, { label: string; className: string }> = {
  SUPERADMIN: {
    label: "Super Admin",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  ADMIN: {
    label: "Admin",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  MEMBRO: {
    label: "Membro",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

const MemberRoleBadge = ({ role }: { role: MemberRoleKey }) => {
  const cfg = ROLE_BADGE[role];
  return (
    <span
      className={cn(
        "inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-semibold leading-none",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
};

function buildPagination(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = Array.from(pages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i] as number;
    const prev = sorted[i - 1];
    if (i > 0 && prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
  }
  return out;
}

const GroupMembers = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "admin" | "member">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  


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
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-members', groupId, page, search, roleFilter],
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
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone_e164.ilike.%${search}%,display_name.ilike.%${search}%`);
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
        .is('deleted_at', null);
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

  // Loading state
  if (authLoading) {
    return (
      <AdminLayout title="Members" subtitle="Verificando acesso...">
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

  return (
    <AdminLayout 
      title="Membros" 
      subtitle={`${(totalMembersCount ?? 0).toLocaleString("pt-BR")} membros${search.trim() ? ` • ${(membersData?.count ?? 0).toLocaleString("pt-BR")} encontrados` : ""}`}
    >
      <div className="animate-fade-in -mx-6 -mt-6 px-6 pt-6 pb-10 bg-[#FBFAF6] space-y-6">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
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
                  <input
                    type="text"
                    placeholder="Buscar pessoas..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-10 pr-10 h-11 rounded-xl border border-border/60 bg-card/70 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
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
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl bg-card/70"
                    onClick={() => setFiltersOpen(true)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filtrar
                    </span>
                    {hasActiveFilters ? (
                      <Badge variant="secondary" className="ml-2 h-6 px-2 text-[11px]">
                        Ativo
                      </Badge>
                    ) : null}
                  </Button>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 max-w-2xl">
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    if (v === 'all' || v === 'superadmin' || v === 'admin' || v === 'member') {
                      setRoleFilter(v);
                      setPage(1);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 w-[220px] rounded-xl bg-card/70">
                    <SelectValue placeholder="Função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="superadmin">Superadmins</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="member">Membros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
                <DrawerContent className="bg-card border-border">
                  <DrawerHeader className="text-left">
                    <DrawerTitle>Filtrar membros</DrawerTitle>
                    <DrawerDescription>Refine por função para navegar mais rápido.</DrawerDescription>
                  </DrawerHeader>
                  <div className="px-4 pb-2">
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-foreground">Função</div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { key: "all", label: "Todos" },
                            { key: "superadmin", label: "Superadmins" },
                            { key: "admin", label: "Admins" },
                            { key: "member", label: "Membros" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={cn(
                              "px-3 py-2 rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              roleFilter === opt.key
                                ? "bg-primary text-primary-foreground border-transparent"
                                : "bg-background/60 border-border text-foreground"
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
          onClearFilters={() => { setSearch(""); setRoleFilter('all'); setPage(1); }}
        />

        {isLoading ? (
          <LoadingState message="Carregando membros..." />
        ) : error ? (
          <ErrorState title="Não foi possível carregar os membros" message="Tente novamente em alguns instantes." retry={() => refetch()} />
        ) : (membersData?.items ?? []).length === 0 ? (
          <EmptyState
            icon={Users}
            title={search.trim() || roleFilter !== "all" ? "Nenhum resultado" : "Nenhum membro"}
            message={search.trim() || roleFilter !== "all" ? "Não encontramos ninguém com esses filtros." : "Este grupo ainda não possui membros."}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {(membersData?.items ?? []).map((m) => {
                const role = getMemberRoleKey(m);
                const displayName = (m.display_name || m.name || "").toString();
                const isActive = !m.left_at && m.status === "active";
                const statusLabel = m.left_at ? "Saiu" : isActive ? "Ativo" : (m.status || "—");
                return (
                  <article
                    key={m.id}
                    className="rounded-2xl border border-border/60 bg-card/70 px-4 py-4 sm:px-5"
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
                            <AvatarFallback className="bg-muted/40 text-[12px]">{displayName?.[0]?.toUpperCase() || ""}</AvatarFallback>
                          )}
                        </Avatar>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0">
                              <div className="text-[15px] sm:text-[16px] font-semibold text-foreground truncate">{displayName}</div>
                            </div>
                            <MemberRoleBadge role={role} />
                          </div>

                          {m.phone_e164 ? (
                            <div className="mt-1 text-xs text-muted-foreground tabular-nums truncate">{m.phone_e164}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium",
                            isActive
                              ? "border-success/20 bg-success/10 text-success"
                              : m.left_at
                                ? "border-destructive/20 bg-destructive/10 text-destructive"
                                : "border-border bg-background/60 text-muted-foreground"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-success" : m.left_at ? "bg-destructive" : "bg-muted-foreground")} />
                          {statusLabel}
                        </span>

                        <RowActions>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMemberId(m.id);
                            }}
                            className="w-full text-left px-2 py-1.5 text-sm"
                            type="button"
                          >
                            Ver detalhes
                          </button>
                        </RowActions>
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
                <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
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
    </AdminLayout>
  );
};

export default GroupMembers;
