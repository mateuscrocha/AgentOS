import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

interface Group {
  id: string;
  name: string;
  organization_id: string;
  provider: string;
  whatsapp_provider_id: string | null;
}

interface EditGroupModalProps {
  group: Group | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditGroupModal({
  group,
  open,
  onOpenChange,
  onSuccess: _onSuccess,
}: EditGroupModalProps) {
  const name = group?.name || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Detalhes do Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              readOnly
              placeholder="Nome do grupo"
              className="bg-muted/40"
            />
          </div>

          {/* Read-only fields */}
          {group && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Campos somente leitura
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Provider</Label>
                  <p className="text-sm text-card-foreground font-medium capitalize">
                    {group.provider}
                  </p>
                </div>
                
                {group.whatsapp_provider_id && (
                  <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Provider ID</Label>
                  <p className="text-sm text-card-foreground font-mono text-xs">
                      {group.whatsapp_provider_id}
                  </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
