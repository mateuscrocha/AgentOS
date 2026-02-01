import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import AccessDenied from "./AccessDenied";
import { Copy, User, Shield, Users, Eye, CheckCircle, AlertCircle } from "lucide-react";
import { notify } from "@/components/ui/sonner";

const TEST_USERS = [
  {
    email: "sysadmin+boris-admin@gmail.com",
    password: "12345678",
    role: "SYSTEM_ADMIN",
    description: "Acesso total ao sistema. Vê todas as orgs e groups.",
    icon: Shield,
    color: "text-destructive",
  },
  {
    email: "orgadmin+boris-admin@gmail.com",
    password: "12345678",
    role: "ORG_ADMIN",
    description: "Admin da 'Org Teste'. Pode editar org e grupos da org.",
    icon: User,
    color: "text-warning",
  },
  {
    email: "manager+boris-admin@gmail.com",
    password: "12345678",
    role: "GROUP_MANAGER",
    description: "Gerente do 'Grupo Teste'. Pode editar o grupo.",
    icon: Users,
    color: "text-primary",
  },
  {
    email: "viewer+boris-admin@gmail.com",
    password: "12345678",
    role: "USER",
    description: "Viewer do 'Grupo Teste'. Apenas visualização.",
    icon: Eye,
    color: "text-muted-foreground",
  },
];

export default function DevTestUsers() {
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  // Check if test data exists
  const { data: testData, isLoading: dataLoading } = useQuery({
    queryKey: ["test-data-status"],
    queryFn: async () => {
      const [orgsRes, groupsRes, rolesRes] = await Promise.all([
        supabase.from("organizations").select("id, name").eq("name", "Org Teste").maybeSingle(),
        supabase.from("groups").select("id, name").eq("name", "Grupo Teste").maybeSingle(),
        supabase.from("user_roles").select("id, role, user_id").limit(10),
      ]);

      return {
        hasOrg: !!orgsRes.data,
        orgId: orgsRes.data?.id,
        hasGroup: !!groupsRes.data,
        groupId: groupsRes.data?.id,
        rolesCount: rolesRes.data?.length || 0,
        roles: rolesRes.data || [],
      };
    },
    enabled: isSystemAdmin,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success("Copiado", "Conteúdo copiado para a área de transferência.");
  };

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Test Users" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied message="Página restrita a SYSTEM_ADMIN." />;
  }

  const seedSQL = `-- ============================================
-- SEED DE TESTE - Admin V4
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Criar organização de teste
INSERT INTO organizations (id, name, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Org Teste', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar grupo de teste
INSERT INTO groups (id, name, organization_id, provider)
VALUES ('22222222-2222-2222-2222-222222222222', 'Grupo Teste', '11111111-1111-1111-1111-111111111111', 'whatsapp')
ON CONFLICT (id) DO NOTHING;

-- 3. Criar membros de exemplo
INSERT INTO members (id, name, phone, group_id, is_admin)
VALUES 
  ('33333333-3333-3333-3333-333333333331', 'Membro Teste 1', '+5511999990001', '22222222-2222-2222-2222-222222222222', true),
  ('33333333-3333-3333-3333-333333333332', 'Membro Teste 2', '+5511999990002', '22222222-2222-2222-2222-222222222222', false),
  ('33333333-3333-3333-3333-333333333333', 'Membro Teste 3', '+5511999990003', '22222222-2222-2222-2222-222222222222', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Criar mensagens de exemplo
INSERT INTO messages (id, group_id, member_id, content, message_type)
VALUES 
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Olá, esta é uma mensagem de teste!', 'text'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333332', 'Segunda mensagem de teste', 'text'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '[Imagem de teste]', 'image')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- IMPORTANTE: Os usuários devem ser criados manualmente
-- no Supabase Auth > Users > Add User
-- 
-- Após criar os usuários, pegue os IDs e execute
-- o SQL de roles abaixo substituindo os UUIDs
-- ============================================
`;

  const rolesSQL = `-- ============================================
-- ROLES DE TESTE
-- Substitua os UUIDs pelos IDs reais dos usuários
-- criados no Supabase Auth
-- ============================================

-- SYSTEM_ADMIN (sysadmin+boris-admin@gmail.com)
INSERT INTO user_roles (user_id, role)
VALUES ('SUBSTITUIR_PELO_USER_ID_SYSADMIN', 'SYSTEM_ADMIN')
ON CONFLICT DO NOTHING;

-- ORG_ADMIN (orgadmin+boris-admin@gmail.com)
INSERT INTO user_roles (user_id, role, organization_id)
VALUES ('SUBSTITUIR_PELO_USER_ID_ORGADMIN', 'ORG_ADMIN', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- GROUP_MANAGER (manager+boris-admin@gmail.com)
INSERT INTO user_roles (user_id, role, organization_id, group_id)
VALUES ('SUBSTITUIR_PELO_USER_ID_MANAGER', 'GROUP_MANAGER', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- VIEWER/USER (viewer+boris-admin@gmail.com)
INSERT INTO user_roles (user_id, role, organization_id, group_id)
VALUES ('SUBSTITUIR_PELO_USER_ID_VIEWER', 'USER', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;
`;

  return (
    <AdminLayout title="Test Users" subtitle="Usuários fictícios para validação de permissões">
      <div className="space-y-6 animate-fade-in max-w-5xl">
        {/* Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Status dos Dados de Teste</h3>
          
          {dataLoading ? (
            <LoadingState message="Verificando..." className="py-4" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                {testData?.hasOrg ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">Org Teste</span>
              </div>
              <div className="flex items-center gap-2">
                {testData?.hasGroup ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">Grupo Teste</span>
              </div>
              <div className="flex items-center gap-2">
                {(testData?.rolesCount ?? 0) > 0 ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm">{testData?.rolesCount} Roles</span>
              </div>
            </div>
          )}
        </div>

        {/* Test Users */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Usuários de Teste</h3>
          
          <div className="grid gap-4">
            {TEST_USERS.map((user) => (
              <div
                key={user.email}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-secondary/20"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-card ${user.color}`}>
                  <user.icon className="h-6 w-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-card-foreground">{user.email}</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{user.description}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(user.email)}
                    className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Email
                  </button>
                  <button
                    onClick={() => copyToClipboard(user.password)}
                    className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Senha
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            Senha padrão: <code className="px-1.5 py-0.5 rounded bg-muted">12345678</code>
          </p>
        </div>

        {/* SQL Seed */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">SQL - Dados de Teste</h3>
            <button
              onClick={() => copyToClipboard(seedSQL)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Copiar SQL
            </button>
          </div>
          
          <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto max-h-64 text-muted-foreground">
            {seedSQL}
          </pre>
        </div>

        {/* SQL Roles */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">SQL - Roles (após criar usuários)</h3>
            <button
              onClick={() => copyToClipboard(rolesSQL)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Copiar SQL
            </button>
          </div>
          
          <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto max-h-64 text-muted-foreground">
            {rolesSQL}
          </pre>
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
          <h3 className="text-lg font-semibold text-warning mb-3">Instruções de Setup</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Execute o <strong>SQL de Dados de Teste</strong> no Supabase SQL Editor</li>
            <li>Vá em <strong>Authentication &gt; Users &gt; Add User</strong> e crie os 4 usuários com os emails acima</li>
            <li>Copie os <strong>User IDs</strong> gerados pelo Supabase Auth</li>
            <li>Substitua os IDs no <strong>SQL de Roles</strong> e execute</li>
            <li>Teste o login com cada usuário para validar as permissões</li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
