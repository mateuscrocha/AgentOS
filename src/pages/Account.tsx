import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { UserCircle, Mail, Shield, Key, LogOut, Save, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
 
import { notify } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";
import { APP_PASSWORD_HINT, validateAppPassword } from "@/lib/password-policy";

const nameSchema = z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres");
const Account = () => {
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const { roles, isSystemAdmin } = useUserRoles();
  
  // Profile state
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  
  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Fetch profile
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      // Create profile if doesn't exist
      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user!.id, name: user?.user_metadata?.full_name || '' })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newProfile;
      }
      
      return data;
    },
    enabled: isAuthenticated && !!user?.id,
  });

  // Set initial name from profile
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile]);

  // Get role display
  const getRoleDisplay = () => {
    if (isSystemAdmin) return 'SYSTEM_ADMIN';
    if (roles && roles.length > 0) {
      const uniqueRoles = [...new Set(roles.map(r => r.role))];
      return uniqueRoles.join(', ');
    }
    return 'Nenhum';
  };

  const handleSaveName = async () => {
    setNameError("");
    
    try {
      nameSchema.parse(name.trim());
    } catch (e) {
      if (e instanceof z.ZodError) {
        setNameError(e.errors[0].message);
        return;
      }
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', user!.id);

      if (error) {
        if (error.code === '42501' || error.message.includes('policy')) {
          notify.error("Sem permissão", "Você não pode editar seu perfil.");
        } else {
          notify.error("Não foi possível atualizar", "Algo deu errado. Tente novamente.");
        }
        return;
      }

      notify.success("Nome atualizado", "Suas informações foram salvas.");
      refetchProfile();
    } catch (err: any) {
      notify.error("Não foi possível atualizar", "Algo deu errado. Tente novamente.");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    // Validation
    const passwordError = validateAppPassword(newPassword);
    if (passwordError) {
      setPasswordError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      notify.success("Senha alterada", "Você pode usar a nova senha.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err.message.includes("should be different")) {
        setPasswordError("A nova senha deve ser diferente da atual");
      } else {
        setPasswordError(err.message || "Erro ao alterar senha");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    notify.success("Logout realizado", "Até logo!");
    window.location.assign('/auth');
  };

  const formatProviderLabel = (p: string) => {
    if (!p) return '-';
    switch (p.toLowerCase()) {
      case 'email':
        return 'e-mail';
      case 'google':
        return 'Google';
      case 'github':
        return 'GitHub';
      default:
        return p;
    }
  };

  if (loading || profileLoading) {
    return (
      <AdminLayout title="Minha Conta" subtitle="Carregando...">
        <LoadingState message="Carregando dados do usuário..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Minha Conta"
      subtitle="Gerencie suas informações pessoais e segurança"
    >
      <div className="max-w-4xl space-y-6 animate-fade-in lg:space-y-7">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Painel", href: "/" }, { label: "Minha conta" }]}
          title="Minha conta"
          description="Gerencie seus dados pessoais, credenciais de acesso e informações da sessão atual."
        />

        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-amber-100">
              <UserCircle className="h-10 w-10 text-amber-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-950">
                {profile?.name || user?.email?.split('@')[0] || 'Usuário'}
              </h2>
              <p className="text-sm text-slate-600">{user?.email || 'Não autenticado'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isAuthenticated && (
                  <>
                    <Badge variant="outline" className="h-7 border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700">
                      Autenticado
                    </Badge>
                    <Badge variant="outline" className="h-7 border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-800">
                      {getRoleDisplay()}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Mail className="h-5 w-5 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-950">Informações pessoais</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-slate-500">ID</Label>
                <p className="font-mono text-sm text-slate-950">
                  {user?.id || '-'}
                </p>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Email</Label>
                <p className="text-sm text-slate-950">{user?.email || '-'}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className={nameError ? "border-destructive" : "border-slate-200 bg-slate-50"}
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={savingName || name === profile?.name}
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
                {nameError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs text-slate-500">Role global</Label>
                <p className="text-sm text-slate-950">{getRoleDisplay()}</p>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Criado em</Label>
                <p className="text-sm text-slate-950">
                  {user?.created_at ? formatDateSimpleBR(user.created_at) : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                <Shield className="h-5 w-5 text-amber-700" />
              </div>
              <h3 className="font-semibold text-slate-950">Segurança</h3>
            </div>

            <div className="space-y-4">
              {passwordError && (
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{passwordError}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••"
                    minLength={10}
                    maxLength={72}
                    autoComplete="new-password"
                    className="border-slate-200 bg-slate-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{APP_PASSWORD_HINT}</p>
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                  minLength={10}
                  maxLength={72}
                  autoComplete="new-password"
                  className="border-slate-200 bg-slate-50"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full bg-amber-600 text-white hover:bg-amber-700"
              >
                {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Key className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Último login</span>
                  <span className="text-slate-950">
                    {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', { timeZone: SAO_PAULO_TZ }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Método de acesso</span>
                  <span className="text-slate-950">
                    {formatProviderLabel(user?.app_metadata?.provider || 'email')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Account;
