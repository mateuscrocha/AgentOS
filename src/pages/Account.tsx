import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { UserCircle, Mail, Shield, Key, LogOut, Save, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
 
import { notify } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { formatDateSimpleBR, SAO_PAULO_TZ } from "@/lib/date";

const nameSchema = z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres");
const passwordSchema = z
  .string()
  .regex(/^\d{6}$/, "Senha deve ter exatamente 6 dígitos");

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
    try {
      passwordSchema.parse(newPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        setPasswordError(e.errors[0].message);
        return;
      }
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
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Profile header */}
        <div className="flex items-center gap-4 p-6 rounded-xl border border-border bg-card">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <UserCircle className="h-10 w-10 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-card-foreground">
              {profile?.name || user?.email?.split('@')[0] || 'Usuário'}
            </h2>
            <p className="text-sm text-muted-foreground">{user?.email || 'Não autenticado'}</p>
            <div className="flex gap-2 mt-2">
              {isAuthenticated && (
                <>
                  <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                    Autenticado
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {getRoleDisplay()}
                  </span>
                </>
              )}
            </div>
          </div>
          <Button 
            variant="destructive"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal info - editable */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">Informações Pessoais</h3>
            </div>
            
            <div className="space-y-4">
              {/* ID - read only */}
              <div>
                <Label className="text-muted-foreground text-xs">ID</Label>
                <p className="text-sm text-card-foreground font-mono">
                  {user?.id || '-'}
                </p>
              </div>

              {/* Email - read only */}
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p className="text-sm text-card-foreground">{user?.email || '-'}</p>
              </div>

              {/* Name - editable */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className={nameError ? "border-destructive" : ""}
                  />
                  <Button 
                    onClick={handleSaveName} 
                    disabled={savingName || name === profile?.name}
                    size="sm"
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

              {/* Role - read only */}
              <div>
                <Label className="text-muted-foreground text-xs">Role Global</Label>
                <p className="text-sm text-card-foreground">{getRoleDisplay()}</p>
              </div>

              {/* Created at - read only */}
              <div>
                <Label className="text-muted-foreground text-xs">Criado em</Label>
                <p className="text-sm text-card-foreground">
                  {user?.created_at ? formatDateSimpleBR(user.created_at) : '-'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Security - password change */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">Segurança</h3>
            </div>
            
            <div className="space-y-4">
              {/* Password error */}
              {passwordError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{passwordError}</p>
                </div>
              )}

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    inputMode="numeric"
                    pattern="\\d{6}"
                    maxLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Exatamente 6 dígitos.</p>
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  inputMode="numeric"
                  pattern="\\d{6}"
                  maxLength={6}
                  autoComplete="new-password"
                />
              </div>

              <Button 
                onClick={handleChangePassword} 
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Key className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>

              {/* Session info */}
              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Último login</span>
                  <span className="text-card-foreground">
                    {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', { timeZone: SAO_PAULO_TZ }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Método de acesso</span>
                  <span className="text-card-foreground">
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
