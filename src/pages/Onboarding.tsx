import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Link2, 
  CheckCircle, Loader2, ArrowLeft, Edit2, ChevronRight,
  Users
} from 'lucide-react';

type Step = 'welcome' | 'name' | 'email' | 'how' | 'group_link' | 'final';

interface FormData {
  name: string;
  email: string;
  invite_link: string;
}

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
    provider_member_id: string;
  }>;
  data_incomplete?: boolean;
  data_incomplete_reason?: string;
}

const STEPS: Step[] = ['welcome', 'name', 'email', 'how', 'group_link', 'final'];

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
    invite_link: '',
  });
  const [groupValidation, setGroupValidation] = useState<GroupValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [provisionedGroupId, setProvisionedGroupId] = useState<string | null>(null);

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

  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'name':
        return formData.name.trim().length >= 2;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 'how':
        return true;
      case 'group_link':
        return groupValidation?.is_valid === true && groupValidation?.is_boris_in_group === true && !groupValidation?.data_incomplete;
      case 'final':
        return true;
      default:
        return false;
    }
  };

  const validateGroup = async () => {
    if (!formData.invite_link.trim()) {
      setValidationError('Cole o link de convite do grupo.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setGroupValidation(null);

    try {
      const response = await supabase.functions.invoke('validate-whatsapp-group', {
        body: { invite_link: formData.invite_link }
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
      console.error('Error validating group:', error);
      setValidationError('Erro ao validar grupo. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConnectGroup = async () => {
    if (!formData.invite_link.trim()) {
      setValidationError('Cole o link de convite do grupo.');
      return;
    }
    await validateGroup();
    if (!groupValidation || !groupValidation.is_valid || !groupValidation.is_boris_in_group || groupValidation.data_incomplete) {
      toast.error('Valide o grupo antes de continuar');
      return;
    }
    setIsSubmitting(true);
    try {
      const generatedPassword = crypto.randomUUID() + '!Aa1';
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: generatedPassword,
        options: {
          data: { name: formData.name },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Faça login.');
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
          whatsapp_phone: '',
          user_id: authData.user.id,
        },
        organization: {
          name: orgName,
        },
        group: {
          provider: groupValidation.provider,
          provider_group_id: groupValidation.provider_group_id,
          name: groupValidation.group_name,
          invite_link: formData.invite_link,
        },
        participants: groupValidation.participants,
      };

      const { data: provisionData, error: provisionError } = await supabase.functions.invoke('provision-onboarding', {
        body: provisionPayload,
      });

      if (provisionError || !provisionData?.success) {
        throw new Error(provisionData?.message || provisionError?.message || 'Erro no provisionamento');
      }

      setProvisionedGroupId(provisionData.group_id);
      setCurrentStep('final');

    } catch (error: any) {
      console.error('Onboarding error:', error);
      navigate('/onboarding/error', { 
        state: { message: error.message || 'Erro durante o onboarding' } 
      });
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
            <Subtitle delay={0.15} className="max-w-prose">Vou te ajudar a entender o que realmente importa nas conversas do seu grupo — sem esforço.</Subtitle>
          </div>
        );

      case 'name':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/2.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title>Antes de tudo… como você quer ser chamado?</Title>
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
            <Subtitle delay={0.15} className="text-sm sm:text-base">Pode ser só o primeiro nome 😉</Subtitle>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <Title>Prazer, {formData.name}! 😊</Title>
            <Subtitle delay={0.15}><Mail className="w-3 h-3 inline mr-2" />Por onde posso te avisar quando algo importante acontecer?</Subtitle>
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

      case 'how':
        return (
          <div className="space-y-4">
            <div className="flex justify-center -mx-2 sm:mx-0">
              <img src="/4.png" alt="Bóris" className="w-full max-h-72 sm:max-h-80 object-contain filter drop-shadow-md sm:drop-shadow-lg brightness-[1.02] saturate-[1.05]" />
            </div>
            <Title className="text-3xl sm:text-4xl">Em poucos passos, eu faço o trabalho pesado por você.</Title>
            <div className="flex items-center justify-between gap-5 pt-1">
              <div className="flex flex-col items-center">
                <Users className="w-5 h-5 text-primary/80" />
                <p className="text-xs mt-2">Eu entro no grupo</p>
              </div>
              <div className="hidden sm:block h-px w-10 bg-muted" />
              <div className="flex flex-col items-center">
                <Link2 className="w-5 h-5 text-primary/80" />
                <p className="text-xs mt-2">Leio as conversas</p>
              </div>
              <div className="hidden sm:block h-px w-10 bg-muted" />
              <div className="flex flex-col items-center">
                <CheckCircle className="w-5 h-5 text-primary/80" />
                <p className="text-xs mt-2">Transformo tudo em insights</p>
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
            <Subtitle delay={0.15} className="max-w-prose">É assim que consigo acompanhar as conversas e gerar os insights.</Subtitle>
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
                  className="space-y-1"
                >
                  <p className="text-sm text-green-600">✅ Grupo validado!</p>
                  <p className="text-sm font-medium">{groupValidation.group_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {groupValidation.participants_count} participantes
                  </p>
                  {groupValidation.participants.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {p.name || p.phone}</p>
                  ))}
                  {groupValidation.participants_count > 3 && (
                    <p className="text-xs text-muted-foreground">... e mais {groupValidation.participants_count - 3}</p>
                  )}
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
            <Title>Pronto. Agora deixa comigo 🔥</Title>
            <Subtitle delay={0.15}>Em instantes você já poderá acompanhar tudo pelo painel.</Subtitle>
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
              onClick={() => navigate(provisionedGroupId ? `/group/${provisionedGroupId}` : '/')}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              Ir para o painel
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
                  Conectando...
                </>
              ) : (
                'Conectar grupo'
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
