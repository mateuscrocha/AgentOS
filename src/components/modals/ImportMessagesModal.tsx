import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Loader2, ClipboardList, CheckCircle, AlertTriangle } from "lucide-react";
import { parseWhatsAppExport, sha256Hex, buildImportKey, ParsedMessage } from "@/utils/whatsapp-import";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTimeBR } from "@/lib/date";

interface ImportMessagesModalProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportMessagesModal({ groupId, open, onOpenChange }: ImportMessagesModalProps) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<{ messages: ParsedMessage[]; errors: string[]; periodFrom?: string; periodTo?: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const stats = useMemo(() => {
    if (!validated?.messages?.length) return null;
    const count = validated.messages.length;
    const from = validated.periodFrom ? formatDateTimeBR(validated.periodFrom) : undefined;
    const to = validated.periodTo ? formatDateTimeBR(validated.periodTo) : undefined;
    return { count, from, to };
  }, [validated]);

  const senders = useMemo(() => {
    if (!validated?.messages?.length) return [] as Array<[string, number]>;
    const map = new Map<string, number>();
    for (const m of validated.messages) {
      const k = m.senderRaw || "Desconhecido";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [validated]);

  const reset = () => {
    setRaw("");
    setValidated(null);
    setValidating(false);
    setImporting(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleValidate = async () => {
    if (!raw.trim()) {
      notify.warning("Bloco vazio", "Cole o conteúdo exportado e tente novamente.");
      return;
    }
    setValidating(true);
    try {
      const result = parseWhatsAppExport(raw);
      setValidated(result);
      if (result.messages.length === 0) {
        notify.warning("Nenhuma mensagem detectada", "Verifique o texto e tente novamente.");
      } else {
        notify.success("Validação concluída", "Tudo certo.");
      }
    } catch (e: any) {
      notify.error("Não foi possível validar", "Algo deu errado. Tente novamente.");
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validated?.messages?.length) {
      notify.warning("Validação necessária", "Valide o texto antes de importar.");
      return;
    }
    setImporting(true);
    try {
      const enriched = await Promise.all(validated.messages.map(async (m) => {
        const textHash = await sha256Hex(m.text || "");
        const key = buildImportKey(groupId, m.senderRaw, m.createdAtISO, textHash);
        return { ...m, textHash, importKey: key };
      }));

      const { data, error } = await supabase.functions.invoke("import-manual-messages", {
        body: { group_id: groupId, items: enriched },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Falha ao importar mensagens");
      }

      notify.success(
        "Importação concluída",
        `Foram adicionadas ${data.inserted} mensagens. ${data.duplicates} duplicadas.`,
      );
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("group-dashboard"),
      });
      queryClient.invalidateQueries({ queryKey: ["group-messages-feed", groupId], exact: false });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "message-reactions",
      });
      handleOpenChange(false);
    } catch (e: any) {
      notify.error("Não foi possível importar", "Algo deu errado. Tente novamente.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Importar mensagens
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Cole aqui o texto exportado do WhatsApp (sem mídia)"
            className="min-h-[220px]"
            disabled={importing}
          />

          {validated && (
            <div className="space-y-2">
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Resumo da validação</div>
                  {validated.errors?.length ? (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {validated.errors.length} aviso(s)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-4 w-4" />
                      Pronto para importar
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <div className="text-muted-foreground">Mensagens</div>
                    <div className="font-semibold">{stats?.count ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Início</div>
                    <div className="font-semibold">{stats?.from || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Fim</div>
                    <div className="font-semibold">{stats?.to || "-"}</div>
                  </div>
                </div>
                {senders.length > 0 && (
                  <div className="mt-3 text-xs">
                    <div className="text-muted-foreground">Remetentes detectados</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {senders.slice(0, 10).map(([name, count]) => (
                        <div key={name} className="rounded bg-muted px-2 py-1">
                          {name} ({count})
                        </div>
                      ))}
                      {senders.length > 10 ? (
                        <div className="rounded bg-muted px-2 py-1">+ {senders.length - 10} outros</div>
                      ) : null}
                    </div>
                  </div>
                )}
                {validated.errors?.length ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {validated.errors.slice(0, 5).map((e, i) => (
                      <div key={i} className="truncate">{e}</div>
                    ))}
                    {validated.errors.length > 5 ? (
                      <div className="mt-1">+ {validated.errors.length - 5} outras</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>Cancelar</Button>
            <Button variant="secondary" onClick={handleValidate} disabled={validating || importing || !raw.trim()}>
              {validating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validando...</>) : "Validar importação"}
            </Button>
            <Button onClick={handleImport} disabled={importing || !validated?.messages?.length}>
              {importing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>) : "Confirmar e importar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
