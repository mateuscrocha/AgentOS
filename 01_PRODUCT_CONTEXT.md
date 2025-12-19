# Admin do Bóris (v2) — 01_PRODUCT_CONTEXT

## Contexto
- O Bóris atua em grupos de WhatsApp.
- Coleta mensagens e participantes via Z-API.
- Encaminha eventos para n8n.
- n8n persiste dados no Supabase.
- O Admin é painel web de leitura estratégica e configuração.
- Foco: visualização de dados, métricas, padrões de conversa, administração de organizações e grupos.
- Sem envio de mensagens. Sem alterações diretas em grupos.

## O que este documento define
- Escopo de produto do Admin v2.
- Objetivos do produto.
- Usuários e uso típico por papéis.
- Fluxos principais de navegação e leitura.
- Fronteiras com Z-API, n8n e Supabase.
- Áreas do produto mapeadas para páginas existentes.

## Regras que NÃO podem ser quebradas
- Hierarquia fixa: System → Organization → Group.
- Mensagens e membros sempre pertencem a um `Group`.
- Não existem mensagens fora de grupo.
- Não existem membros fora de grupo.
- Admin é leitura estratégica + configuração.
- Sem interação direta com WhatsApp.
- Decisões de stack estão fechadas: Supabase, RLS, n8n, Z-API.
- Onboarding público substitui signup clássico.

## Decisões já tomadas
- Pipeline de dados: Z-API → n8n → Supabase.
- Persistência e segurança: Supabase com RLS.
- Orquestração: n8n como integração central.
- Provedor de WhatsApp: Z-API (atual).
- Papéis de acesso:
  - `SYSTEM_ADMIN`: visão do sistema, todas as organizações e grupos.
  - `ORG_ADMIN`: visão completa da sua organização e grupos associados.
  - `GROUP_MANAGER`: visão dos grupos sob gestão, com métricas e leitura.
  - `READ_ONLY`: visualização apenas, sem ações administrativas.
- Onboarding cria `User`, `Organization`, `Group` e vínculos automaticamente.
- Redirecionamento pós-onboarding para a página do grupo.

## O que não é responsabilidade deste escopo
- Envio de mensagens no WhatsApp.
- Moderação ativa de conversas.
- Alterações diretas em grupos pelo Admin.
- Propor mudanças de arquitetura.
- Desenhar UI, temas ou microinterações.
- Implementar automações no n8n.

## Referências no código (paths quando fizer sentido)
- Navegação e layout:
  - `src/components/layout/AdminLayout.tsx`
  - `src/components/layout/AdminHeader.tsx`
  - `src/components/layout/AdminSidebar.tsx`
  - `src/components/layout/PublicLayout.tsx`
- Páginas por nível:
  - `src/pages/System.tsx` (nível System)
  - `src/pages/Org.tsx` (nível Organization)
  - `src/pages/Group.tsx` (nível Group)
- Dados de grupos, membros e mensagens:
  - `src/pages/GroupMembers.tsx`
  - `src/pages/GroupMessages.tsx`
  - `src/pages/GroupEvents.tsx`
  - `src/components/group-dashboard/` (seções de visão e métricas)
- Métricas e visualizações:
  - `src/components/dashboard/StatsCard.tsx`
  - `src/components/group-dashboard/KpiCard.tsx`
  - `src/components/group-dashboard/InsightCard.tsx`
  - `src/components/group-dashboard/SummarySection.tsx`
- Autenticação e papéis:
  - `src/hooks/use-auth.ts`
  - `src/hooks/use-user-roles.ts`
  - `src/components/auth/AuthGuard.tsx`
- Integrações e dados:
  - `src/integrations/supabase/client.ts`
  - `src/integrations/supabase/types.ts`
  - `supabase/functions/validate-whatsapp-group/index.ts`
  - `supabase/functions/provision-onboarding/index.ts`
  - `supabase/functions/provision-group/index.ts`
  - `supabase/migrations/`

