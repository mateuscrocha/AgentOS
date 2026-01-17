# Admin do Bóris (v2) — 03_ACCESS_CONTROL

## Contexto
- Controle de acesso baseado em papéis (RBAC) e RLS no Supabase.
- Níveis de acesso: System, Organization, Group.
- Papéis: `SYSTEM_ADMIN`, `ORG_ADMIN`, `GROUP_MANAGER`, `READ_ONLY`.
- `READ_ONLY` é equivalente técnico a `USER` no `app_role`.
- Acesso sempre autenticado. Onboarding público cria vínculos iniciais.

## O que este documento define
- Semântica de cada papel e escopo de acesso.
- Regras de leitura/edição por nível.
- Como RLS e funções SQL aplicam as regras.
- Ponte com checagens de acesso no frontend.
- Mapeamento entre papéis do produto e enum `app_role`.

## Regras que NÃO podem ser quebradas
- RLS habilitado em todas as tabelas sensíveis.
- Nenhum acesso a dados sem autenticação.
- Escopo de leitura e edição restritos ao nível do papel.
- `READ_ONLY` não executa operações de escrita.
- `Message` e `Member` somente dentro de `Group`.
- Não alterar grupos no WhatsApp pelo Admin; apenas configuração no banco.

## Decisões já tomadas
- Enum `app_role`: `SYSTEM_ADMIN`, `ORG_ADMIN`, `GROUP_MANAGER`, `USER`.
- Tabela `user_roles` vincula usuário ao papel e ao escopo (org/grupo).
- Funções de acesso:
  - `has_role`, `is_system_admin`, `has_org_access`, `has_group_access`.
  - `can_edit_org`, `can_edit_group`, `can_create_group`.
- Políticas RLS aplicadas a `organizations`, `groups`, `members`, `messages`.
- Views para leitura (ex.: `v_messages_feed`, `v_group_overview`).

## O que não é responsabilidade deste escopo
- Descrever UI de gestão de papéis.
- Implementar automações de onboarding ou provisão.
- Detalhar lógica de auditoria ou trilhas de acesso.
- Propor mudanças de arquitetura ou stack.

## Papéis e escopo
- `SYSTEM_ADMIN`
  - Lê e configura todo o sistema.
  - Vê todas as organizações e grupos.
  - Pode editar organizações e grupos.
- `ORG_ADMIN`
  - Lê e configura sua organização.
  - Vê todos os grupos da organização.
  - Pode editar a organização e grupos da organização.
- `GROUP_MANAGER`
  - Lê grupos específicos sob gestão.
  - Vê membros, mensagens e métricas do grupo.
  - Pode editar configurações do(s) grupo(s) vinculado(s).
- `READ_ONLY` (`USER`)
  - Visualização apenas dentro do escopo atribuído.
  - Sem edição.

## Aplicação das regras (dados)
- `organizations`
  - Leitura: usuários com acesso à organização ou `SYSTEM_ADMIN`.
  - Edição: `SYSTEM_ADMIN` ou `ORG_ADMIN` da organização.
- `groups`
  - Leitura: usuários com acesso ao grupo ou à organização do grupo; `SYSTEM_ADMIN`.
  - Edição: `SYSTEM_ADMIN`, `ORG_ADMIN` da organização, ou `GROUP_MANAGER` do grupo.
- `members` (participantes WhatsApp)
  - Leitura: usuários com acesso ao grupo.
  - Inserções são restritas a fluxos de provisão/serviço.
- `messages`
  - Leitura: usuários com acesso ao grupo.
  - Sem escrita pelo Admin.

## Aplicação das regras (frontend)
- Gating por hooks:
  - `src/hooks/use-user-roles.ts:97` (`isSystemAdmin`).
  - `src/hooks/use-user-roles.ts:148` (`hasOrgAccess`).
  - `src/hooks/use-user-roles.ts:156` (`hasGroupAccess`).
  - `src/hooks/use-user-roles.ts:164` (`canEditOrg`).
  - `src/hooks/use-user-roles.ts:171` (`canEditGroup`).
- Autenticação e proteção de rotas:
  - `src/hooks/use-auth.ts:39` (`isAuthenticated`).
  - `src/components/auth/AuthGuard.tsx:11` (rotas públicas) e `src/components/auth/AuthGuard.tsx:43` (proteção).

## Aba "Configurações" do Grupo (visibilidade)
- A aba "Configurações" na navegação do grupo aparece apenas quando `canEditGroup(groupId, organizationId) === true`.
- Isso equivale a:
  - `SYSTEM_ADMIN`, ou
  - `ORG_ADMIN` da organização do grupo, ou
  - `GROUP_MANAGER` vinculado diretamente ao `group_id`.
- Usuários `READ_ONLY` (`USER`) não visualizam a aba.
- Referência de UI: `src/components/group-navigation/GroupPageTop.tsx`.

## Monitoramento pós-implantação (checklist)
- Validar que `GROUP_MANAGER` e `ORG_ADMIN` veem a aba e acessam `/groups/:groupId/edit`.
- Validar que `READ_ONLY` não vê a aba e recebe bloqueio ao acessar a rota direta.
- Acompanhar erros de acesso (RLS `PGRST301` / mensagens de permission) em logs de frontend e Supabase.

## Atividades do grupo (via API)
- A atividade do grupo é persistida em `public.events`.
- Leitura via Supabase (programática) usa:
  - `from('events').select('*').eq('entity_type', 'group').eq('entity_id', groupId).order('created_at', { ascending: false })`
  - Opcional: filtrar por `event_type` e paginar com `.range(from, to)`.
- A UI não exibe mais o item "Atividade" no menu do grupo, mas a rota `/groups/:groupId/events` continua existindo para acesso direto.
- Permissões:
  - A política padrão de leitura em `events` é restrita a `SYSTEM_ADMIN`.
  - Para acesso por `ORG_ADMIN`/`GROUP_MANAGER`, criar endpoint/Edge Function dedicado com checagem `has_group_access`.

## Criação de usuário por Admin (novo)
- Fluxo de criação em `src/pages/Users.tsx`:
  - Seleção de "Permissão inicial" (organização ou grupo).
  - Para organização, existe a opção "Conceder papel de Gestor de Organização".
  - Invocação da função `admin-create-user` com payload incluindo `assign_org_admin`.
- Lado servidor (Edge Function): `supabase/functions/admin-create-user/index.ts`
  - Cria usuário via `auth.admin.createUser`.
  - Registra `user_access_scope` inicial (organization/group).
  - Quando `assign_org_admin=true` e `scope_type=organization`, atribui `ORG_ADMIN` em `user_roles`.
  - Verifica privilégios imediatamente com `can_edit_org` e `has_org_access`.
  - Registra evento de auditoria `ORG_ADMIN_ASSIGNED` em `events`.
  - Tratamento de erros com códigos: `EMAIL_EXISTS`, `INSERT_SCOPE_FAILED`, `ASSIGN_ORG_ADMIN_FAILED`, `VERIFY_ORG_ADMIN_FAILED`.

## Exclusão de usuário por Admin (novo)
- Fluxo de exclusão em `src/pages/Users.tsx`:
  - Admin aciona exclusão de um usuário alvo.
  - Invoca a função `admin-delete-user` com payload `{ user_id }`.
- Lado servidor (Edge Function): `supabase/functions/admin-delete-user/index.ts`
  - Permissão: apenas `SYSTEM_ADMIN`.
  - Bloqueios:
    - Impede auto-exclusão (`CANNOT_DELETE_SELF`).
    - Impede excluir o último `SYSTEM_ADMIN` (`LAST_SYSTEM_ADMIN`).
  - Limpeza de dependências antes de excluir:
    - `organizations.owner_user_id` (FK restritiva `organizations_owner_user_id_fkey`):
      - Transfere o owner para um `ORG_ADMIN` da organização (mais antigo) quando existir.
      - Caso não exista substituto, define `owner_user_id = NULL`.
    - `group_members.granted_by_user_id` (FK restritiva `group_members_granted_by_user_id_fkey`):
      - Define `granted_by_user_id = NULL`.
  - Execução:
    - Exclui o usuário via `auth.admin.deleteUser`.
    - Registra auditoria em `events` com `event_type=USER_DELETED`.
  - Tratamento de erro:
    - Violação de FK (SQLSTATE `23503`) retorna `409` com `code=DEPENDENCIES_EXIST`.

## Correção em lote (existentes)
- Objetivo: normalizar usuários com escopo inicial de organização sem papéis ou com owner sem `ORG_ADMIN`.
- Estratégia:
  - Inserir papel `USER` para usuários com `user_access_scope=organization` e sem nenhum papel na organização.
  - Inserir `ORG_ADMIN` para `organizations.owner_user_id` sem papel `ORG_ADMIN`.
  - Registrar `ORG_ADMIN_ASSIGNED` para atribuições de admin realizadas por lote.

## Referências no código (paths quando fizer sentido)
- Enum e tabela de papéis:
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:2` (`public.app_role`).
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:5` (`public.user_roles`).
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:134` (policy ‘view own roles’).
- Funções de acesso:
  - `supabase/migrations/20251216203053_...sql:19` (`has_role`).
  - `supabase/migrations/20251216203053_...sql:35` (`is_system_admin`).
  - `supabase/migrations/20251216203053_...sql:51` (`has_org_access`).
  - `supabase/migrations/20251216203053_...sql:72` (`has_group_access`).
  - `supabase/migrations/20251216203053_...sql:94` (`can_edit_org`).
  - `supabase/migrations/20251216203053_...sql:113` (`can_edit_group`).
- Políticas RLS:
  - `supabase/migrations/20251216201320_1295a8d0-...sql:55` (RLS enable base).
  - `supabase/migrations/20251216203053_...sql:193` (org SELECT).
  - `supabase/migrations/20251216203053_...sql:214` (groups SELECT).
  - `supabase/migrations/20251216203053_...sql:224` (groups UPDATE).
  - `supabase/migrations/20251216203053_...sql:234` (members SELECT).
  - `supabase/migrations/20251216203053_...sql:246` (messages SELECT).
- Views:
  - `supabase/migrations/20251216203053_...sql:141` (`v_messages_feed`).
  - `supabase/migrations/20251216203053_...sql:155` (`v_group_overview`).
- Gestão de papéis no frontend:
  - `src/pages/Users.tsx:144` (listar organizações e grupos para atribuição).
  - `src/pages/Users.tsx:202` (mutação de criação de papel em `user_roles`).
  - `src/pages/Users.tsx:667` (UI de "Permissão inicial").
  - `src/pages/Users.tsx:705` (checkbox "Gestor de Organização").
  - `src/pages/Users.tsx:754` (payload com `assign_org_admin`).
  - `src/pages/Users.tsx:311` (notificação de sucesso com verificação de `assigned_org_admin`).
 - Edge Function de criação:
  - `supabase/functions/admin-create-user/index.ts:136` (atribuição `ORG_ADMIN`).
  - `supabase/functions/admin-create-user/index.ts:148` (verificação `can_edit_org`).
  - `supabase/functions/admin-create-user/index.ts:149` (verificação `has_org_access`).
  - `supabase/functions/admin-create-user/index.ts:154` (evento `ORG_ADMIN_ASSIGNED`).
