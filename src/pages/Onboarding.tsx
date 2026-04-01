import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, KeyRound, Loader2, Lock, Mail, Phone, Users } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/utils";
import {
  getFriendlyOnboardingErrorMessage,
  getPasswordHint,
  invokeProvisionOnboarding,
  normalizePhoneToE164,
  type PublicOnboardingFormValues,
  type PublicOnboardingValidationErrors,
  validatePublicOnboardingForm,
} from "@/lib/public-onboarding";
import { clearPendingOnboardingDraft, readPendingOnboardingDraft, savePendingOnboardingDraft } from "@/lib/public-onboarding-pending";

type GroupValidationResponse = {
  success: boolean;
  code?: string;
  message?: string;
  is_valid?: boolean;
  is_boris_in_group?: boolean;
  provider?: string;
  provider_phone?: string;
  whatsapp_provider_id?: string;
  group_name?: string;
  owner_phone_e164?: string | null;
  participants_count?: number;
  participants?: Array<{
    phone: string;
    name: string;
    is_admin: boolean;
    is_super_admin?: boolean;
    lid?: string;
    whatsapp_provider_id?: string;
  }>;
};

const INITIAL_VALUES: PublicOnboardingFormValues = {
  fullName: "",
  organizationName: "",
  email: "",
  whatsappPhone: "",
  password: "",
  confirmPassword: "",
  inviteLink: "",
};

type OnboardingStep = {
  id: "profile" | "access" | "group";
  title: string;
  description: string;
  fields: Array<keyof PublicOnboardingFormValues>;
};

function getStepFooterCopy(stepId: OnboardingStep["id"], isResumingOnboarding: boolean) {
  if (isResumingOnboarding) {
    return {
      title: "Continuar cadastro",
      description:
        stepId === "group"
          ? "Troque o link se necessário e conclua a criação da sua organização."
          : "Revise os dados e avance para concluir o cadastro.",
    };
  }

  if (stepId === "profile") {
    return {
      title: "Seus dados de acesso",
      description: "Usaremos essas informações para criar sua conta e identificar sua organização.",
    };
  }

  if (stepId === "access") {
    return {
      title: "Senha do app",
      description: getPasswordHint(),
    };
  }

  return {
    title: "Última etapa",
    description: "Validamos o grupo antes de liberar seu primeiro acesso no painel.",
  };
}

function parseOnboardingErrorDetails(message: string) {
  const trimmed = message.trim();
  const codeMatch = trimmed.match(/\(([A-Z0-9_]+)\)\s*$/);
  const code = codeMatch?.[1] ?? null;
  const cleanMessage = code ? trimmed.replace(/\s*\([A-Z0-9_]+\)\s*$/, "").trim() : trimmed;

  if (/GROUP_ALREADY_PROVISIONED/i.test(trimmed) || /já foi cadastrado/i.test(cleanMessage)) {
    return {
      tone: "warning" as const,
      title: "Esse grupo já está em uso",
      description: cleanMessage,
      guidance: "Use outro link de grupo para continuar o cadastro da sua organização.",
      actionLabel: "Trocar link do grupo",
      code,
    };
  }

  if (/VALIDATION_TIMEOUT/i.test(trimmed) || /Validation timed out/i.test(cleanMessage)) {
    return {
      tone: "error" as const,
      title: "Não conseguimos validar o grupo agora",
      description: "A validação do link demorou mais do que o esperado.",
      guidance: "Tente novamente em instantes. Se continuar falhando, confirme se o link do grupo ainda está ativo.",
      code,
    };
  }

  if (/BORIS_NOT_IN_GROUP/i.test(trimmed) || /bóris.*não.*grupo/i.test(cleanMessage) || /boris.*not.*group/i.test(cleanMessage)) {
    return {
      tone: "warning" as const,
      title: "O Bóris ainda não está nesse grupo",
      description: "Para concluir o cadastro, o Bóris precisa já estar presente no grupo do WhatsApp.",
      guidance: "Adicione o Bóris ao grupo, gere um novo link de convite e tente novamente.",
      actionLabel: "Trocar link do grupo",
      code,
    };
  }

  if (/INVALID_GROUP/i.test(trimmed) || /grupo inválido/i.test(cleanMessage) || /não conseguimos validar esse grupo/i.test(cleanMessage)) {
    return {
      tone: "warning" as const,
      title: "Não conseguimos validar esse grupo",
      description: "O link informado parece inválido ou não pôde ser confirmado agora.",
      guidance: "Revise o link do convite e tente novamente.",
      actionLabel: "Trocar link do grupo",
      code,
    };
  }

  return {
    tone: "error" as const,
    title: "Não foi possível seguir",
    description: cleanMessage,
    guidance: "Revise os dados do cadastro e tente novamente.",
    code,
  };
}

function getOnboardingToastCopy(message: string) {
  const details = parseOnboardingErrorDetails(message);
  const body = [details.description, details.guidance].filter(Boolean).join(" ");
  return {
    title: details.title,
    description: body || message,
  };
}

function friendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Erro inesperado");

  if (/User already registered/i.test(message)) return "Esse email já está cadastrado. Faça login para continuar.";
  if (/Password/i.test(message) && /weak|invalid|minimum|length/i.test(message)) return "A senha não atende aos critérios mínimos.";
  if (/Database error saving new user/i.test(message)) return "Não conseguimos criar sua conta agora. Tente novamente em alguns instantes.";

  return message;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [values, setValues] = useState<PublicOnboardingFormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<PublicOnboardingValidationErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validatedGroup, setValidatedGroup] = useState<GroupValidationResponse | null>(null);
  const isResumingOnboarding = isAuthenticated && !!user?.id;
  const errorDetails = globalError ? parseOnboardingErrorDetails(globalError) : null;
  const inviteLinkInputRef = useRef<HTMLInputElement>(null);
  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "profile",
        title: "Quem está criando",
        description: "Vamos começar com os dados do responsável e da organização.",
        fields: ["fullName", "organizationName", "email", "whatsappPhone"],
      },
      ...(!isResumingOnboarding
        ? [
            {
              id: "access" as const,
              title: "Crie sua senha",
              description: "Defina a senha que você vai usar para entrar no painel.",
              fields: ["password", "confirmPassword"],
            },
          ]
        : []),
      {
        id: "group",
        title: "Conecte seu grupo",
        description: "Validamos o link do WhatsApp antes de liberar sua conta.",
        fields: ["inviteLink"],
      },
    ],
    [isResumingOnboarding],
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);
  const footerCopy = getStepFooterCopy(currentStep.id, isResumingOnboarding);

  const setValue = (key: keyof PublicOnboardingFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setGlobalError("");
    if (key === "inviteLink") {
      setValidatedGroup(null);
    }
  };

  const getSanitizedValues = () => ({
    ...values,
    password: isResumingOnboarding ? "Senha!12345" : values.password,
    confirmPassword: isResumingOnboarding ? "Senha!12345" : values.confirmPassword,
  });

  const getStepErrors = (step: OnboardingStep) => {
    const allErrors = validatePublicOnboardingForm(getSanitizedValues());
    if (isResumingOnboarding) {
      delete allErrors.password;
      delete allErrors.confirmPassword;
    }

    return step.fields.reduce<PublicOnboardingValidationErrors>((accumulator, field) => {
      if (allErrors[field]) {
        accumulator[field] = allErrors[field];
      }
      return accumulator;
    }, {});
  };

  const handleStepAdvance = () => {
    const stepErrors = getStepErrors(currentStep);
    setFieldErrors((current) => ({ ...current, ...stepErrors }));

    if (Object.keys(stepErrors).length > 0) {
      if (stepErrors.inviteLink) {
        inviteLinkInputRef.current?.focus();
      }
      return;
    }

    setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  useEffect(() => {
    const pendingDraft = readPendingOnboardingDraft();
    const params = new URLSearchParams(location.search);
    const onboardingError = params.get("onboarding_error");
    const prefilledEmail = params.get("email");

    if (!pendingDraft && !onboardingError && !prefilledEmail && !user?.email) {
      return;
    }

    setValues((current) => ({
      ...current,
      fullName: current.fullName || pendingDraft?.fullName || "",
      organizationName: current.organizationName || pendingDraft?.organizationName || "",
      email: current.email || user?.email || prefilledEmail || pendingDraft?.email || "",
      whatsappPhone: current.whatsappPhone || pendingDraft?.whatsappPhone || "",
      inviteLink: current.inviteLink || pendingDraft?.inviteLink || "",
    }));

    if (onboardingError) {
      setGlobalError(onboardingError);
      setCurrentStepIndex(steps.length - 1);
    }
  }, [location.search, steps.length, user?.email]);

  useEffect(() => {
    setCurrentStepIndex((index) => Math.min(index, steps.length - 1));
  }, [steps.length]);

  const handleExistingAccountClick = () => {
    clearPendingOnboardingDraft();
    setGlobalError("");
    navigate("/auth", { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGlobalError("");
    setValidatedGroup(null);

    const errors = validatePublicOnboardingForm(getSanitizedValues());

    if (isResumingOnboarding) {
      delete errors.password;
      delete errors.confirmPassword;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const inviteLink = values.inviteLink.trim();
      const normalizedPhone = normalizePhoneToE164(values.whatsappPhone);

      const validation = await supabase.functions.invoke<GroupValidationResponse>("validate-whatsapp-group", {
        body: { invite_link: inviteLink },
      });

      if (validation.error) {
        const message = await getFriendlyOnboardingErrorMessage(validation.error);
        throw new Error(message);
      }

      const groupData = validation.data;
      setValidatedGroup(groupData ?? null);

      if (!groupData?.success || !groupData?.is_valid || !groupData?.is_boris_in_group) {
        throw new Error(groupData?.message || "Não conseguimos validar esse grupo. Confirme o link e se o Bóris já está presente nele.");
      }

      const existingUserId = isResumingOnboarding ? user?.id : null;

      if (existingUserId) {
        const provision = await invokeProvisionOnboarding({
          fullName: values.fullName.trim(),
          organizationName: values.organizationName.trim(),
          email: user?.email ?? values.email.trim(),
          whatsappPhone: normalizedPhone,
          inviteLink,
          userId: existingUserId,
          validatedGroup: {
            provider: groupData.provider,
            provider_phone: groupData.provider_phone,
            whatsapp_provider_id: groupData.whatsapp_provider_id,
            group_name: groupData.group_name,
            participants: groupData.participants,
          },
        });

        clearPendingOnboardingDraft();
        notify.success("Cadastro concluído", "Sua organização foi criada com sucesso.");
        navigate(`/groups/${provision.group_id}`, { replace: true });
        return;
      }

      const redirectTo = `${getAppUrl()}/auth`;
      const signUp = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: values.fullName.trim(),
            whatsapp_phone: normalizedPhone,
            organization_name: values.organizationName.trim(),
          },
        },
      });

      if (signUp.error) throw signUp.error;

      const userId = signUp.data.user?.id;
      if (!userId) {
        throw new Error("Conta criada sem identificador de usuário. Tente novamente.");
      }

      if (signUp.data.session) {
        const provision = await invokeProvisionOnboarding({
          fullName: values.fullName.trim(),
          organizationName: values.organizationName.trim(),
          email: values.email.trim(),
          whatsappPhone: normalizedPhone,
          inviteLink,
          userId,
          validatedGroup: {
            provider: groupData.provider,
            provider_phone: groupData.provider_phone,
            whatsapp_provider_id: groupData.whatsapp_provider_id,
            group_name: groupData.group_name,
            participants: groupData.participants,
          },
        });

        notify.success("Cadastro concluído", "Sua organização foi criada com sucesso.");
        navigate(`/groups/${provision.group_id}`, { replace: true });
        return;
      }

      savePendingOnboardingDraft({
        values,
        userId,
        validatedGroup: {
          provider: groupData.provider,
          provider_phone: groupData.provider_phone,
          whatsapp_provider_id: groupData.whatsapp_provider_id,
          group_name: groupData.group_name,
          participants: groupData.participants,
        },
      });

      notify.info("Confirme seu email", "Enviamos um link para liberar seu primeiro acesso.");
      navigate(`/auth?email=${encodeURIComponent(values.email.trim())}&onboarding=success`, { replace: true });
    } catch (error: unknown) {
      const message = friendlyErrorMessage(error);
      setGlobalError(message);
      const toastCopy = getOnboardingToastCopy(message);
      notify.error(toastCopy.title, toastCopy.description);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout progress={progress} contentClassName="max-w-5xl">
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-6 flex flex-col items-center">
          <img src="/admin-logo.png" alt="Central de Comando do Bóris" className="mb-1 h-20 w-auto sm:h-24" />
          <div className="mb-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            Setup em {steps.length} etapas
          </div>
          <h1 className="text-center text-[2rem] font-bold tracking-tight text-foreground">Crie sua conta</h1>
          <p className="mt-1 max-w-xl text-center text-sm leading-6 text-muted-foreground">
            Cadastre seu acesso, conecte o grupo do WhatsApp e entre no painel com a organização pronta.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-[28px] border border-border/80 bg-card/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.38)] backdrop-blur sm:p-6">
            {globalError ? (
              <Alert
                variant={errorDetails?.tone === "warning" ? "default" : "destructive"}
                className={
                  errorDetails?.tone === "warning"
                    ? "border-warning/30 bg-warning/5 [&>svg]:text-warning"
                    : "bg-destructive/10 border-destructive/20"
                }
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{errorDetails?.title ?? "Não foi possível seguir"}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{errorDetails?.description ?? globalError}</p>
                  {errorDetails?.guidance ? (
                    <p className="text-sm font-medium text-foreground/80">{errorDetails.guidance}</p>
                  ) : null}
                  {errorDetails?.code ? (
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Referência: {errorDetails.code}
                    </p>
                  ) : null}
                  {errorDetails?.actionLabel ? (
                    <div>
                      <button
                        type="button"
                        className={`text-sm font-medium underline-offset-4 hover:underline ${
                          errorDetails?.tone === "warning" ? "text-warning" : "text-primary"
                        }`}
                        onClick={() => inviteLinkInputRef.current?.focus()}
                      >
                        {errorDetails.actionLabel}
                      </button>
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {validatedGroup?.success && validatedGroup.is_valid && validatedGroup.is_boris_in_group && !globalError ? (
              <Alert className="border-success/20 bg-success/10 [&>svg]:text-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Grupo validado</AlertTitle>
                <AlertDescription>
                  {validatedGroup.group_name || "Grupo encontrado"} com {validatedGroup.participants_count ?? 0} participante(s).
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Etapa {currentStepIndex + 1} de {steps.length}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{currentStep.title}</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{currentStep.description}</p>
                </div>
                <div className="min-w-[88px] rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-right">
                  <p className="text-lg font-semibold leading-none text-foreground">{progress}%</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">concluído</p>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {steps.map((step, index) => {
                  const isCurrent = index === currentStepIndex;
                  const isCompleted = index < currentStepIndex;

                  return (
                    <StepChip
                      key={step.id}
                      index={index}
                      title={step.title}
                      isCurrent={isCurrent}
                      isCompleted={isCompleted}
                      disabled={isSubmitting || index > currentStepIndex}
                      onClick={() => {
                        if (index <= currentStepIndex) {
                          setCurrentStepIndex(index);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {currentStep.id === "profile" ? (
              <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
                <Field
                  label="Nome completo"
                  icon={<Users className="h-4 w-4" />}
                  error={fieldErrors.fullName}
                >
                  <Input
                    value={values.fullName}
                    onChange={(event) => setValue("fullName", event.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                </Field>

                <Field
                  label="Organização"
                  icon={<Building2 className="h-4 w-4" />}
                  error={fieldErrors.organizationName}
                >
                  <Input
                    value={values.organizationName}
                    onChange={(event) => setValue("organizationName", event.target.value)}
                    placeholder="Nome da empresa ou operação"
                    autoComplete="organization"
                    disabled={isSubmitting}
                  />
                </Field>

                <Field label="Email" icon={<Mail className="h-4 w-4" />} error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={values.email}
                    onChange={(event) => setValue("email", event.target.value)}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                    disabled={isSubmitting || isResumingOnboarding}
                  />
                </Field>

                <Field label="WhatsApp" icon={<Phone className="h-4 w-4" />} error={fieldErrors.whatsappPhone}>
                  <Input
                    value={values.whatsappPhone}
                    onChange={(event) => setValue("whatsappPhone", event.target.value)}
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "access" ? (
              <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
                <Field label="Senha" icon={<Lock className="h-4 w-4" />} error={fieldErrors.password}>
                  <Input
                    type="password"
                    value={values.password}
                    onChange={(event) => setValue("password", event.target.value)}
                    placeholder="Crie uma senha segura"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                </Field>

                <Field label="Confirmar senha" icon={<KeyRound className="h-4 w-4" />} error={fieldErrors.confirmPassword}>
                  <Input
                    type="password"
                    value={values.confirmPassword}
                    onChange={(event) => setValue("confirmPassword", event.target.value)}
                    placeholder="Repita sua senha"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "group" ? (
              <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                <Field label="Link do grupo do WhatsApp" icon={<ArrowRight className="h-4 w-4" />} error={fieldErrors.inviteLink}>
                  <Input
                    ref={inviteLinkInputRef}
                    value={values.inviteLink}
                    onChange={(event) => setValue("inviteLink", event.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </Field>

                <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Resumo da criação</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ao concluir, vamos preparar estes itens para o seu primeiro acesso.
                      </p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {isResumingOnboarding ? "Quase pronto" : "Último passo"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SummaryCard
                      icon={<Mail className="h-4 w-4" />}
                      title="Conta"
                      description={isResumingOnboarding ? "Seu acesso será vinculado ao cadastro." : "Seu login será criado com email e senha."}
                    />
                    <SummaryCard
                      icon={<Building2 className="h-4 w-4" />}
                      title="Organização"
                      description="A empresa será criada com os dados informados nas etapas anteriores."
                    />
                    <SummaryCard
                      icon={<Users className="h-4 w-4" />}
                      title="Grupo"
                      description="O grupo será validado e conectado para liberar o painel."
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Antes de finalizar</p>
                  <p className="mt-1">
                    {isResumingOnboarding
                      ? "Sua conta já está confirmada. Agora só falta validar o grupo e concluir a criação da organização."
                      : "Vamos validar o link, criar sua conta e preparar sua organização com base nos participantes retornados."}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-4 border-t border-border/70 pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-sm rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <p className="text-sm font-medium text-card-foreground">{footerCopy.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{footerCopy.description}</p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
                  {currentStepIndex > 0 ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="min-w-[140px] border-border/70 bg-background/80"
                      disabled={isSubmitting}
                      onClick={() => setCurrentStepIndex((index) => Math.max(index - 1, 0))}
                    >
                      Voltar
                    </Button>
                  ) : null}

                  {isLastStep ? (
                    <Button type="submit" size="lg" className="min-w-[220px] shadow-[0_14px_30px_-18px_rgba(251,146,60,0.9)]" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {isSubmitting ? "Criando acesso..." : isResumingOnboarding ? "Concluir cadastro" : "Criar conta e entrar"}
                    </Button>
                  ) : (
                    <Button type="button" size="lg" className="min-w-[220px] shadow-[0_14px_30px_-18px_rgba(251,146,60,0.9)]" disabled={isSubmitting} onClick={handleStepAdvance}>
                      Continuar
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={handleExistingAccountClick}
                  disabled={isSubmitting}
                >
                  {isResumingOnboarding ? "Ir para o login" : "Já tenho conta"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}

type FieldProps = {
  label: string;
  icon: ReactNode;
  error?: string;
  children: ReactNode;
};

function Field({ label, icon, error, children }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-card-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </label>
  );
}

type SummaryCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

type StepChipProps = {
  index: number;
  title: string;
  isCurrent: boolean;
  isCompleted: boolean;
  disabled: boolean;
  onClick: () => void;
};

function SummaryCard({ icon, title, description }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/85 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="text-primary">{icon}</span>
        <span>{title}</span>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function StepChip({ index, title, isCurrent, isCompleted, disabled, onClick }: StepChipProps) {
  return (
    <button
      type="button"
      className={`min-h-[88px] rounded-2xl border px-3 py-3 text-left transition ${
        isCurrent
          ? "border-primary/50 bg-primary/8 shadow-[0_12px_24px_-20px_rgba(251,146,60,0.9)]"
          : isCompleted
            ? "border-success/30 bg-success/10"
            : "border-border/70 bg-background/80 hover:border-border"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            isCurrent
              ? "bg-primary text-primary-foreground"
              : isCompleted
                ? "bg-success/20 text-success"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {index + 1}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Etapa</p>
          <p className="mt-1 text-sm font-medium leading-5 text-foreground">{title}</p>
        </div>
      </div>
    </button>
  );
}
