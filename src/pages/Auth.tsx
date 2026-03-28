import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { getAppUrl } from "@/lib/utils";
import { z } from "zod";
import { APP_PASSWORD_HINT, validateAppPassword } from "@/lib/password-policy";
import { completePendingOnboardingDraft } from "@/lib/public-onboarding";
import { readPendingOnboardingDraft } from "@/lib/public-onboarding-pending";

const emailSchema = z.string().email("Email inválido");
const loginPasswordSchema = z.string().min(1, "Senha é obrigatória");

function buildOnboardingRetryPath(message: string, email?: string) {
  const params = new URLSearchParams();
  params.set("onboarding_error", message);
  if (email) {
    params.set("email", email);
  }
  return `/signup?${params.toString()}`;
}

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [provisioningPendingOnboarding, setProvisioningPendingOnboarding] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const globalErrorRef = useRef<HTMLDivElement>(null);
  const onboardingSuccessHandledRef = useRef(false);
  const pendingOnboardingAttemptRef = useRef(false);

  const redirectPendingOnboardingToSignup = (message: string) => {
    const pendingDraft = readPendingOnboardingDraft();
    navigate(buildOnboardingRetryPath(message, pendingDraft?.email || email), { replace: true });
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isRecovery && !readPendingOnboardingDraft()) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, isRecovery]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || isRecovery || pendingOnboardingAttemptRef.current) {
      return;
    }

    const pendingDraft = readPendingOnboardingDraft();
    if (!pendingDraft) return;

    pendingOnboardingAttemptRef.current = true;
    setProvisioningPendingOnboarding(true);

    void completePendingOnboardingDraft(pendingDraft.userId)
      .then((result) => {
        if (result?.group_id) {
          notify.success("Cadastro concluído", "Sua organização foi criada com sucesso.");
          navigate(`/groups/${result.group_id}`, { replace: true });
          return;
        }
        navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Não foi possível concluir seu onboarding.";
        pendingOnboardingAttemptRef.current = false;
        redirectPendingOnboardingToSignup(message);
      })
      .finally(() => {
        setProvisioningPendingOnboarding(false);
      });
  }, [authLoading, isAuthenticated, isRecovery, navigate]);

  const validateInputs = () => {
    setFieldErrors({});
    if (isRecovery) {
      try {
        const passwordError = validateAppPassword(newPassword);
        if (passwordError) {
          setFieldErrors({ newPassword: passwordError });
          newPasswordInputRef.current?.focus();
          return false;
        }
      } catch (e) {
        if (e instanceof Error) {
          setFieldErrors({ newPassword: e.message });
          newPasswordInputRef.current?.focus();
        }
        return false;
      }
      if (newPassword !== confirmPassword) {
        setFieldErrors({ confirmPassword: "As senhas não coincidem" });
        confirmPasswordInputRef.current?.focus();
        return false;
      }
      return true;
    } else {
      try {
        emailSchema.parse(email);
        loginPasswordSchema.parse(password);
        return true;
      } catch (e) {
        if (e instanceof z.ZodError) {
          const msg = e.errors[0].message;
          if (/email/i.test(msg)) {
            setFieldErrors({ email: msg });
            emailInputRef.current?.focus();
          } else {
            setFieldErrors({ password: msg });
            passwordInputRef.current?.focus();
          }
        } else if (e instanceof Error) {
          setError(e.message);
        }
        return false;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setFieldErrors({});

    if (!validateInputs()) return;

    setLoading(true);

    try {
      if (isRecovery) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        notify.success("Senha atualizada", "Você pode acessar com a nova senha.");
        setIsRecovery(false);
        setNewPassword("");
        setConfirmPassword("");
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const pendingDraft = readPendingOnboardingDraft();
        if (pendingDraft?.userId && data.user?.id === pendingDraft.userId) {
          setProvisioningPendingOnboarding(true);
          let provision;
          try {
            provision = await completePendingOnboardingDraft(data.user.id);
          } catch (pendingError: unknown) {
            const message = pendingError instanceof Error ? pendingError.message : "Não foi possível concluir seu onboarding.";
            redirectPendingOnboardingToSignup(message);
            return;
          }
          notify.success("Login realizado", "Bem-vindo de volta.");
          if (provision?.group_id) {
            navigate(`/groups/${provision.group_id}`, { replace: true });
          } else {
            navigate("/");
          }
          return;
        }

        notify.success("Login realizado", "Bem-vindo de volta.");
        navigate("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      if (isRecovery && (/session/i.test(message) || /expired/i.test(message))) {
        setError("Link de recuperação inválido ou expirado. Solicite novamente.");
      } else if (message.includes("Invalid login credentials")) {
        setError("Email ou senha incorretos");
      } else if (message.includes("User already registered")) {
        setError("Este email já está cadastrado");
      } else if (message.includes("Email not confirmed")) {
        setError("Por favor, confirme seu email antes de fazer login");
      } else if (/password/i.test(message) && /(too\s*long|max(imum)?|at\s*most|limit|length|caracter)/i.test(message)) {
        setError("Senha muito longa. Tente uma senha menor.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfoMessage("");
    setFieldErrors({});
    setResetLoading(true);
    try {
      emailSchema.parse(email);
    } catch {
      setError("Informe um email válido para recuperar a senha");
      setResetLoading(false);
      return;
    }
    const redirectUrl = `${getAppUrl()}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) {
      const msg = error.message || "";
      const rateMatch = msg.match(/For security purposes, you can only request this after\s+(\d+)\s+seconds/i);
      if (rateMatch) {
        const secs = rateMatch[1];
        setError(`Por segurança, você só pode solicitar novamente após ${secs} segundos.`);
      } else if (/redirect/i.test(msg) && /not.*allowed|invalid/i.test(msg)) {
        setError("URL de redirecionamento não permitida. Verifique a configuração de Redirect URLs no Supabase.");
      } else {
        setError(msg);
      }
      setResetLoading(false);
      return;
    }
    notify.info("Link enviado", "Verifique seu email para recuperar a senha.");
    setInfoMessage("Link de recuperação enviado. Verifique seu email.");
    setResetLoading(false);
  };

  useEffect(() => {
    if (error) {
      globalErrorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const onboardingStatus = params.get("onboarding");
    const prefilledEmail = params.get("email");

    if (prefilledEmail && !email) {
      setEmail(prefilledEmail);
    }

    if (onboardingStatus === "success" && !onboardingSuccessHandledRef.current) {
      onboardingSuccessHandledRef.current = true;
      setInfoMessage("Cadastro criado. Confirme seu email e depois faça login para acessar seu grupo.");
    }
  }, [location.search, email]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setError("");
        setInfoMessage("");
        setFieldErrors({});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/admin-logo.png" alt="Central de Comando do Bóris" className="h-24 w-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Central de Controle</h1>
          <p className="text-sm text-muted-foreground mt-1">{isRecovery ? "Defina sua nova senha" : "Entre na sua conta"}</p>
          {provisioningPendingOnboarding ? (
            <p className="mt-2 text-sm text-primary">Concluindo seu onboarding e preparando seu primeiro acesso...</p>
          ) : null}
          {!isRecovery ? (
            <button
              type="button"
              className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => navigate("/signup")}
            >
              Primeira vez aqui? Cadastre sua organização
            </button>
          ) : null}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div
                ref={globalErrorRef}
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
              >
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {infoMessage && (
              <div
                role="status"
                aria-live="polite"
                className="p-3 rounded-lg bg-primary/10 border border-primary/20"
              >
                <p className="text-sm text-foreground">{infoMessage}</p>
              </div>
            )}

            {/* Email */}
            {!isRecovery && (
              <div>
                <label htmlFor="email" className="text-sm font-medium text-card-foreground mb-1.5 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder="seu@email.com"
                    required
                    disabled={loading || resetLoading || provisioningPendingOnboarding}
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1 text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            )}

            {/* Password / Recovery */}
            {!isRecovery ? (
              <div>
                <label htmlFor="password" className="text-sm font-medium text-card-foreground mb-1.5 block">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="••••••••"
                    required
                    disabled={loading || resetLoading || provisioningPendingOnboarding}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="mt-1 text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading || loading}
                    className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? "Enviando..." : "Esqueci minha senha"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium text-card-foreground mb-1.5 block">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="new-password"
                      ref={newPasswordInputRef}
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError("");
                        if (fieldErrors.newPassword) {
                          setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                        }
                      }}
                      placeholder="••••••"
                      required
                      disabled={loading}
                      minLength={10}
                      maxLength={72}
                      autoComplete="new-password"
                      aria-invalid={Boolean(fieldErrors.newPassword)}
                      aria-describedby={fieldErrors.newPassword ? "new-password-error" : undefined}
                      className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.newPassword && (
                    <p id="new-password-error" className="mt-1 text-sm text-destructive">
                      {fieldErrors.newPassword}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{APP_PASSWORD_HINT}</p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-sm font-medium text-card-foreground mb-1.5 block">
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="confirm-password"
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError("");
                        if (fieldErrors.confirmPassword) {
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      placeholder="••••••"
                      required
                      disabled={loading}
                      minLength={10}
                      maxLength={72}
                      autoComplete="new-password"
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                      aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
                      className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p id="confirm-password-error" className="mt-1 text-sm text-destructive">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
                disabled={loading || resetLoading || provisioningPendingOnboarding}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading || provisioningPendingOnboarding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {provisioningPendingOnboarding ? "Concluindo..." : isRecovery ? "Atualizando..." : "Entrando..."}
                  </>
                ) : (
                isRecovery ? "Definir nova senha" : "Entrar"
              )}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default Auth;
