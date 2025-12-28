import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(8, "Senha deve ter pelo menos 8 caracteres");

const Auth = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isRecoveryParam = params.get("type") === "recovery";
    if (!authLoading && isAuthenticated && !isRecoveryParam && !isRecovery) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, isRecovery]);

  const validateInputs = () => {
    if (isRecovery) {
      try {
        passwordSchema.parse(newPassword);
      } catch (e) {
        if (e instanceof z.ZodError) {
          setError(e.errors[0].message);
        }
        return false;
      }
      if (newPassword !== confirmPassword) {
        setError("As senhas não coincidem");
        return false;
      }
      return true;
    } else {
      try {
        emailSchema.parse(email);
        passwordSchema.parse(password);
        return true;
      } catch (e) {
        if (e instanceof z.ZodError) {
          setError(e.errors[0].message);
        }
        return false;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        notify.success("Login realizado", "Bem-vindo de volta.");
        navigate("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      
      // Friendly error messages
      if (message.includes("Invalid login credentials")) {
        setError("Email ou senha incorretos");
      } else if (message.includes("User already registered")) {
        setError("Este email já está cadastrado");
      } else if (message.includes("Email not confirmed")) {
        setError("Por favor, confirme seu email antes de fazer login");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setResetLoading(true);
    try {
      emailSchema.parse(email);
    } catch {
      setError("Informe um email válido para recuperar a senha");
      setResetLoading(false);
      return;
    }
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) {
      const msg = error.message || "";
      const rateMatch = msg.match(/For security purposes, you can only request this after\s+(\d+)\s+seconds/i);
      if (rateMatch) {
        const secs = rateMatch[1];
        setError(`Por segurança, você só pode solicitar novamente após ${secs} segundos.`);
      } else {
        setError(msg);
      }
      setResetLoading(false);
      return;
    }
    notify.info("Link enviado", "Verifique seu email para recuperar a senha.");
    setResetLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") === "recovery") {
      setIsRecovery(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setError("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/admin-logo.png" alt="Bóris Admin" className="h-16 w-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Bóris Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">{isRecovery ? "Defina sua nova senha" : "Entre na sua conta"}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Email */}
            {!isRecovery && (
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}

            {/* Password / Recovery */}
            {!isRecovery ? (
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? "Enviando..." : "Esqueci minha senha"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-1.5 block">
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRecovery ? "Atualizando..." : "Entrando..."}
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
