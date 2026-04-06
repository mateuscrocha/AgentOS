# Admin do Bóris (v2) — 02_DOMAIN_MODEL

## Contexto
- Modelo conceitual do Admin: System → Organization → Group.
- Mensagens e membros pertencem exclusivamente a um `Group`.
- Usuários (Admin) acessam dados via papéis e RLS.
- Dados vêm do WhatsApp (Z-API) e de webhooks externos, são processados por Edge Functions e persistidos no Supabase.

## O que este documento define
- Entidades do domínio e seus relacionamentos.
- Invariantes e regras de integridade do modelo.
- Mapeamento das entidades para tabelas do Supabase.
- Limites entre participantes de WhatsApp e usuários do Admin.

## Regras que NÃO podem ser quebradas
- Hierarquia fixa: `Organization` contém `Group` (1:N).
- `Message` e `GroupMember` sempre pertencem a um `Group`.
- Não existem mensagens ou membros fora de `Group`.
- IDs são `UUID`. Deleções em cascata seguem a hierarquia.
- O Admin não cria/edita mensagens; leitura estratégica + configuração.

## Decisões já tomadas
- Persistência em Supabase com RLS ativo.
- Enum de papéis: `app_role` e tabela `user_roles` para vínculos.
- Funções de acesso (`has_org_access`, `has_group_access`) dirigem RLS.
- `members` representa participantes do WhatsApp (domínio: `GroupMember`).
- `group_members` representa vínculo administrativo `User ↔ Group` (não WhatsApp).

## O que não é responsabilidade deste escopo
- Descrever UI, flows de tela ou microinterações.
- Detalhar consultas específicas ou views auxiliares.
- Especificar automações externas fora do domínio principal.
- Propor mudanças de arquitetura.

## Entidades e relacionamentos
- `User`
  - Representa o usuário do Admin.
  - Fonte: `auth.users` + `public.profiles`.
  - Controle de acesso: `public.user_roles` com `app_role`.
- `Organization`
  - Unidade lógica de negócio.
  - Contém `Group` (1:N).
- `Group`
  - Agrupador de conversas de WhatsApp.
  - Pertence a uma `Organization` (N:1).
  - Contém `Message` e `GroupMember` (1:N).
- `GroupMember`
  - Participante do grupo de WhatsApp.
  - Sempre vinculado a um `Group` (N:1).
  - Pode ser admin do grupo (campo booleano).
- `Message`
  - Evento de mensagem no grupo de WhatsApp.
  - Sempre vinculado a um `Group` (N:1).
  - Pode referenciar o `GroupMember` remetente (opcional).

## Invariantes e integridade
- `groups.organization_id` obrigatório; deleção em `organizations` remove `groups` (`ON DELETE CASCADE`).
- `members.group_id` obrigatório; deleção em `groups` remove `members` (`ON DELETE CASCADE`).
- `messages.group_id` obrigatório; deleção em `groups` remove `messages` (`ON DELETE CASCADE`).
- `messages.member_id` é opcional; se o membro for removido, o campo é `NULL` (`ON DELETE SET NULL`).
- Índices garantem performance por chaves de vínculo e tempo (`created_at`).

## Mapeamento para Supabase (tabelas)
- `User`
  - `auth.users` (identidade) e `public.profiles` (perfil).
  - Papéis: `public.user_roles` usando `public.app_role`.
- `Organization`
  - `public.organizations`.
- `Group`
  - `public.groups`.
- `GroupMember` (participante WhatsApp)
  - `public.members`.
- `Message`
  - `public.messages`.

## Referências no código (paths quando fizer sentido)
- Definições de tabelas (Supabase migrations):
  - `supabase/migrations/20251216201320_1295a8d0-397a-4222-88b8-418db1eb398b.sql:6` (`public.organizations`)
  - `supabase/migrations/20251216201320_1295a8d0-397a-4222-88b8-418db1eb398b.sql:15` (`public.groups`)
  - `supabase/migrations/20251216201320_1295a8d0-397a-4222-88b8-418db1eb398b.sql:26` (`public.members`)
  - `supabase/migrations/20251216201320_1295a8d0-397a-4222-88b8-418db1eb398b.sql:38` (`public.messages`)
- Papéis e acesso:
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:2` (`public.app_role`)
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:5` (`public.user_roles`)
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:51` (`has_org_access`)
  - `supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:72` (`has_group_access`)
- Tipos gerados (TypeScript):
  - `src/integrations/supabase/types.ts:491` (`organizations` Row)
  - `src/integrations/supabase/types.ts:125` (`groups` Row)
  - `src/integrations/supabase/types.ts:208` (`members` Row)
  - `src/integrations/supabase/types.ts:352` (`messages` Row)
  - `src/integrations/supabase/types.ts:559` (`profiles` Row)
  - `src/integrations/supabase/types.ts:613` (`user_roles` Row)
  - `src/integrations/supabase/types.ts:47` (`group_members` Row — vínculo administrativo)
