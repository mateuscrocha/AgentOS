import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Loader2, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react";
import { logEvent } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface KeywordSuggestion {
  term: string;
  count: number;
}

interface ThemeSuggestion {
  phrase: string;
  count: number;
  keywords: KeywordSuggestion[];
}

interface EditIkigaiModalProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel?: string;
  currentKeywords: string[];
  suggestions: {
    themes: ThemeSuggestion[];
    keywords: KeywordSuggestion[];
  };
  groupMetadata?: Record<string, any> | null;
  onApplied?: (newKeywords: string[]) => void;
}

export function EditIkigaiModal({
  groupId,
  open,
  onOpenChange,
  periodLabel = "período",
  currentKeywords,
  suggestions,
  groupMetadata,
  onApplied,
}: EditIkigaiModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [manualValue, setManualValue] = useState<string>("");

  useEffect(() => {
    if (open) {
      setKeywords(Array.from(new Set((currentKeywords || []).map(k => k.trim()).filter(Boolean))));
      setEditingIndex(null);
      setEditingValue("");
      setManualValue("");
    }
  }, [open, currentKeywords]);

  const addKeyword = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setKeywords(prev => Array.from(new Set([...prev, t])));
  };

  const removeKeyword = (term: string) => {
    setKeywords(prev => prev.filter(k => k !== term));
  };

  const startEdit = (idx: number, value: string) => {
    setEditingIndex(idx);
    setEditingValue(value);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const v = editingValue.trim();
    if (!v) return;
    setKeywords(prev => {
      const next = [...prev];
      next[editingIndex] = v;
      return Array.from(new Set(next));
    });
    setEditingIndex(null);
    setEditingValue("");
  };

  const periodNote = useMemo(() => periodLabel, [periodLabel]);

  const suggestedThemes = useMemo(() => (suggestions.themes || []).slice(0, 5), [suggestions.themes]);
  const keywordSuggestions = useMemo(() => suggestions.keywords || [], [suggestions.keywords]);

  const formatMentions = (count: number) => `${count} ${count === 1 ? "menção" : "menções"}`;

  const handleApply = async () => {
    setSaving(true);
    try {
      const base = groupMetadata || {};
      const newMeta = { ...base, ikigai: { ...(base as any)?.ikigai, keywords } };
      const { error } = await supabase
        .from("groups")
        .update({ metadata: newMeta })
        .eq("id", groupId);

      if (error) {
        if (error.code === "42501" || (error.message || "").includes("policy")) {
          notify.error("Sem permissão", "Você não pode atualizar os temas deste grupo.");
        } else {
          notify.error("Não foi possível aplicar mudanças", "Algo deu errado. Tente novamente.");
        }
        return;
      }

      if (user) {
        await logEvent({
          eventType: "GROUP_UPDATED",
          entityType: "group",
          entityId: groupId,
          userId: user.id,
          metadata: { updated: "ikigai.keywords", count: keywords.length },
        });
      }

      notify.success("Temas atualizados", "Tudo certo.");
      queryClient.invalidateQueries({ queryKey: ['group-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['group-ikigai-suggestions'], exact: false });
      onOpenChange(false);
      if (onApplied) onApplied(keywords);
    } catch (e: any) {
      notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Gerenciar Ikigai do Grupo</DialogTitle>
          <p className="text-sm text-muted-foreground">Ajuste os temas para refletirem melhor como o grupo conversa hoje.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                O Ikigai do grupo é definido pelos temas — eles orientam a leitura das conversas e ajudam a interpretar o momento atual.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-card-foreground">Temas atuais</p>
                <p className="text-xs text-muted-foreground">Esses são os temas que hoje definem o propósito do grupo.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {keywords.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tema definido</p>}

                {keywords.map((k, idx) => (
                  <div key={k} className="group inline-flex items-center gap-1">
                    {editingIndex === idx ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-8"
                        />
                        <Button size="sm" variant="secondary" onClick={confirmEdit}>
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingIndex(null);
                            setEditingValue("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/40 text-muted-foreground text-sm font-medium"
                      >
                        {k}
                      </Badge>
                    )}

                    {editingIndex !== idx ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(idx, k)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => removeKeyword(k)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-card-foreground">O que as conversas estão mostrando</p>
                <p className="text-xs text-muted-foreground">Sugestões com base nas conversas ({periodNote}).</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 transition-colors">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-card-foreground">Temas sugeridos</p>
                  <p className="text-xs text-muted-foreground">
                    Esses temas aparecem com frequência nas conversas recentes e podem reforçar o propósito do grupo.
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {suggestedThemes.length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Não identificamos novos temas recorrentes neste período com base nos critérios atuais.
                      </p>
                      <p className="text-xs text-muted-foreground">Você pode tentar analisar outro período ou ajustar os temas existentes.</p>
                    </div>
                  ) : (
                    suggestedThemes.map((t) => (
                      <div
                        key={t.phrase}
                        className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/10 px-3 py-3 transition-colors hover:bg-secondary/20"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-card-foreground truncate">{t.phrase}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatMentions(t.count)}</div>
                        </div>

                        <Button size="sm" variant="secondary" onClick={() => addKeyword(t.phrase)}>
                          Adicionar como tema
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-card-foreground">Palavras frequentes da linguagem do grupo</p>
                  <p className="text-xs text-muted-foreground">
                    Nem todas essas palavras precisam virar temas. Elas ajudam a entender a linguagem do grupo.
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordSuggestions.length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Não encontramos palavras recorrentes neste período.</p>
                      <p className="text-xs text-muted-foreground">Você pode tentar analisar outro período ou revisar os temas definidos.</p>
                    </div>
                  ) : (
                    keywordSuggestions.map((k) => (
                      <Badge
                        key={k.term}
                        variant="outline"
                        className="border-border bg-muted/30 text-muted-foreground text-[11px] font-medium"
                      >
                        <span className="truncate max-w-[160px]">{k.term}</span>
                        <span className="ml-2 tabular-nums opacity-80">{k.count}</span>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-card-foreground">Adicionar manualmente</p>
                <p className="text-xs text-muted-foreground">
                  Use apenas se o tema for importante, mas ainda não aparece nas conversas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Digite um tema"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="h-9"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    addKeyword(manualValue);
                    setManualValue("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar mudanças
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
