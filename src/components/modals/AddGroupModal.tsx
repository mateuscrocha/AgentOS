import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, CheckCircle, Loader2, Users, AlertTriangle } from 'lucide-react';

interface GroupValidation {
  is_valid: boolean;
  is_boris_in_group: boolean;
  provider: string;
  provider_group_id: string;
  group_name: string;
  participants_count: number;
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    provider_member_id: string;
  }>;
  data_incomplete?: boolean;
  data_incomplete_reason?: string;
}

interface AddGroupModalProps {
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (groupId: string) => void;
}

export function AddGroupModal({
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}: AddGroupModalProps) {
  const navigate = useNavigate();
  const [inviteLink, setInviteLink] = useState('');
  const [groupValidation, setGroupValidation] = useState<GroupValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetState = () => {
    setInviteLink('');
    setGroupValidation(null);
    setValidationError(null);
    setIsValidating(false);
    setIsSubmitting(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const validateGroup = async () => {
    if (!inviteLink.trim()) {
      setValidationError('Cole o link de convite do grupo.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setGroupValidation(null);

    try {
      const response = await supabase.functions.invoke('validate-whatsapp-group', {
        body: { invite_link: inviteLink }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao validar grupo');
      }

      const data = response.data as GroupValidation;
      setGroupValidation(data);

      if (!data.is_valid) {
        setValidationError('Esse link não parece válido. Cole o link de convite completo do WhatsApp.');
      } else if (!data.is_boris_in_group) {
        setValidationError('Ainda não encontrei o Bóris no grupo. Adicione o Bóris ao grupo e clique em Validar novamente.');
      }
    } catch (error: any) {
      setValidationError('Erro ao validar grupo. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!groupValidation || !groupValidation.is_valid || !groupValidation.is_boris_in_group || groupValidation.data_incomplete) {
      notify.warning('Validação necessária', 'Valide o grupo antes de continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        organization_id: organizationId,
        group: {
          provider: groupValidation.provider,
          provider_group_id: groupValidation.provider_group_id,
          name: groupValidation.group_name,
          invite_link: inviteLink,
        },
        participants: groupValidation.participants,
      };

      const { data, error } = await supabase.functions.invoke('provision-group', {
        body: payload,
      });

      if (error || !data?.success) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token || '';
          const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/provision-group`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify(payload),
          });
          const json = await res.json().catch(() => null);
          const msg = (json && (json.message || json.error || json.detail)) || (error?.message) || 'Erro ao criar grupo';
          throw new Error(msg);
        } catch (fallbackErr: any) {
          throw new Error(fallbackErr?.message || error?.message || 'Erro ao criar grupo');
        }
      }

      notify.success('Grupo incluído', 'Tudo certo.');
      handleOpenChange(false);
      onSuccess(data.group_id);
    } catch (error: any) {
      notify.error('Não foi possível incluir', 'Algo deu errado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = groupValidation?.is_valid && groupValidation?.is_boris_in_group && !groupValidation?.data_incomplete;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Adicionar Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Adicione um novo grupo do WhatsApp à organização <strong>{organizationName}</strong>.
          </p>

          {/* Invite link input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Link de convite do grupo
            </div>
            <Input
              placeholder="https://chat.whatsapp.com/..."
              value={inviteLink}
              onChange={(e) => {
                setInviteLink(e.target.value);
                setGroupValidation(null);
                setValidationError(null);
              }}
              maxLength={100}
              disabled={isSubmitting}
            />
            
            <Button
              onClick={validateGroup}
              disabled={isValidating || !inviteLink.trim() || isSubmitting}
              className="w-full"
              variant="secondary"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                'Validar grupo'
              )}
            </Button>
          </div>

          {/* Validation result */}
          <AnimatePresence mode="wait">
            {validationError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{validationError}</span>
              </motion.div>
            )}

            {groupValidation?.is_valid && groupValidation?.is_boris_in_group && groupValidation?.data_incomplete && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                  <p className="font-medium">⚠️ Encontrei o Bóris no grupo, mas não consegui obter todas as informações.</p>
                  <p className="mt-1 text-xs">{groupValidation.data_incomplete_reason}</p>
                </div>
                <Button onClick={validateGroup} variant="outline" className="w-full" disabled={isValidating}>
                  {isValidating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  🔄 Tentar novamente
                </Button>
              </motion.div>
            )}

            {isValid && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-lg border border-success/30 bg-success/5 space-y-3"
              >
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Grupo validado!</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome</span>
                    <p className="font-medium">{groupValidation.group_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Participantes</span>
                    <p className="font-medium">{groupValidation.participants_count}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
              <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Incluindo...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Incluir Grupo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
