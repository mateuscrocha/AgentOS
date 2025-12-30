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
  whatsapp_provider_id: string;
  group_name: string;
  participants_count: number;
  participants: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    whatsapp_provider_id: string;
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

type SubmitErrorState = {
  code?: string;
  message: string;
};

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
  const [submitError, setSubmitError] = useState<SubmitErrorState | null>(null);

  const resetState = () => {
    setInviteLink('');
    setGroupValidation(null);
    setValidationError(null);
    setSubmitError(null);
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
    setSubmitError(null);
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
    setSubmitError(null);

    const makeError = (message: string, code?: string) => {
      const err = new Error(message) as any;
      err.code = code;
      return err;
    };

    try {
      const payload = {
        organization_id: organizationId,
        group: {
          provider: 'whatsapp',
          whatsapp_provider_id: groupValidation.whatsapp_provider_id,
          name: groupValidation.group_name,
          invite_link: inviteLink,
        },
        participants: groupValidation.participants,
      };

      const { data, error } = await supabase.functions.invoke('provision-group', {
        body: payload,
      });

      if (error) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token || '';
          const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
          const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/provision-group`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apikey ? { apikey } : {}),
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text().catch(() => '');
          const json = (() => {
            try {
              return raw ? JSON.parse(raw) : null;
            } catch {
              return null;
            }
          })();

          const code: string | undefined =
            json?.code || json?.error?.code || json?.data?.code || (error as any)?.code;

          const msg: string =
            (json && (json.message || json.error?.message || json.error || json.detail)) ||
            (error?.message as string | undefined) ||
            (res.ok ? 'Erro ao criar grupo' : `HTTP ${res.status} ao criar grupo`);

          throw makeError(msg, code);
        } catch (fallbackErr: any) {
          throw makeError(fallbackErr?.message || error?.message || 'Erro ao criar grupo', fallbackErr?.code);
        }
      }

      if (!data?.success) {
        const directMsg = data?.message || 'Erro ao criar grupo';
        throw makeError(directMsg, data?.code);
      }

      notify.success('Grupo incluído', 'Tudo certo.');
      handleOpenChange(false);
      onSuccess(data.group_id);
    } catch (error: any) {
      const errMsg = error?.message || 'Algo deu errado. Tente novamente.';
      const code = error?.code as string | undefined;
      setSubmitError({ code, message: errMsg });
      notify.error('Não foi possível incluir', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = groupValidation?.is_valid && groupValidation?.is_boris_in_group && !groupValidation?.data_incomplete;

  const getSubmitErrorTitle = (code?: string): string => {
    if (!code) return 'Não foi possível incluir o grupo';
    if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID') return 'Sessão inválida';
    if (code === 'ORG_ACCESS_DENIED' || code === 'RLS_DENIED' || code === 'FORBIDDEN') return 'Sem permissão';
    if (code === 'GROUP_ALREADY_EXISTS') return 'Grupo já incluído';
    if (
      code === 'ORG_ID_REQUIRED' ||
      code === 'GROUP_DATA_INCOMPLETE' ||
      code === 'INVALID_PARTICIPANTS' ||
      code === 'UNSUPPORTED_PROVIDER'
    ) {
      return 'Dados inválidos';
    }
    return 'Erro ao incluir o grupo';
  };

  const getSubmitErrorHint = (code?: string): string | null => {
    if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID') {
      return 'Faça login novamente e tente de novo.';
    }
    if (code === 'ORG_ACCESS_DENIED' || code === 'RLS_DENIED' || code === 'FORBIDDEN') {
      return 'Para incluir grupos, você precisa ser Gestor de Organização (desta organização) ou Admin do Sistema.';
    }
    if (code === 'GROUP_ALREADY_EXISTS') {
      return 'Use a lista de grupos da organização para localizar o grupo existente.';
    }
    if (
      code === 'ORG_ID_REQUIRED' ||
      code === 'GROUP_DATA_INCOMPLETE' ||
      code === 'INVALID_PARTICIPANTS' ||
      code === 'UNSUPPORTED_PROVIDER'
    ) {
      return 'Valide o grupo novamente e confirme o link de convite completo.';
    }
    return null;
  };

  const copyErrorDetails = async () => {
    if (!submitError) return;
    const txt = JSON.stringify(
      {
        context: 'provision-group',
        organization_id: organizationId,
        code: submitError.code,
        message: submitError.message,
        invite_link: inviteLink,
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(txt);
      notify.success('Detalhes copiados', 'Envie isso para suporte/diagnóstico.');
    } catch {
      notify.error('Não foi possível copiar', 'Copie manualmente pela tela de diagnóstico.');
    }
  };

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
                setSubmitError(null);
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

            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="font-medium">{getSubmitErrorTitle(submitError.code)}</div>
                    <div>{submitError.message}</div>
                    {getSubmitErrorHint(submitError.code) && (
                      <div className="text-xs text-destructive/80">{getSubmitErrorHint(submitError.code)}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(submitError.code === 'AUTH_REQUIRED' || submitError.code === 'AUTH_INVALID') && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate('/auth')}
                      disabled={isSubmitting}
                    >
                      Fazer login
                    </Button>
                  )}

                  {(submitError.code === 'ORG_ACCESS_DENIED' || submitError.code === 'RLS_DENIED' || submitError.code === 'FORBIDDEN') && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate('/account')}
                        disabled={isSubmitting}
                      >
                        Ver minha conta
                      </Button>
                    </>
                  )}

                  {submitError.code === 'GROUP_ALREADY_EXISTS' && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        handleOpenChange(false);
                        navigate(`/organization/${organizationId}/groups`);
                      }}
                      disabled={isSubmitting}
                    >
                      Ver grupos
                    </Button>
                  )}

                  {(submitError.code === 'ORG_ID_REQUIRED' ||
                    submitError.code === 'GROUP_DATA_INCOMPLETE' ||
                    submitError.code === 'INVALID_PARTICIPANTS' ||
                    submitError.code === 'UNSUPPORTED_PROVIDER') && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={validateGroup}
                      disabled={isValidating || isSubmitting}
                    >
                      Revalidar grupo
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSubmit}
                    disabled={!isValid || isSubmitting}
                  >
                    Tentar novamente
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyErrorDetails}
                    disabled={isSubmitting}
                  >
                    Copiar detalhes
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSubmitError(null)}
                    disabled={isSubmitting}
                  >
                    Ocultar
                  </Button>
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
