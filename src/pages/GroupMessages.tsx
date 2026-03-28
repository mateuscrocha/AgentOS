import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, MessageSquare, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { buildPagination, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { MessageDetailsDrawer } from "@/components/messages/MessageDetailsDrawer";
import { Button } from "@/components/ui/button";
import { useUserRoles } from "@/hooks/use-user-roles";
import { ImportMessagesModal } from "@/components/modals/ImportMessagesModal";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { translateMessageType } from "@/lib/messages";
import { MessageCard } from "@/components/messages/MessageCard";
import { MessageFilters } from "@/components/messages/MessageFilters";
import { SkeletonMessageCard } from "@/components/messages/SkeletonMessageCard";
import { useGroupMessages, type MessageFeed } from "@/hooks/use-group-messages";

const PAGE_SIZE = 10;

const GroupMessages = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { canEditGroup, isLoading: rolesLoading } = useUserRoles();
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("q") || "";
  const queryFrom = searchParams.get("from") || "";
  const queryTo = searchParams.get("to") || "";
  const queryMessageId = searchParams.get("messageId") || "";
  const [search, setSearch] = useState(querySearch);
  const [debouncedSearch, setDebouncedSearch] = useState(querySearch);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setSearch(querySearch);
    setDebouncedSearch(querySearch);
    setPage(1);
  }, [querySearch]);

  useEffect(() => {
    setPage(1);
  }, [queryFrom, queryTo]);

  useEffect(() => {
    if (!queryMessageId) return;
    setSelectedMessageId(queryMessageId);
  }, [queryMessageId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      setSearchParams((prev) => {
        const sp = new URLSearchParams(prev);
        if (trimmed) sp.set("q", trimmed);
        else sp.delete("q");
        return sp;
      }, { replace: true });
    }, 300);

    return () => window.clearTimeout(t);
  }, [search, setSearchParams]);

  const safeSearch = debouncedSearch.trim().replace(/,/g, " ");

  const safeFrom = (() => {
    if (!queryFrom) return null;
    const d = new Date(`${queryFrom}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  })();

  const safeTo = (() => {
    if (!queryTo) return null;
    const d = new Date(`${queryTo}T23:59:59.999`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  })();

  const {
    groupInfo,
    totalMembersCount,
    lastMessageAt,
    messagesData,
    pageMentionsMap,
    reactionsMap,
    messagesLoading,
    messagesFetching,
    messagesError,
    refetchMessages,
  } = useGroupMessages({
    groupId,
    page,
    pageSize: PAGE_SIZE,
    typeFilter,
    search: safeSearch,
    fromIso: safeFrom,
    toIso: safeTo,
  });

  const handleViewDetail = async (m: MessageFeed) => {
    if (m.message_type === 'poll') {
      const { data: poll } = await (supabase as any)
        .from('polls')
        .select('id')
        .eq('group_id', groupId)
        .eq('whatsapp_provider_id', m.whatsapp_provider_id)
        .maybeSingle();

      if (poll?.id) {
        navigate(`/groups/${groupId}/polls/${poll.id}`);
        return;
      }
    }
    setSelectedMessageId(m.message_id);
  };

  const hasActiveFilters = !!typeFilter || !!search.trim() || !!queryFrom || !!queryTo;

  const clearAllFilters = () => {
    setTypeFilter("");
    setPage(1);
    setSearch("");
    const sp = new URLSearchParams(searchParams);
    sp.delete("q");
    sp.delete("from");
    sp.delete("to");
    setSearchParams(sp, { replace: true });
  };

  const closeMessageDetails = () => {
    setSelectedMessageId(null);
    if (!queryMessageId) return;
    const sp = new URLSearchParams(searchParams);
    sp.delete("messageId");
    setSearchParams(sp, { replace: true });
  };

  // Loading state
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Mensagens" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Check access via error
  const errorCode = (messagesError as any)?.code;
  if (messagesError && ((messagesError as any).message?.includes("permission") || errorCode === "PGRST301")) {
    return (
      <AccessDenied
        message="Você não tem permissão para acessar as mensagens deste grupo."
      />
    );
  }

  return (
    <AdminLayout 
      title="Mensagens" 
      subtitle={`${messagesData?.count ?? 0} mensagens`}
    >
      <div className="mx-auto max-w-[1480px] animate-fade-in space-y-6 bg-gradient-to-b from-background via-background to-success/5 pb-8 sm:pb-10">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Mensagens" },
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
            <MessageFilters
              search={search}
              onSearchChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              onClearSearch={() => {
                setSearch("");
                setDebouncedSearch("");
                setPage(1);
                const sp = new URLSearchParams(searchParams);
                sp.delete("q");
                setSearchParams(sp, { replace: true });
              }}
              fromDate={queryFrom}
              toDate={queryTo}
              onFromDateChange={(next) => {
                setPage(1);
                const sp = new URLSearchParams(searchParams);
                if (next) sp.set("from", next);
                else sp.delete("from");
                setSearchParams(sp, { replace: true });
              }}
              onToDateChange={(next) => {
                setPage(1);
                const sp = new URLSearchParams(searchParams);
                if (next) sp.set("to", next);
                else sp.delete("to");
                setSearchParams(sp, { replace: true });
              }}
              typeFilter={typeFilter}
              onTypeFilterChange={(next) => {
                setTypeFilter(next);
                setPage(1);
              }}
              hasActiveFilters={hasActiveFilters}
              filtersOpen={filtersOpen}
              setFiltersOpen={setFiltersOpen}
              onClearAll={clearAllFilters}
              isFetching={messagesFetching || search.trim() !== debouncedSearch.trim()}
            />
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
          rightActions={canEditGroup(groupId as string, groupInfo?.orgId) ? (
            <Button onClick={() => setImportOpen(true)} variant="secondary">
              <Upload className="h-4 w-4 mr-2" />
              Importar mensagens
            </Button>
          ) : null}
        />

        {/* Feed */}
        {messagesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonMessageCard key={idx} />
            ))}
          </div>
        ) : messagesError ? (
          <ErrorState 
            message="Falha ao carregar mensagens"
            retry={() => refetchMessages()}
          />
        ) : messagesData?.items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/60 p-4 shadow-subtle sm:p-6">
            <EmptyState
              icon={MessageSquare}
              title={typeFilter || search.trim() ? "Nenhum resultado" : "Nenhuma mensagem"}
              message={
                typeFilter || search.trim()
                  ? `Nenhuma mensagem${typeFilter ? ` do tipo "${translateMessageType(typeFilter)}"` : ""}${search.trim() ? ` contendo "${search.trim()}"` : ""} encontrada.`
                  : "Este grupo ainda não possui mensagens. Quando elas chegarem, você poderá revisar conteúdo, detalhes e filtros de conversa aqui."
              }
              action={canEditGroup(groupId as string, groupInfo?.orgId)
                ? { label: "Importar mensagens", onClick: () => setImportOpen(true) }
                : undefined}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-xl)] border border-border/60 bg-gradient-to-br from-emerald-50/60 via-background to-teal-50/40 p-3 shadow-subtle sm:p-4 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/10">
              <div
                className="space-y-3 rounded-[var(--radius-lg)] border border-white/40 p-2 sm:p-3 dark:border-white/5"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(120,120,120,0.09) 1px, transparent 0)",
                  backgroundSize: "18px 18px",
                }}
              >
                {(messagesData?.items ?? []).map((m) => (
                  <MessageCard
                    key={m.message_id}
                    message={m}
                    groupId={groupId as string}
                    mentionMap={pageMentionsMap}
                    onOpenDetails={handleViewDetail}
                    reactions={reactionsMap[m.message_id] || []}
                  />
                ))}
              </div>
            </div>

            {(() => {
              const totalCount = Number(messagesData?.count ?? 0);
              const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
              if (totalPages <= 1) return null;
              const items = buildPagination(page, totalPages);
              return (
                <div className="rounded-[var(--radius-lg)] border border-success/20 bg-card/95 px-4 py-3 shadow-subtle">
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

        <MessageDetailsDrawer 
          open={!!selectedMessageId}
          onOpenChange={(open) => {
            if (!open) closeMessageDetails();
          }}
          groupId={groupId as string}
          messageId={selectedMessageId as string}
          variant="sheet"
        />

        <ImportMessagesModal
          groupId={groupId as string}
          open={importOpen}
          onOpenChange={(o) => {
            setImportOpen(o);
            if (!o) {
              queryClient.invalidateQueries({ queryKey: ["group-messages-feed", groupId], exact: false });
              queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("group-dashboard"),
              });
            }
          }}
        />
      </div>
    </AdminLayout>
  );
};

export default GroupMessages;
