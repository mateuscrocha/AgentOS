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

  const progress = useMemo(() => {
    const filled = [
      values.fullName,
      values.organizationName,
      values.email,
      values.whatsappPhone,
      values.password,
      values.confirmPassword,
      values.inviteLink,
    ].filter((value) => value.trim()).length;
    return Math.round((filled / 7) * 100);
  }, [values]);

  const setValue = (key: keyof PublicOnboardingFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setGlobalError("");
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
    }
  }, [location.search, user?.email]);

  const handleExistingAccountClick = () => {
    clearPendingOnboardingDraft();
    setGlobalError("");
    navigate("/auth", { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGlobalError("");
    setValidatedGroup(null);

    const errors = validatePublicOnboardingForm({
      ...values,
      password: isResumingOnboarding ? "Senha!12345" : values.password,
      confirmPassword: isResumingOnboarding ? "Senha!12345" : values.confirmPassword,
    });

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
    <PublicLayout progress={progress}>
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center">
          <img src="/admin-logo.png" alt="Central de Comando do Bóris" className="mb-2 h-24 w-auto" />
          <h1 className="text-center text-2xl font-bold text-foreground">Criar organização</h1>
          <p className="mt-1 max-w-xl text-center text-sm text-muted-foreground">
            Use o mesmo fluxo do panel para validar o grupo, criar sua conta e liberar o primeiro acesso.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
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

            <div className="grid gap-4 sm:grid-cols-2">
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

              {!isResumingOnboarding ? (
                <>
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
                </>
              ) : null}
            </div>

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

            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">O que acontece depois</p>
              <p className="mt-1">
                {isResumingOnboarding
                  ? "Sua conta já está confirmada. Agora falta validar o grupo e concluir a criação da organização."
                  : "Validamos o grupo, criamos a conta e provisionamos sua organização com base nos participantes retornados."}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {isResumingOnboarding ? (
                  <>
                    <p className="text-sm font-medium text-card-foreground">Continuar cadastro</p>
                    <p className="text-sm text-muted-foreground">Ajuste os dados abaixo e tente novamente com outro grupo.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-card-foreground">Senha do app</p>
                    <p className="text-sm text-muted-foreground">{getPasswordHint()}</p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <Button type="submit" size="lg" className="min-w-[220px]" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? "Criando acesso..." : isResumingOnboarding ? "Concluir cadastro" : "Criar conta e entrar"}
                </Button>
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
