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

