# Admin do Bóris (v2) — 00_README

## Contexto
- O Bóris atua em grupos de WhatsApp.
- Coleta mensagens e participantes via Z-API.
- Envia eventos para n8n.
- n8n persiste no Supabase.
- O Admin é painel web de leitura estratégica e configuração.
- O Admin não envia mensagens nem altera grupos.

## O que este documento define
- Ponto de entrada da documentação oficial do Admin v2.
- Escopo, limites e referências para manutenção.
- Estrutura dos demais documentos (índice):
  - [01_PRODUCT_CONTEXT.md](01_PRODUCT_CONTEXT.md)
  - [02_DOMAIN_MODEL.md](02_DOMAIN_MODEL.md)
  - [03_ACCESS_CONTROL.md](03_ACCESS_CONTROL.md)
  - [04_ONBOARDING_FLOW.md](04_ONBOARDING_FLOW.md)
- Como navegar no código para entender o produto.

## Regras que NÃO podem ser quebradas
- Hierarquia fixa: System → Organization → Group.
- Mensagens e membros sempre pertencem a um `Group`.
- Não existem mensagens fora de grupo.
- Não existem membros fora de grupo.
- Admin é somente leitura estratégica + configuração.
- Sem envio direto de mensagens via Admin.
- Sem alterações diretas em grupos via Admin.
- Decisões de stack estão fechadas: Supabase, RLS, n8n, Z-API.
- Onboarding público substitui signup clássico.

## Decisões já tomadas
- Fluxo de dados: Z-API → n8n → Supabase.
- Persistência e segurança: Supabase com RLS.
- Orquestração: n8n como integração central.
- Provedor de WhatsApp: Z-API (atual).
- Papéis de acesso: `SYSTEM_ADMIN`, `ORG_ADMIN`, `GROUP_MANAGER`, `READ_ONLY`.
- Onboarding cria automaticamente `User`, `Organization`, `Group` e vínculos.
- Pós-onboarding redireciona para a página do grupo.
 - Criação de usuário por Admin: opção de conceder `ORG_ADMIN` ao criar com escopo de organização, com verificação de privilégios e registro de auditoria.

## O que não é responsabilidade deste escopo
- Desenhar UI ou temas.
- Propor mudanças de arquitetura.
- Questionar decisões já definidas.
- Implementar envio ou moderação de mensagens.
- Operar grupos de WhatsApp.
- Detalhar o schema completo do banco (ver documentos específicos quando necessário).

## Referências no código (paths quando fizer sentido)
- Supabase:
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/types.ts`
  - `supabase/migrations/`
  - `supabase/functions/provision-onboarding/index.ts`
  - `supabase/functions/validate-whatsapp-group/index.ts`
  - `supabase/functions/provision-group/index.ts`
- Autenticação e papéis:
  - `src/hooks/use-auth.ts`
  - `src/hooks/use-user-roles.ts`
  - `src/components/auth/AuthGuard.tsx`
- Layout e navegação:
  - `src/components/layout/AdminLayout.tsx`
  - `src/components/layout/AdminHeader.tsx`
  - `src/components/layout/AdminSidebar.tsx`
  - `src/components/layout/PublicLayout.tsx`
- Páginas principais:
  - `src/pages/System.tsx`
  - `src/pages/Org.tsx`
  - `src/pages/Group.tsx`
  - `src/pages/Users.tsx`
  - `src/pages/Onboarding.tsx`
  - `src/pages/OnboardingError.tsx`
  - `src/pages/AccessDenied.tsx`
  - `src/pages/NoAccess.tsx`
  - `src/pages/NotFound.tsx`
- Grupo, membros e mensagens:
  - `src/pages/GroupMembers.tsx`
  - `src/pages/GroupMessages.tsx`
  - `src/pages/GroupEvents.tsx` (atividade via rota direta `/groups/:groupId/events`)
  - `src/components/group-dashboard/`
  - Nota: guia "Primeira leitura do seu grupo" desativado temporariamente (removido em 2026-01-12)
- Métricas e visualizações:
  - `src/components/dashboard/StatsCard.tsx`
  - `src/components/dashboard/RulesCard.tsx`
  - `src/components/group-dashboard/InsightCard.tsx`
  - `src/components/group-dashboard/KpiCard.tsx`
