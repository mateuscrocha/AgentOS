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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
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

  useEffect(() => {
    if (open) {
      setKeywords(Array.from(new Set((currentKeywords || []).map(k => k.trim()).filter(Boolean))));
      setEditingIndex(null);
      setEditingValue("");
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

  const periodNote = useMemo(() => `Sugestões baseadas nas conversas do ${periodLabel}`, [periodLabel]);

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
          toast.error("Sem permissão para atualizar os temas deste grupo");
        } else {
          toast.error(error.message || "Erro ao aplicar mudanças");
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

      toast.success("Temas do grupo atualizados");
      queryClient.invalidateQueries({ queryKey: ['group-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['group-ikigai-suggestions'], exact: false });
      onOpenChange(false);
      if (onApplied) onApplied(keywords);
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar mudanças");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Gerenciar Ikigai do Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-card-foreground">Temas atuais</p>
            <div className="flex flex-wrap gap-2">
              {keywords.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum tema definido</p>
              )}
              {keywords.map((k, idx) => (
                <div key={k} className="flex items-center gap-2">
                  {editingIndex === idx ? (
                    <div className="flex items-center gap-2">
                      <Input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={confirmEdit}>OK</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingIndex(null); setEditingValue(""); }}>Cancelar</Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-sm">
                      {k}
                    </Badge>
                  )}
                  {editingIndex !== idx && (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(idx, k)}>
                      <PencilLine className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeKeyword(k)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-card-foreground">{periodNote}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Temas sugeridos</p>
                <div className="space-y-3">
                  {(suggestions.themes || []).length === 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Não identificamos novos temas recorrentes neste período com base nos critérios atuais.</p>
                      <p className="text-xs text-muted-foreground">Você pode tentar analisar outro período ou ajustar os temas existentes.</p>
                    </div>
                  )}
                  {(suggestions.themes || []).map(t => (
                    <div key={t.phrase} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm">{t.phrase}</Badge>
                          <span className="text-xs text-muted-foreground">{t.count}</span>
                        </div>
                        <Button size="sm" onClick={() => addKeyword(t.phrase)}>
                          <Plus className="h-4 w-4" />
                          Aceitar
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(t.keywords || []).map(k => (
                          <Button key={`${t.phrase}-${k.term}`} size="sm" variant="outline" onClick={() => addKeyword(k.term)}>
                            {k.term}
                            <span className="ml-2 text-xs text-muted-foreground">{k.count}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Keywords sugeridas</p>
                <div className="flex flex-wrap gap-2">
                  {(suggestions.keywords || []).length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Não encontramos novas keywords recorrentes neste período.</p>
                      <p className="text-xs text-muted-foreground">Você pode tentar analisar outro período ou revisar os temas definidos.</p>
                    </div>
                  ) : (
                    (suggestions.keywords || []).map(k => (
                      <Button key={k.term} size="sm" variant="outline" onClick={() => addKeyword(k.term)}>
                        {k.term}
                        <span className="ml-2 text-xs text-muted-foreground">{k.count}</span>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-card-foreground">Adicionar manualmente</p>
            <div className="flex items-center gap-2">
              <Input placeholder="Digite um tema" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-9" />
              <Button onClick={() => { addKeyword(editingValue); setEditingValue(""); }}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
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
