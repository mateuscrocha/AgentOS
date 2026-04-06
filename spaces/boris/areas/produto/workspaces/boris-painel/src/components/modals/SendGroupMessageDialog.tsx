import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SendGroupMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  isSubmitting?: boolean;
  canSend?: boolean;
  unavailableReason?: string;
  onSubmit: (message: string) => Promise<void> | void;
};

export function SendGroupMessageDialog({
  open,
  onOpenChange,
  groupName,
  isSubmitting = false,
  canSend = true,
  unavailableReason,
  onSubmit,
}: SendGroupMessageDialogProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setMessage("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Enviar mensagem</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Mensagem para o grupo <span className="font-medium text-foreground">{groupName || "selecionado"}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a mensagem que será enviada ao grupo"
            className="min-h-32"
            disabled={isSubmitting || !canSend}
          />
          {!canSend && unavailableReason ? (
            <div className="text-xs text-muted-foreground">{unavailableReason}</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmit(message)}
            disabled={isSubmitting || !canSend || !message.trim()}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </span>
            ) : (
              "Enviar mensagem"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
