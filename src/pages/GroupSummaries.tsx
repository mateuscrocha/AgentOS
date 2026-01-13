import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, HelpCircle, Link as LinkIcon, Users } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDescriptiveBR } from "@/lib/date";
import { formatWhatsAppRichText } from "@/lib/whatsapp-format";
import { useAuth } from "@/hooks/use-auth";

import AccessDenied from "./AccessDenied";

type GroupDailySummaryRow = {
  id: string;
  group_id: string;
  summary_date: string;
  summary_text: string;
  created_at: string;
};

function asNoonUTCFromDateOnly(dateOnly: string): string {
  const raw = (dateOnly || "").trim();
  if (!raw) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
  return raw;
}

function getString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getGroupSummariesErrorCopy(error: unknown): { title: string; message: string; isAccessDenied?: boolean } {
  const anyErr = error as any;
  const code = getString(anyErr?.code);
  const msg = getString(anyErr?.message);
  const lower = msg.toLowerCase();

  const isAccessDenied =
    code === "PGRST301" ||
    code === "42501" ||
    code === "401" ||
    code === "403" ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized");

  if (isAccessDenied) {
    return {
      title: "Acesso negado",
      message: "Você não tem permissão para acessar os resumos deste grupo.",
      isAccessDenied: true,
    };
  }

  const isSchema =
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("schema");

  if (isSchema) {
    return {
      title: "Atualização pendente",
      message: "O servidor ainda não está atualizado para esta versão. Tente novamente em instantes.",
    };
  }

  const isNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("load failed");

  if (isNetwork) {
    return {
      title: "Falha de conexão",
      message: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    };
  }

  return {
    title: "Não foi possível carregar os resumos",
    message: "Tente novamente.",
  };
}

function normalizeWhitespace(input: string): string {
  return (input || "").replace(/\s+/g, " ").trim();
}

function stripEmojis(input: string): string {
  const raw = (input || "").toString();
  return raw.replace(/\u200D|\uFE0F/g, "").replace(/\p{Extended_Pictographic}/gu, "");
}

function cleanPreviewText(input: string): string {
  const raw = (input || "").toString();
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCodeBlocks
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
  const joined = lines.join(" ");
  const withoutUrls = joined.replace(/https?:\/\/[^\s)\]}>,]+/gi, " ");
  const withoutMarkers = withoutUrls.replace(/[*_~`]+/g, " ");
  const withoutEmojis = stripEmojis(withoutMarkers);
  return normalizeWhitespace(withoutEmojis);
}

function pickPreviewText(text: string): string {
  const normalized = cleanPreviewText(text);
  if (!normalized) return "";
  const min = 180;
  const max = 220;
  if (normalized.length <= max) return normalized;

  const window = normalized.slice(0, max + 1);
  let cut = -1;
  for (let i = Math.min(window.length - 1, max); i >= min; i--) {
    const ch = window[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      cut = i + 1;
      break;
    }
  }

  if (cut === -1) {
    cut = max;
    const sliced = normalized.slice(0, cut);
    return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
  }

  return normalized.slice(0, cut).trimEnd() + "…";
}

function pickQuickView(text: string): string {
  const raw = (text || "").trim();
  if (!raw) return "";

  const parts = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const firstRaw = parts[0] || raw;
  const cleaned = cleanPreviewText(firstRaw);
  if (!cleaned) return "";

  const min = 140;
  const max = 260;
  if (cleaned.length <= max) return cleaned;

  const window = cleaned.slice(0, max + 1);
  let cut = -1;
  for (let i = Math.min(window.length - 1, max); i >= min; i--) {
    const ch = window[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      cut = i + 1;
      break;
    }
  }

  if (cut === -1) {
    const sliced = cleaned.slice(0, max);
    return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
  }

  return cleaned.slice(0, cut).trimEnd() + "…";
}

function extractLinks(text: string): string[] {
  const raw = text || "";
  const matches = raw.match(/https?:\/\/[^\s)\]}>,]+/gi) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const cleaned = m.replace(/[),.;:]+$/g, "");
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function extractDiscussionPoints(text: string): string[] {
  const raw = text || "";
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (v: string) => {
    let s = cleanPreviewText(v);
    s = s.replace(
      /^(?:perguntas?|quest(?:ões|oes)|discuss(?:ão|ao)|ponto(?:s)?|tema(?:s)?|assunto(?:s)?|tópico(?:s)?)[\s:–-]+/i,
      ""
    );
    s = normalizeWhitespace(s);
    if (!s) return;
    const lower = s.toLowerCase();
    if (lower.startsWith("o que gerou discussão")) return;
    if (lower.startsWith("visão rápida")) return;
    if (s.length < 6) return;
    if (s.length > 240) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  for (const line of lines) {
    if (!line) continue;
    if (line.includes("?")) {
      const chunks = line.split(/(?<=\?)/g).map((c) => c.trim());
      for (const c of chunks) {
        if (c.endsWith("?")) push(c);
      }
    }
  }

  for (const line of lines) {
    if (!line) continue;
    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet?.[1]) push(bullet[1]);
  }

  return out.slice(0, 10);
}

function extractPeopleMentions(text: string): string[] {
  const raw = text || "";
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (v: string) => {
    const s = normalizeWhitespace(v).replace(/^@+/, "");
    if (!s) return;
    if (s.length < 2) return;
    if (s.length > 40) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  for (const m of raw.matchAll(/@([A-Za-zÀ-ÿ][\wÀ-ÿ._-]{1,40})/g)) {
    add(m[1] || "");
  }

  for (const m of raw.matchAll(/\b([A-ZÀ-Ý][a-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ý][a-zà-ÿ]{2,})+)\b/g)) {
    const v = (m[1] || "").trim();
    if (!v) continue;
    if (v.split(/\s+/).length > 3) continue;
    add(v);
  }

  return out.slice(0, 12);
}

function formatLinkLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
    const shortPath = path.length > 24 ? path.slice(0, 24) + "…" : path;
    return `${host}${shortPath}`;
  } catch {
    return url.length > 42 ? url.slice(0, 42) + "…" : url;
  }
}

const GroupSummaries = () => {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const normalizedGroupId = typeof groupId === "string" ? groupId.trim() : "";
  const [openSummaryId, setOpenSummaryId] = useState<string | null>(null);
  const [openOriginalText, setOpenOriginalText] = useState<Record<string, boolean>>({});

  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, organization_id, provider, sync_status")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      return {
        groupName: group.name,
        orgName: org?.name,
        orgId: group.organization_id,
        provider: group.provider,
        syncStatus: group.sync_status,
      };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ["group-members-total", groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ["group-last-message", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const {
    data: summaries,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["group-summaries", normalizedGroupId],
    queryFn: async () => {
      const { data: dailyData, error: dailyError } = await (supabase as any)
        .from("group_daily_summaries")
        .select("id, group_id, summary_date, summary_text, created_at")
        .eq("group_id", normalizedGroupId)
        .order("summary_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120);
      if (dailyError) throw dailyError;

      return (dailyData ?? []) as unknown as GroupDailySummaryRow[];
    },
    enabled: normalizedGroupId.length > 0 && isAuthenticated,
  });

  const summariesView = useMemo(() => {
    return (summaries ?? []).map((s) => {
      const text = s.summary_text || "";
      const links = extractLinks(text);
      const discussion = extractDiscussionPoints(text);
      const people = extractPeopleMentions(text);
      const preview = pickPreviewText(text);
      const quickView = pickQuickView(text);
      return {
        ...s,
        dateLabel: asNoonUTCFromDateOnly(s.summary_date),
        preview,
        quickView,
        links,
        discussion,
        people,
        flags: {
          hasLinks: links.length > 0,
          hasQuestions: text.includes("?"),
          hasPeople: people.length > 0,
        },
      };
    });
  }, [summaries]);

  if (authLoading) {
    return (
      <AdminLayout title="Resumos do grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  const errorCopy = error ? getGroupSummariesErrorCopy(error) : null;
  if (errorCopy?.isAccessDenied) {
    return <AccessDenied message={errorCopy.message} />;
  }

  return (
    <AdminLayout
      title="Resumos do grupo"
      subtitle="O que aconteceu no grupo, organizado pelo Bóris"
    >
      <div className="space-y-6 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Resumos" },
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
          activeTab="resumos"
        />

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Resumos do grupo</h2>
          <p className="text-sm text-muted-foreground">O que aconteceu no grupo, organizado pelo Bóris</p>
        </div>

        {isLoading ? (
          <LoadingState message="Carregando resumos..." />
        ) : error ? (
          <ErrorState title={errorCopy?.title} message={errorCopy?.message} retry={refetch} />
        ) : summariesView.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum resumo ainda"
            message="Quando o Bóris gerar resumos diários, eles aparecerão aqui para consulta."
          />
        ) : (
          <div className="space-y-3">
            {summariesView.map((s) => {
              const isOpen = openSummaryId === s.id;
              const originalOpen = !!openOriginalText[s.id];
              const canShowQuick = !!s.quickView;
              const canShowDiscussion = s.discussion.length > 0;
              const canShowPeople = s.people.length > 0;
              const canShowLinks = s.links.length > 0;
              const cardTitle = `Resumo do dia${groupInfo?.groupName ? ` • ${groupInfo.groupName}` : ""}`;

              return (
                <div key={s.id} className="rounded-xl border border-border bg-card">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatDateDescriptiveBR(s.dateLabel)}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-card-foreground truncate">{cardTitle}</div>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {s.preview || "Resumo disponível para este dia."}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.flags.hasLinks ? (
                            <Badge variant="secondary" className="gap-1">
                              <LinkIcon className="h-3.5 w-3.5" />
                              Links
                            </Badge>
                          ) : null}
                          {s.flags.hasQuestions ? (
                            <Badge variant="secondary" className="gap-1">
                              <HelpCircle className="h-3.5 w-3.5" />
                              Perguntas
                            </Badge>
                          ) : null}
                          {s.flags.hasPeople ? (
                            <Badge variant="secondary" className="gap-1">
                              <Users className="h-3.5 w-3.5" />
                              Pessoas mencionadas
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isOpen ? "secondary" : "outline"}
                        className="shrink-0"
                        onClick={() => {
                          setOpenSummaryId((curr) => (curr === s.id ? null : s.id));
                          setOpenOriginalText((curr) => ({
                            ...curr,
                            [s.id]: false,
                          }));
                        }}
                      >
                        {isOpen ? "Fechar" : "Ver detalhes"}
                      </Button>
                    </div>

                    {isOpen ? (
                      <div className="mt-5 space-y-4">
                        {canShowQuick ? (
                          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm border-l-4 border-l-primary/60">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-card-foreground">Visão rápida</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">Leitura curta do Bóris</div>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-card-foreground leading-relaxed line-clamp-3">{s.quickView}</p>
                          </section>
                        ) : null}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {canShowDiscussion ? (
                            <section className="lg:col-span-2 rounded-xl border border-border bg-card/40 p-4">
                              <div className="text-sm font-semibold text-card-foreground">O que gerou discussão</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">Perguntas e pontos centrais</div>
                              <ul className="mt-2 space-y-1 text-sm text-card-foreground">
                                {s.discussion.map((item) => (
                                  <li key={item} className="flex gap-2">
                                    <span className="text-muted-foreground">•</span>
                                    <span className="min-w-0">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : null}

                          {canShowPeople ? (
                            <section className="rounded-xl border border-border bg-card/40 p-4">
                              <div className="text-sm font-semibold text-card-foreground">Pessoas mencionadas</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">Menções detectadas no texto</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {s.people.map((p) => (
                                  <span
                                    key={p}
                                    className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-card-foreground/80"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </section>
                          ) : null}
                        </div>

                        {canShowLinks ? (
                          <section className="rounded-xl border border-border bg-card/40 p-4">
                            <div className="text-sm font-semibold text-card-foreground">Links</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">URLs citadas no resumo</div>
                            <ul className="mt-2 space-y-1 text-sm">
                              {s.links.map((href) => (
                                <li key={href} className="flex items-start gap-2">
                                  <span className="text-muted-foreground mt-0.5">•</span>
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-2 break-all"
                                  >
                                    {formatLinkLabel(href)}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        <section className="rounded-xl border border-border bg-secondary/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-card-foreground">Texto original do WhatsApp</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">Conteúdo bruto com formatação convertida</div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setOpenOriginalText((curr) => ({
                                  ...curr,
                                  [s.id]: !curr[s.id],
                                }));
                              }}
                            >
                              {originalOpen ? "Ocultar texto completo do WhatsApp" : "Ver texto completo do WhatsApp"}
                            </Button>
                          </div>

                          {originalOpen ? (
                            <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-sm text-card-foreground break-words">
                              {formatWhatsAppRichText(s.summary_text)}
                            </div>
                          ) : null}
                        </section>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default GroupSummaries;
