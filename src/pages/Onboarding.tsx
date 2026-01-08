import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { notify } from "@/components/ui/sonner";
import { getProvisioningErrorMessage, isGroupValidationSuccessful } from '@/utils/onboarding';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Link2, 
  CheckCircle, Loader2, ArrowLeft, Edit2, ChevronRight,
  Users, MailCheck, Copy, MessageCircle
} from 'lucide-react';

type Step = 'welcome' | 'name' | 'email' | 'phone' | 'password' | 'how' | 'prepare_group' | 'group_link' | 'final';

interface FormData {
  name: string;
  email: string;
  whatsapp_phone: string;
  password: string;
  password_confirm: string;
  invite_link: string;
}

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
  success?: boolean;
  code?: string;
  message?: string;
  correlation_id?: string;
}

type AssistantWebhookStatus = 'idle' | 'inflight' | 'success' | 'failed' | 'skipped';

type CreateAssistantWebhookArgs = {
  groupId: string;
  groupName: string;
  organizationId?: string | null;
  organizationName?: string | null;
  inviteLink?: string | null;
  whatsappProviderId?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  rawGroup?: unknown;
};

const STEPS: Step[] = ['welcome', 'name', 'email', 'phone', 'password', 'how', 'prepare_group', 'group_link', 'final'];

function Title({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`text-2xl sm:text-3xl font-semibold tracking-tight text-foreground ${className}`}
    >
      {children}
    </motion.h1>
  );
}

function Subtitle({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`text-base sm:text-lg text-muted-foreground ${className}`}
    >
      {children}
    </motion.p>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    whatsapp_phone: '',
    password: '',
    password_confirm: '',
    invite_link: '',
  });
  const [groupValidation, setGroupValidation] = useState<GroupValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [provisionedGroupId, setProvisionedGroupId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [assistantWebhookStatus, setAssistantWebhookStatus] = useState<AssistantWebhookStatus>('idle');
  const [assistantWebhookError, setAssistantWebhookError] = useState<string | null>(null);

  const createAssistantWebhookArgsRef = useRef<CreateAssistantWebhookArgs | null>(null);
  const createAssistantWebhookInFlightRef = useRef<{ groupId: string; promise: Promise<void> } | null>(null);
  const createAssistantWebhookSucceededRef = useRef<Set<string>>(new Set());

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User already logged in, redirect to dashboard
        navigate('/');
      }
    };
    checkAuth();
  }, [navigate]);

  const progress = (STEPS.indexOf(currentStep) / (STEPS.length - 1)) * 100;

  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const goBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const goNext = async () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1 && isCurrentStepValid()) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isCurrentStepValid() && currentStep !== 'final' && currentStep !== 'group_link') {
      e.preventDefault();
      goNext();
    }
  };

  const normalizePhoneE164 = (phone: string): string => {
    const raw = (phone || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+')) {
      return raw.replace(/\s+/g, '');
    }
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55') && digits.length >= 10) {
      return '+' + digits;
    }
    return '+55' + digits;
  };

  const getSupabaseKey = (): string | undefined => {
    const publishable = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    const anon = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string | undefined;
    return publishable || anon;
  };

  const getSupabaseAnonKey = (): string | undefined => {
    return (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string | undefined;
  };

  const getFunctionUrl = (fnName: string): string => {
    const base = ((import.meta as any).env.VITE_SUPABASE_URL as string | undefined) || '';
    return `${base.replace(/\/+$/, '')}/functions/v1/${fnName}`;
  };

  const safeJsonParse = (raw: string): any => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getCreateAssistantWebhookUrl = (): string | undefined => {
    return (import.meta as any).env.VITE_N8N_WEBHOOK_CREATE_ASSISTANT_URL as string | undefined;
  };

  const callCreateAssistantWebhook = async (args: CreateAssistantWebhookArgs): Promise<void> => {
    const url = getCreateAssistantWebhookUrl();
    if (!url) {
      console.warn('Webhook de criação de assistant não configurado: defina VITE_N8N_WEBHOOK_CREATE_ASSISTANT_URL');
      setAssistantWebhookStatus('skipped');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const payload = {
        id: args.groupId,
        group_id: args.groupId,
        group_name: args.groupName,
        organization_id: args.organizationId ?? null,
        organization_name: args.organizationName ?? null,
        invite_link: args.inviteLink ?? null,
        whatsapp_provider_id: args.whatsappProviderId ?? null,
        created_at: args.createdAt ?? null,
        user_id: args.userId ?? null,
        raw_group: args.rawGroup ?? null,
        source: 'frontend.onboarding',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${bodyText ? ` - ${bodyText}` : ''}`);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const triggerCreateAssistantWebhook = async (args: CreateAssistantWebhookArgs, opts?: { force?: boolean }) => {
    createAssistantWebhookArgsRef.current = args;
    setAssistantWebhookError(null);

    const groupId = args.groupId;
    if (!opts?.force) {
      if (createAssistantWebhookSucceededRef.current.has(groupId)) return;
      const inflight = createAssistantWebhookInFlightRef.current;
      if (inflight?.groupId === groupId) return inflight.promise;
    }

    setAssistantWebhookStatus('inflight');

    const promise = (async () => {
      try {
        await callCreateAssistantWebhook(args);
        if (getCreateAssistantWebhookUrl()) {
          createAssistantWebhookSucceededRef.current.add(groupId);
          setAssistantWebhookStatus('success');
        }
      } catch (e: any) {
        const message = e?.message || 'Falha ao chamar webhook de criação do assistente';
        setAssistantWebhookStatus('failed');
        setAssistantWebhookError(message);
        console.error('Falha ao chamar webhook de criação do assistant', {
          group_id: groupId,
          message,
        });
        notify.warning(
          'Assistente não foi provisionado',
          'O grupo foi criado, mas a criação do assistente falhou. Você pode tentar novamente.',
          {
            actionLabel: 'Tentar novamente',
            onAction: () => {
              const last = createAssistantWebhookArgsRef.current;
              if (last) void triggerCreateAssistantWebhook(last, { force: true });
            },
            duration: 8000,
          },
        );
      }
    })();

    createAssistantWebhookInFlightRef.current = { groupId, promise };
    await promise.finally(() => {
      const inflight = createAssistantWebhookInFlightRef.current;
      if (inflight?.groupId === groupId) {
        createAssistantWebhookInFlightRef.current = null;
      }
    });
  };

  const getSessionToken = async (): Promise<string | null> => {
    for (let i = 0; i < 3; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  };

  const invokeEdgeFunction = async <T,>(
    fnName: string,
    body: unknown
  ): Promise<{ data: T | null; error: null | { message: string; status?: number; code?: string; correlationId: string; raw?: any } ; correlationId: string }> => {
    const correlationId = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const apikey = getSupabaseKey();
    const anonKey = getSupabaseAnonKey();
    const token = await getSessionToken();
    const authBearer = token || anonKey;

    const { data, error } = await supabase.functions.invoke(fnName, {
      body,
      headers: {
        ...(apikey ? { apikey } : {}),
        ...(authBearer ? { Authorization: `Bearer ${authBearer}` } : {}),
      } as any,
    });

    if (!error) {
      const responseCorrelationId = (data as any)?.correlation_id;
      return { data: data as T, error: null, correlationId: responseCorrelationId || correlationId };
    }

    try {
      const url = getFunctionUrl(fnName);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apikey ? { apikey } : {}),
          ...(authBearer ? { Authorization: `Bearer ${authBearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const rawText = await res.text().catch(() => '');
      const parsed = safeJsonParse(rawText);
      const responseCorrelationId = res.headers.get('x-correlation-id') || parsed?.correlation_id || correlationId;
      const code: string | undefined =
        parsed?.code || parsed?.error?.code || parsed?.data?.code || (error as any)?.code;
      const message: string =
        (parsed && (parsed.message || parsed.error?.message || parsed.error || parsed.detail)) ||
        (error.message as string | undefined) ||
        (res.ok ? 'Erro ao chamar função' : `HTTP ${res.status} ao chamar função`);
      return {
        data: null,
        error: { message, status: res.status, code, correlationId: responseCorrelationId, raw: parsed ?? rawText },
        correlationId: responseCorrelationId,
      };
    } catch (fallbackErr: any) {
      return {
        data: null,
        error: { message: fallbackErr?.message || error.message || 'Erro ao chamar função', correlationId },
        correlationId,
      };
    }
  };

  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'name':
        return formData.name.trim().length >= 2;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 'phone': {
        const digits = formData.whatsapp_phone.replace(/\D/g, '');
        return digits.length >= 10;
      }
      case 'password':
        return formData.password.length >= 10 && formData.password === formData.password_confirm;
      case 'how':
        return true;
      case 'prepare_group':
        return true;
      case 'group_link':
        return groupValidation?.is_valid === true && groupValidation?.is_boris_in_group === true && !groupValidation?.data_incomplete;
      case 'final':
        return true;
      default:
        return false;
    }
  };

  const validateGroup = async (): Promise<GroupValidation | null> => {
    if (!formData.invite_link.trim()) {
      setValidationError('Cole o link de convite do grupo.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setGroupValidation(null);

    try {
      const attempt = async () => invokeEdgeFunction<GroupValidation>('validate-whatsapp-group', {
        invite_link: formData.invite_link,
      });

      let response = await attempt();
      if (response.error?.status && response.error.status >= 500) {
        await new Promise((r) => setTimeout(r, 500));
        response = await attempt();
      }

      if (response.error) {
        const code = response.error.code;
        const corr = response.error.correlationId;
        const status = response.error.status;
        const temporarilyUnavailableCodes = new Set([
          'WEBHOOK_NOT_CONFIGURED',
          'VALIDATION_UPSTREAM_FAILED',
          'UNKNOWN_VALIDATION_RESPONSE',
          'UNEXPECTED_ERROR',
        ]);
        const msg =
          temporarilyUnavailableCodes.has(String(code || '')) || (typeof status === 'number' && status >= 500)
            ? `Validação temporariamente indisponível (cód. ${corr}).`
            : `Erro ao validar grupo (cód. ${corr}).`;
        throw new Error(msg);
      }

      const data = response.data as GroupValidation;
      setGroupValidation(data);

      if (!data.is_valid) {
        setValidationError('Esse link não parece válido. Cole o link de convite completo do WhatsApp.');
      } else if (!data.is_boris_in_group) {
        setValidationError(null);
      }

      return data;
    } catch (error: any) {
      console.error('Error validating group:', error);
      setValidationError(error?.message || 'Erro ao validar grupo. Tente novamente.');
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const copyBorisNumber = async () => {
    try {
      await navigator.clipboard.writeText('+55 61 8150-4160');
      notify.success("Número copiado", "Copiado para a área de transferência.");
    } catch {
      notify.error("Não foi possível copiar", "Tente novamente.");
    }
  };

  const handleConnectGroup = async () => {
    if (isSubmitting) return;
    setAccessError(null);
    if (formData.password.length < 10) {
      setAccessError('Senha deve ter pelo menos 10 caracteres');
      setCurrentStep('password');
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setAccessError('A confirmação precisa ser igual à senha');
      setCurrentStep('password');
      return;
    }
    if (!formData.invite_link.trim()) {
      setValidationError('Cole o link de convite do grupo.');
      return;
    }
    const validated = await validateGroup();
    if (!isGroupValidationSuccessful(validated)) {
      notify.warning("Validação necessária", "Valide o grupo e tente novamente.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { name: formData.name },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          notify.warning("Email já cadastrado", "Faça login para continuar.");
          navigate('/auth');
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erro ao criar usuário');
      }

      const firstName = formData.name.split(' ')[0] || formData.name;
      const orgName = `Organização de ${firstName}`;

      const provisionPayload = {
        lead: {
          name: formData.name,
          email: formData.email,
          whatsapp_phone: normalizePhoneE164(formData.whatsapp_phone),
          user_id: authData.user.id,
        },
        organization: {
          name: orgName,
        },
        group: {
          provider: validated.provider,
          whatsapp_provider_id: validated.whatsapp_provider_id,
          name: validated.group_name,
          invite_link: formData.invite_link,
        },
        participants: validated.participants,
      };

      const provisionResponse = await invokeEdgeFunction<any>('provision-onboarding', provisionPayload);
      const provisionData = provisionResponse.data;
      const provisionError = provisionResponse.error;

      if (provisionError || !provisionData?.success) {
        const fallbackToLink = (message: string) => {
          setValidationError(message);
          setCurrentStep('group_link');
        };

        const code = (provisionData as any)?.code as string | undefined || provisionError?.code;
        if (code === 'GROUP_ALREADY_PROVISIONED') {
          const groupName = ((provisionData as any)?.group_name as string | null | undefined) || validated.group_name;
          fallbackToLink(`Esse grupo já está cadastrado como "${groupName}". Cole o link de outro grupo.`);
          return;
        }
        const friendly = getProvisioningErrorMessage(code);

        const correlationId = provisionError?.correlationId || provisionData?.correlation_id;
        const infraMsg =
          code === 'SERVICE_ROLE_NOT_CONFIGURED'
            ? 'Configuração do servidor incompleta. '
            : '';
        const message = friendly || (provisionData as any)?.message || provisionError?.message || 'Erro no provisionamento';
        throw new Error(`${infraMsg}${message}${correlationId ? ` (cód. ${correlationId})` : ''}`);
      }

      setProvisionedGroupId(provisionData.group_id);
      setCurrentStep('final');

      const groupId = provisionData.group_id as string;
      const organizationId = (provisionData.organization_id as string | undefined) || null;

      let rawGroup: any = {
        id: groupId,
        name: validated.group_name,
        organization_id: organizationId,
        whatsapp_provider_id: validated.whatsapp_provider_id,
        invite_link: formData.invite_link,
        provider: validated.provider,
      };
      let createdAt: string | null = null;

      try {
        const { data: groupRow, error: groupRowError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .maybeSingle();

        if (!groupRowError && groupRow) {
          rawGroup = groupRow;
          createdAt = (groupRow as any)?.created_at ?? null;
        }
      } catch (e) {
        console.error('Erro ao buscar grupo após provisionamento', e);
      }

      void triggerCreateAssistantWebhook({
        groupId,
        groupName: validated.group_name,
        organizationId,
        organizationName: orgName,
        inviteLink: formData.invite_link,
        whatsappProviderId: validated.whatsapp_provider_id,
        createdAt,
        userId: authData.user.id,
        rawGroup,
      });

    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('Password should be at least') || msg.includes('senha') || msg.includes('password')) {
        const match = msg.match(/at least\s+(\d+)\s+characters/i);
        const required = match ? match[1] : '10';
        setAccessError(`Senha deve ter pelo menos ${required} caracteres`);
        setCurrentStep('password');
      } else {
        navigate('/onboarding/error', { 
          state: { message: error.message || 'Erro durante o onboarding' } 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
      switch (currentStep) {
        case 'welcome':
          return (
            <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/1.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title className="bg-gradient-to-r from-foreground to-primary/60 bg-clip-text text-transparent">Oi, eu sou o Bóris.</Title>
            <Subtitle delay={0.15} className="max-w-prose">Eu tiro o peso das conversas e cuido do caos do seu grupo. Você foca no que importa.</Subtitle>
          </div>
        );

      case 'name':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/2.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title>Como você quer que eu te chame?</Title>
            <div className="pt-1">
              <Input
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={handleKeyDown}
                maxLength={100}
                autoFocus
                className="h-12 text-lg"
              />
            </div>
            <Subtitle delay={0.15} className="text-sm sm:text-base">Só o primeiro nome já resolve.</Subtitle>
          </div>
        );

        case 'email':
          return (
            <div className="space-y-4">
              <Title>Prazer, {formData.name}! 😊</Title>
              <Subtitle delay={0.15}><Mail className="w-3 h-3 inline mr-2" />Uso para te avisar quando algo importante acontecer.</Subtitle>
              <div className="pt-1">
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onKeyDown={handleKeyDown}
                  maxLength={255}
                  autoFocus
                  className="h-12 text-lg"
                />
                <p className="text-[11px] text-muted-foreground/80 mt-2">Prometo não enviar spam.</p>
              </div>
            </div>
          );

        case 'phone':
          return (
            <div className="space-y-4">
              <Title>Qual é o seu WhatsApp?</Title>
              <Subtitle delay={0.15}><MessageCircle className="w-3 h-3 inline mr-2" />Uso apenas para identificar você como dono do grupo.</Subtitle>
              <div className="pt-1">
                <Input
                  placeholder="(11) 98765-4321 ou +55 11 98765-4321"
                  value={formData.whatsapp_phone}
                  onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                  onKeyDown={handleKeyDown}
                  maxLength={30}
                  autoFocus
                  className="h-12 text-lg"
                />
                <p className="text-[11px] text-muted-foreground/80 mt-2">Aceita formatos com DDD ou começando com +55.</p>
              </div>
            </div>
          );

      case 'password':
        return (
          <div className="space-y-4">
            <Title>Crie seu acesso à Central do Bóris</Title>
            <Subtitle delay={0.15}>Defina uma senha para entrar no seu painel.</Subtitle>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Senha</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onKeyDown={handleKeyDown}
                  maxLength={255}
                  className="h-12 text-lg"
                />
                <p className="text-[11px] text-muted-foreground/80 mt-2">Mínimo de 10 caracteres.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Confirmar senha</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password_confirm}
                  onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                  onKeyDown={handleKeyDown}
                  maxLength={255}
                  className="h-12 text-lg"
                />
              </div>
              {accessError && (
                <p className="text-sm text-destructive">⚠️ {accessError}</p>
              )}
            </div>
          </div>
        );

      case 'how':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/4.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title className="text-3xl sm:text-4xl">O caminho é simples.</Title>
            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-2">
              <div className="flex flex-col items-center text-center space-y-2">
                <Users className="w-6 h-6 md:w-7 md:h-7 text-primary/80" />
                <p className="text-xs">Eu entro no grupo</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <Link2 className="w-6 h-6 md:w-7 md:h-7 text-primary/80" />
                <p className="text-xs">Depois, leio as conversas</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <CheckCircle className="w-6 h-6 md:w-7 md:h-7 text-primary/80" />
                <p className="text-xs">Por fim, transformo em insights</p>
              </div>
            </div>
          </div>
        );

      case 'prepare_group':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/4.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title>Antes de continuar, preciso estar dentro do grupo.</Title>
            <Subtitle delay={0.15}>É normal, leva poucos segundos. Sem isso eu não consigo validar o grupo.</Subtitle>
            <div className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 text-white grid place-items-center font-semibold">B</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Bóris</p>
                  <p className="text-xs text-muted-foreground">+55 61 8150-4160</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyBorisNumber}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar número
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Checklist rápido</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled className="rounded border-border" />
                  Adicionar o Bóris ao grupo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled className="rounded border-border" />
                  Confirmar que o Bóris entrou
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled className="rounded border-border" />
                  Depois disso, colar o link do grupo
                </label>
              </div>
            </div>
          </div>
        );

      case 'group_link':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/5.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title>Agora preciso do link do grupo.</Title>
            <Subtitle delay={0.15} className="max-w-prose">É aqui que eu começo a trabalhar de verdade: com o link, acompanho e gero insights.</Subtitle>
            <div className="pt-2 space-y-3">
              <Input
                placeholder="https://chat.whatsapp.com/..."
                value={formData.invite_link}
                onChange={(e) => {
                  setFormData({ ...formData, invite_link: e.target.value });
                  setGroupValidation(null);
                  setValidationError(null);
                }}
                maxLength={100}
                autoFocus
                className="h-12 text-lg"
              />
              <p className="text-xs text-muted-foreground/80">Você pode remover o Bóris do grupo quando quiser.</p>
            </div>
            <AnimatePresence mode="wait">
              {validationError && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-destructive"
                >
                  ⚠️ {validationError}
                </motion.p>
              )}
              {groupValidation?.is_valid && !groupValidation?.is_boris_in_group && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm space-y-3"
                >
                  <p className="text-sm">Antes de continuar, preciso estar dentro do grupo.</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 text-white grid place-items-center font-semibold">B</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Bóris</p>
                      <p className="text-xs text-muted-foreground">+55 61 8150-4160</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyBorisNumber}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar número
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" disabled className="rounded border-border" />
                      Adicione o Bóris ao grupo e valide novamente
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">É normal, leva poucos segundos.</p>
                </motion.div>
              )}
              {groupValidation?.is_valid && groupValidation?.is_boris_in_group && groupValidation?.data_incomplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  <p className="text-sm text-amber-600">⚠️ Encontrei o Bóris no grupo, mas não consegui obter todas as informações.</p>
                  <p className="text-sm">{groupValidation.data_incomplete_reason}</p>
                  <p className="text-xs text-muted-foreground">Tente validar novamente.</p>
                </motion.div>
              )}
              {groupValidation?.is_valid && groupValidation?.is_boris_in_group && !groupValidation?.data_incomplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">Grupo validado</span>
                  </div>
                  <p className="text-sm font-semibold text-center">{groupValidation.group_name}</p>
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Users className="w-4 h-4 text-primary/80" />
                    {groupValidation.participants_count} participantes
                  </div>
                  <div className="flex items-center justify-center flex-wrap gap-1">
                    {groupValidation.participants.slice(0, 3).map((p, i) => (
                      <span key={i} className="text-[11px] text-muted-foreground">• {p.name || p.phone}</span>
                    ))}
                    {groupValidation.participants_count > 3 && (
                      <span className="text-[11px] text-muted-foreground">... e mais {groupValidation.participants_count - 3}</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 'final':
        return (
          <div className="space-y-4 text-center">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/6.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title>Seu acesso foi criado com sucesso 🎉</Title>
            <Subtitle delay={0.15}>Enviamos um e-mail de confirmação. Você só poderá entrar após confirmar seu e-mail.</Subtitle>
            <div className="flex items-center justify-center gap-2">
              <MailCheck className="w-4 h-4 text-primary" />
            </div>

            {provisionedGroupId ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-left shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Provisionamento do assistente</div>
                    {assistantWebhookStatus === 'inflight' ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Criando assistente…
                      </div>
                    ) : assistantWebhookStatus === 'success' ? (
                      <div className="text-xs text-muted-foreground mt-1">Webhook chamado com sucesso.</div>
                    ) : assistantWebhookStatus === 'failed' ? (
                      <div className="text-xs text-muted-foreground mt-1">Falhou ao chamar o webhook.</div>
                    ) : assistantWebhookStatus === 'skipped' ? (
                      <div className="text-xs text-muted-foreground mt-1">Webhook não configurado.</div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">Aguardando…</div>
                    )}
                  </div>

                  {assistantWebhookStatus === 'failed' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const last = createAssistantWebhookArgsRef.current;
                        if (last) void triggerCreateAssistantWebhook(last, { force: true });
                      }}
                    >
                      Tentar novamente
                    </Button>
                  ) : null}
                </div>

                {assistantWebhookStatus === 'failed' && assistantWebhookError ? (
                  <div className="mt-3 text-xs text-muted-foreground break-words">
                    {assistantWebhookError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  };

  

  return (
    <PublicLayout progress={progress}>
      <div className="pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
        <div className={`flex items-center justify-between ${currentStep === 'welcome' ? 'mt-8 pt-6' : currentStep === 'group_link' ? 'mt-8 pt-6' : 'mt-6 pt-4'}`}>
          {currentStep !== 'welcome' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          ) : (
            <div />
          )}
          {currentStep === 'final' ? (
            <Button
              onClick={() => navigate('/auth')}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              Ir para o login
            </Button>
          ) : currentStep === 'group_link' ? (
            <Button
              onClick={handleConnectGroup}
              disabled={!formData.invite_link.trim() || isValidating || isSubmitting}
              className="h-12 rounded-full px-6 font-semibold shadow-sm shadow-primary/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Continuando...
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!isCurrentStepValid()}
              className={currentStep === 'welcome' ? 'h-11 rounded-full px-5 shadow-sm' : ''}
            >
              {currentStep === 'welcome' ? 'Começar' : 'Continuar'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function SummaryItem({ 
  icon: Icon, 
  label, 
  value, 
  onEdit 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium">{value}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
