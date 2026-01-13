import { Users, Wifi, WifiOff, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GroupHeaderProps {
  groupId: string;
  name: string;
  provider: string;
  totalMembers: number;
  lastMessageAt: string | null;
  syncStatus: string | null;
  bottomSlot?: ReactNode;
}

export function GroupHeader({ 
  groupId,
  name, 
  provider, 
  totalMembers, 
  lastMessageAt,
  syncStatus,
  bottomSlot
}: GroupHeaderProps) {
  const { isSystemAdmin } = useUserRoles();
  const queryClient = useQueryClient();

  const { data: groupHeaderInfo } = useQuery({
    queryKey: ["group-header", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, invite_link, metadata")
        .eq("id", groupId)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!groupId,
    staleTime: 60_000,
  });

  const profilePicUrl: string | null =
    (groupHeaderInfo as any)?.metadata?.profile_pic_url ||
    (groupHeaderInfo as any)?.metadata?.profilePicUrl ||
    null;

  const updateGroupDetails = useMutation({
    mutationFn: async () => {
      const inviteLink = String((groupHeaderInfo as any)?.invite_link || "").trim();
      if (!inviteLink) {
        throw new Error("LINK_CONVITE_AUSENTE");
      }

      const response = await supabase.functions.invoke("validate-whatsapp-group", {
        body: { invite_link: inviteLink },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao validar grupo");
      }

      const data = response.data as any;

      if (!data?.is_valid || !data?.is_boris_in_group) {
        throw new Error("VALIDACAO_FALHOU");
      }

      const nextName = typeof data?.group_name === "string" ? data.group_name.trim() : "";
      const nextImage = typeof data?.group_image === "string" ? data.group_image.trim() : "";

      if (!nextName && !nextImage) {
        throw new Error("RESPOSTA_INCOMPLETA");
      }

      const currentMetadata = ((groupHeaderInfo as any)?.metadata ?? {}) as Record<string, any>;
      const nextMetadata = { ...currentMetadata };
      if (nextImage) nextMetadata.profile_pic_url = nextImage;

      const payload: Record<string, any> = { metadata: nextMetadata };
      if (nextName) payload.name = nextName;

      const { error } = await supabase.from("groups").update(payload).eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Grupo atualizado", "Nome e imagem do grupo foram atualizados.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["group-header", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["group-info", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["group-dashboard", groupId] } as any),
      ]);
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      if (msg.includes("LINK_CONVITE_AUSENTE")) {
        notify.warning("Convite necessário", "Configure o link do grupo e tente de novo.");
        return;
      }
      if (msg.includes("VALIDACAO_FALHOU")) {
        notify.warning("Não foi possível validar", "Tente novamente mais tarde.");
        return;
      }
      if (msg.includes("RESPOSTA_INCOMPLETA")) {
        notify.error("Resposta inesperada", "O validador não retornou nome/imagem do grupo.");
        return;
      }
      notify.error("Falha ao atualizar", "Não foi possível atualizar o nome e a imagem do grupo.");
    },
  });

  const getGroupStatus = () => {
    if (syncStatus === 'error') {
      return { label: 'Desconectado', color: 'destructive', icon: WifiOff };
    }
    if (!lastMessageAt) {
      return { label: 'Sem atividade', color: 'muted', icon: AlertCircle };
    }
    const lastMsgDate = new Date(lastMessageAt);
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 48) {
      return { label: 'Inativo', color: 'warning', icon: AlertCircle };
    }
    return { label: 'Ativo', color: 'success', icon: Wifi };
  };

  const groupStatus = getGroupStatus();

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b border-border">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0 overflow-hidden">
          {profilePicUrl ? (
            <img
              src={profilePicUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Users className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-semibold text-card-foreground truncate min-w-0">{name}</h2>
            {isSystemAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 shrink-0"
                onClick={() => updateGroupDetails.mutate()}
                disabled={updateGroupDetails.isPending}
              >
                {updateGroupDetails.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {isSystemAdmin ? (
              <span className="capitalize">{provider}</span>
            ) : (
              <span>{groupStatus.label === 'Desconectado' ? 'Integração desconectada' : 'Integração ativa'}</span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                    groupStatus.color === 'success' && "bg-success/10 text-success",
                    groupStatus.color === 'warning' && "bg-warning/10 text-warning",
                    groupStatus.color === 'destructive' && "bg-destructive/10 text-destructive",
                    groupStatus.color === 'muted' && "bg-muted text-muted-foreground",
                  )}
                >
                  <groupStatus.icon className="h-3 w-3" />
                  {groupStatus.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <div className="text-sm">{totalMembers} membros</div>
                {lastMessageAt ? (
                  <div className="text-xs text-muted-foreground mt-1">Última atividade: {formatDateTime(lastMessageAt)}</div>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      {bottomSlot && (
        <div className="px-5 py-3">
          {bottomSlot}
        </div>
      )}
      
      
    </div>
  );
}
