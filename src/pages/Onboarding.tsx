import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, Lock, Building2, Link2, 
  CheckCircle, Loader2, ArrowLeft, Edit2, ChevronRight,
  Users
} from 'lucide-react';

type Step = 'intro' | 'name' | 'email' | 'whatsapp' | 'password' | 'organization' | 'invite_link' | 'summary';

interface FormData {
  name: string;
  email: string;
  whatsapp_phone: string;
  password: string;
  organization_name: string;
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
}

const STEPS: Step[] = ['intro', 'name', 'email', 'whatsapp', 'password', 'organization', 'invite_link', 'summary'];

function normalizePhoneE164(phone: string): string {
  // Remove tudo que não é número
  let digits = phone.replace(/\D/g, '');
  
  // Se não começar com +, assumir Brasil (+55)
  if (!phone.startsWith('+')) {
    // Se já tem 55 no início e o número tem mais de 11 dígitos, provavelmente já está com DDI
    if (digits.startsWith('55') && digits.length > 11) {
      return '+' + digits;
    }
    // Caso contrário, adicionar +55
    return '+55' + digits;
  }
  
  return '+' + digits;
}

function ChatBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-muted/80 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground max-w-[85%]"
    >
      {children}
    </motion.div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    whatsapp_phone: '',
    password: '',
    organization_name: '',
    invite_link: '',
  });
  const [groupValidation, setGroupValidation] = useState<GroupValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const goNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 'intro':
        return true;
      case 'name':
        return formData.name.trim().length >= 2;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 'whatsapp':
        return formData.whatsapp_phone.replace(/\D/g, '').length >= 10;
      case 'password':
        return formData.password.length >= 8;
      case 'organization':
        return formData.organization_name.trim().length >= 2;
      case 'invite_link':
        return groupValidation?.is_valid === true && groupValidation?.is_boris_in_group === true;
      case 'summary':
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

  const handleSubmit = async () => {
    if (!groupValidation || !groupValidation.is_valid || !groupValidation.is_boris_in_group) {
      toast.error('Validação do grupo necessária');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Signup no Supabase Auth
      const normalizedPhone = normalizePhoneE164(formData.whatsapp_phone);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            whatsapp_phone: normalizedPhone,
          },
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

      // 2. Provisionamento via Edge Function
      const provisionPayload = {
        lead: {
          name: formData.name,
          email: formData.email,
          whatsapp_phone: normalizedPhone,
          user_id: authData.user.id,
        },
        organization: {
          name: formData.organization_name,
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

      // 3. Aguardar sessão e redirecionar
      toast.success('Conta criada com sucesso!');
      
      // Aguardar um pouco para a sessão ser estabelecida
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar se o usuário está logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate(`/group/${provisionData.group_id}`);
      } else {
        // Se não estiver logado, redirecionar para login
        toast.info('Por favor, faça login para continuar.');
        navigate('/auth');
      }

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
      case 'intro':
        return (
          <div className="space-y-4">
            <ChatBubble>
              👋 Olá! Vou te ajudar a configurar o Bóris para o seu grupo.
            </ChatBubble>
            <ChatBubble delay={0.2}>
              Para usar o Bóris você precisa:
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Ter um grupo de WhatsApp</li>
                <li>Adicionar o Bóris ao grupo</li>
                <li>Informar o link de convite do grupo</li>
              </ol>
            </ChatBubble>
            <ChatBubble delay={0.4}>
              Vamos começar? 🚀
            </ChatBubble>
          </div>
        );

      case 'name':
        return (
          <div className="space-y-4">
            <ChatBubble>
              <User className="w-4 h-4 inline mr-2" />
              Como você quer ser chamado?
            </ChatBubble>
            <div className="pt-2">
              <Input
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
                className="text-lg"
              />
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <ChatBubble>
              Prazer, {formData.name}! 😊
            </ChatBubble>
            <ChatBubble delay={0.2}>
              <Mail className="w-4 h-4 inline mr-2" />
              Qual email vamos usar no seu acesso?
            </ChatBubble>
            <div className="pt-2">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoFocus
                className="text-lg"
              />
            </div>
          </div>
        );

      case 'whatsapp':
        return (
          <div className="space-y-4">
            <ChatBubble>
              <Phone className="w-4 h-4 inline mr-2" />
              Qual seu WhatsApp?
            </ChatBubble>
            <ChatBubble delay={0.2}>
              <span className="text-muted-foreground text-xs">
                Use DDI. Ex: +55 11 99999-9999
              </span>
            </ChatBubble>
            <div className="pt-2">
              <Input
                type="tel"
                placeholder="+55 11 99999-9999"
                value={formData.whatsapp_phone}
                onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                autoFocus
                className="text-lg"
              />
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="space-y-4">
            <ChatBubble>
              <Lock className="w-4 h-4 inline mr-2" />
              Defina uma senha para o seu acesso
            </ChatBubble>
            <ChatBubble delay={0.2}>
              <span className="text-muted-foreground text-xs">
                Mínimo de 8 caracteres
              </span>
            </ChatBubble>
            <div className="pt-2">
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoFocus
                className="text-lg"
              />
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-4">
            <ChatBubble>
              Ótimo! Agora vamos configurar sua organização.
            </ChatBubble>
            <ChatBubble delay={0.2}>
              <Building2 className="w-4 h-4 inline mr-2" />
              Qual o nome da sua organização/comunidade?
            </ChatBubble>
            <div className="pt-2">
              <Input
                placeholder="Nome da organização"
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                autoFocus
                className="text-lg"
              />
            </div>
          </div>
        );

      case 'invite_link':
        return (
          <div className="space-y-4">
            <ChatBubble>
              Quase lá! Agora preciso validar seu grupo de WhatsApp.
            </ChatBubble>
            <ChatBubble delay={0.2}>
              <Link2 className="w-4 h-4 inline mr-2" />
              Cole aqui o link de convite do seu grupo
            </ChatBubble>
            
            <div className="pt-2 space-y-3">
              <Input
                placeholder="https://chat.whatsapp.com/..."
                value={formData.invite_link}
                onChange={(e) => {
                  setFormData({ ...formData, invite_link: e.target.value });
                  setGroupValidation(null);
                  setValidationError(null);
                }}
                autoFocus
                className="text-lg"
              />
              
              <Button
                onClick={validateGroup}
                disabled={isValidating || !formData.invite_link.trim()}
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

            <AnimatePresence mode="wait">
              {validationError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <ChatBubble>
                    <span className="text-destructive">⚠️ {validationError}</span>
                  </ChatBubble>
                </motion.div>
              )}

              {groupValidation?.is_valid && groupValidation?.is_boris_in_group && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  <ChatBubble>
                    <span className="text-green-600">✅ Grupo validado!</span>
                  </ChatBubble>
                  <ChatBubble delay={0.2}>
                    <div className="space-y-1">
                      <p><strong>{groupValidation.group_name}</strong></p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {groupValidation.participants_count} participantes
                      </p>
                      {groupValidation.participants.slice(0, 3).map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {p.name || p.phone}
                        </p>
                      ))}
                      {groupValidation.participants_count > 3 && (
                        <p className="text-xs text-muted-foreground">
                          ... e mais {groupValidation.participants_count - 3}
                        </p>
                      )}
                    </div>
                  </ChatBubble>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-4">
            <ChatBubble>
              Perfeito! Confira seus dados antes de finalizar:
            </ChatBubble>
            
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-3">
                <SummaryItem
                  icon={User}
                  label="Nome"
                  value={formData.name}
                  onEdit={() => goToStep('name')}
                />
                <SummaryItem
                  icon={Mail}
                  label="Email"
                  value={formData.email}
                  onEdit={() => goToStep('email')}
                />
                <SummaryItem
                  icon={Phone}
                  label="WhatsApp"
                  value={formData.whatsapp_phone}
                  onEdit={() => goToStep('whatsapp')}
                />
                <SummaryItem
                  icon={Building2}
                  label="Organização"
                  value={formData.organization_name}
                  onEdit={() => goToStep('organization')}
                />
                <SummaryItem
                  icon={Users}
                  label="Grupo"
                  value={`${groupValidation?.group_name} (${groupValidation?.participants_count} participantes)`}
                  onEdit={() => goToStep('invite_link')}
                />
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <PublicLayout progress={progress}>
      <Card className="shadow-lg border-muted/50">
        <CardContent className="pt-6">
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            {currentStep !== 'intro' ? (
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

            {currentStep === 'summary' ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Concluir e entrar
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!isCurrentStepValid()}
              >
                Continuar
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
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
