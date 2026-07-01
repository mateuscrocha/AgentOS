# Diagnóstico de Prontidão Jurídico-Operacional do Bóris

**Data:** 2026-07-01  
**Agente:** `launch-compliance-manager`  
**Escopo avaliado:** `boris-site` e `boris-painel`

## Resumo Executivo

O Bóris já tem base técnica suficiente para operar com alguma disciplina de acesso no painel, mas **ainda não está pronto para go-live sem ajustes jurídicos e operacionais mínimos**.

Hoje, os principais riscos não estão em "falta de tecnologia", e sim em:

- ausência de documentos públicos obrigatórios ou quase obrigatórios para o estágio atual
- falta de transparência explícita sobre tratamento de dados no site e no painel
- ausência visível de canal do titular e fluxo de incidente
- presença de superfícies históricas de coleta pública com políticas excessivamente abertas
- falta de matriz prática de retenção, descarte e revisão de terceiros

## Classificação Geral

- **Go-live jurídico hoje:** `não recomendado sem ajustes mínimos`
- **Risco predominante:** `alto`
- **Tipo de risco:** transparência, governança, coleta pública, retenção e terceiros

## O que o Bóris trata hoje

### Site (`boris-site`)

Indícios atuais de tratamento:

- navegação e pageviews com Plausible em [index.html](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/index.html:23)
- eventos customizados de analytics em [analytics.ts](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/lib/analytics.ts:1) e [App.tsx](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/App.tsx:18)
- formulário de qualificação que hoje envia contexto para WhatsApp e captura:
  - nome
  - papel
  - tema/contexto do grupo ou oferta
  - tamanho de grupos
  - nível de engajamento
  - link do grupo
  - WhatsApp
  em [QualificationFormModal.tsx](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/components/boris/QualificationFormModal.tsx:1)
- migrations históricas com coleta pública em Supabase para:
  - `qualification_leads`
  - `labs_applications`

### Painel (`boris-painel`)

Indícios atuais de tratamento:

- autenticação de usuários e sessão em [use-auth.ts](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/src/hooks/use-auth.ts:1)
- dados de perfil:
  - nome
  - telefone em formato E.164
  - status
  - metadata
- dados de organização:
  - nome
  - contato
  - e-mail
  - telefone
  - billing
  - Stripe IDs
- dados de grupos:
  - nome
  - `invite_link`
  - `provider_phone`
  - ids de provedor
- dados de membros:
  - nome
  - `phone_e164`
  - foto
  - identificadores do provedor
- dados de mensagens:
  - texto/conteúdo
  - telefone do remetente
  - nome do remetente
  - mídia
  - metadata
  - `raw_provider`
- resumos e tópicos derivados de mensagens

Esses campos aparecem no schema tipado em [types.ts](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/src/integrations/supabase/types.ts:2080), [types.ts](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/src/integrations/supabase/types.ts:2270) e [types.ts](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/src/integrations/supabase/types.ts:2628).

## Achados por prioridade

### Bloqueadores de lançamento

1. **Não encontrei política de privacidade pública versionada do Bóris.**
   Sem isso, o site e o painel operam coleta e tratamento sem camada mínima de transparência institucional.

2. **Não encontrei termos de uso públicos do Bóris.**
   O produto tem superfície pública, CTA comercial e fluxo autenticado suficiente para exigir enquadramento contratual básico.

3. **Não encontrei canal claro do titular nem rotina formal de atendimento a direitos LGPD.**
   O Bóris precisa conseguir receber e responder solicitações de acesso, correção, exclusão e informação sobre compartilhamento.

4. **Não encontrei fluxo mínimo documentado de incidente de segurança.**
   Isso é crítico porque o painel trata conteúdo de mensagens, telefone de participantes e dados operacionais de grupos.

### Alto

1. **O site carrega analytics Plausible sem página pública de privacidade nem aviso claro sobre medição.**
   Referências em [index.html](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/index.html:23) e [App.tsx](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/App.tsx:26).

2. **Há histórico de coleta pública excessivamente aberta no `boris-site` para `labs_applications`.**
   As migrations permitem:
   - leitura pública anônima em [20260312133602_d07da69a-5762-4b6f-94b7-5e8a07f29fe2.sql](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/supabase/migrations/20260312133602_d07da69a-5762-4b6f-94b7-5e8a07f29fe2.sql:29)
   - update público de `archived` em [20260312134620_c1ea44f4-7861-4a5f-a41b-0a19a6e26504.sql](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/supabase/migrations/20260312134620_c1ea44f4-7861-4a5f-a41b-0a19a6e26504.sql:4)

   Isso é grave porque a tabela de labs guarda dados como:
   - cidade
   - idade
   - LinkedIn
   - GitHub
   - situação financeira
   - disponibilidade
   - experiência
   - motivação
   - WhatsApp
   - Instagram

3. **O painel trata conteúdo de mensagens de WhatsApp e dados de participantes, mas não há documentação visível de retenção, descarte e base operacional por fluxo.**

4. **O onboarding público provisiona organização, grupo, contato, telefone, link de grupo e participantes.**
   Isso aparece em [public_onboarding_provision_tx_v2](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/supabase/migrations/20251231124000_public_onboarding_tx_member_link.sql:1).  
   É funcional, mas precisa de enquadramento explícito:
   - o que o lead autoriza ao enviar
   - se ele pode informar participantes
   - qual é o papel do Bóris nessa entrada
   - como isso será retido e validado

### Médio

1. **`qualification_leads` existe no schema do site, embora o fluxo atual pareça pular gravação e seguir direto para WhatsApp.**
   Ver [20260312210618_554e6d69-be0e-4070-951b-0d03bcd940a4.sql](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/supabase/migrations/20260312210618_554e6d69-be0e-4070-951b-0d03bcd940a4.sql:1) e [QualificationFormModal.tsx](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/components/boris/QualificationFormModal.tsx:124).  
   Se não for mais usado, o ideal é remover ou congelar oficialmente.

2. **O marketing do site fala em “privacidade preservada”, mas hoje não há material jurídico público sustentando essa promessa.**
   Exemplo em [ParaAdministradoresDeGrupos.tsx](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-site/src/pages/ParaAdministradoresDeGrupos.tsx:99).

3. **Não vi matriz explícita de terceiros operadores.**
   Pelos workspaces, o mínimo a revisar inclui:
   - Supabase
   - Plausible hospedado em domínio próprio
   - Stripe
   - provedores de WhatsApp mencionados em env/migrations
   - MinIO/S3, se houver armazenamento de mídia

### Baixo ou positivo

1. **O painel parece ter endurecido as policies de acesso depois da fase inicial.**
   Hoje há recorte por `has_group_access` e `is_system_admin` para grupos, membros e mensagens em [20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/supabase/migrations/20251216203053_90e174c6-bed4-42e3-a4db-c5100aa7030b.sql:173).  
   Isso não resolve LGPD sozinho, mas é um sinal técnico saudável.

2. **As tabelas de resumo diário parecem restritas a usuários autenticados com acesso ao grupo.**
   Ver [20260112143000_group_daily_summaries_and_global_daily_topics.sql](/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel/supabase/migrations/20260112143000_group_daily_summaries_and_global_daily_topics.sql:17).

## O que precisa existir antes do go-live

### Documentos públicos

- política de privacidade do Bóris
- termos de uso do Bóris
- texto curto de cookies/medição, se o site mantiver analytics

### Controles internos mínimos

- canal do titular: `eu@rochamateus.com.br`
- responsável interno por triagem de pedidos e incidentes
- procedimento curto de incidente:
  - detectar
  - conter
  - avaliar risco
  - decidir comunicação à ANPD e aos titulares
- inventário mínimo de terceiros operadores
- matriz de retenção e descarte

### Decisões de produto/operação

- o que o site coleta de fato hoje
- o que o painel coleta de fato hoje
- o que é necessário para operar
- o que é legado e pode ser removido
- como o Bóris se posiciona por fluxo: controlador, operador ou arranjo híbrido

## Backlog recomendado

### Antes do go-live

1. Publicar política de privacidade.
2. Publicar termos de uso.
3. Criar canal do titular e colocar no site/painel.
4. Definir fluxo mínimo de incidente.
5. Revisar ou desativar imediatamente qualquer superfície pública de leitura/update anônimo de `labs_applications`.
6. Revisar a promessa pública de “privacidade preservada” para alinhá-la à operação real.
7. Listar terceiros e dados compartilhados por terceiro.

### D+30

1. Criar registro interno resumido de operações de tratamento.
2. Definir retenção para:
   - leads
   - contatos de organização
   - participantes
   - mensagens
   - resumos
   - dados de onboarding
3. Revisar o fluxo de onboarding público sob ótica de autorização e minimização.
4. Revisar contratos e DPAs com operadores prioritários.

### D+60

1. Revisar textos com advogado especialista em proteção de dados.
2. Criar rotina de resposta a pedidos do titular com SLA interno.
3. Revisar base legal por fluxo com mais rigor.
4. Reavaliar necessidades de armazenamento de `raw_provider`, conteúdo e telefones.

## Pontos que precisam de revisão jurídica especializada

- compartilhamento e uso de dados em grupos de WhatsApp de terceiros
- modelo patrocinado com promessa de privacidade para membros e administradores
- onboarding com `invite_link` e lista de participantes
- retenção de conteúdo de mensagens e resumos
- papel do Bóris como controlador ou operador em cada fluxo relevante

## Conclusão

O Bóris está perto de uma **conformidade mínima séria**, mas ainda falta fechar a camada mais básica de transparência e governança.

Se eu tivesse que resumir em uma frase:

> o maior risco hoje não é “a tecnologia estar solta”, e sim o produto já tratar dados relevantes sem os documentos, canais e rituais mínimos de proteção e prestação de contas.
