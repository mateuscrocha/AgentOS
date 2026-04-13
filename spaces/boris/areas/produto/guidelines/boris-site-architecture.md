# Arquitetura Atual do Boris Site

## Resumo

O `boris-site` entrou no AgentOS como o workspace oficial do site institucional e comercial do Bóris.

A base atual indica uma aplicação frontend independente, separada do `boris-painel`, com stack própria e superfícies públicas já definidas.

## Estrutura observada

Hoje o workspace apresenta estes blocos principais:

- frontend React com Vite em `src/`
- roteamento público em `src/App.tsx`
- componentes e hooks utilitários próprios
- assets visuais locais em `src/assets/`
- configuração própria de `supabase/`

## Superfícies atuais

As rotas observadas no momento são:

- `/` para a entrada principal
- `/manifesto` para posicionamento
- `/boris-labs` para a superfície pública de labs
- uma rota administrativa específica de labs, que merece tratamento explícito de governança

## Papel arquitetural

O site deve ser tratado como a camada pública de narrativa, aquisição e experimentação do Bóris.

O desenho recomendado fica assim:

1. `boris-site` concentra site institucional, manifesto, páginas de campanha, SEO, analytics e captação
2. `boris-painel` concentra produto autenticado, operação, CRM, billing e gestão de clientes
3. `spaces/boris/resources/` concentra acervo de marca, conteúdo e materiais compartilhados

## Pontos saudáveis

- stack moderna e já pronta para evolução incremental
- separação física do painel, o que reduz acoplamento indevido
- presença de rotas explícitas, assets organizados e infraestrutura frontend padrão

## Pontos de atenção

### Origem e naming

- o `README.md` ainda está no template padrão do Lovable
- o `package.json` ainda usa naming genérico de scaffold

Isso sugere que o site já é funcional, mas ainda não foi totalmente absorvido como ativo oficial do Bóris.

### Governança de superfícies

- a rota administrativa de labs deve ter papel explícito e critério claro de permanência
- é importante definir o que é público, experimental e interno para evitar mistura conceitual no site

### Integração comercial

- os CTAs do site precisam apontar para destinos canônicos
- a origem dos leads deve ser rastreável para o CRM e para os fluxos de WhatsApp quando aplicável
- qualquer backend auxiliar do site deve ser avaliado à luz do backend principal do ecossistema Boris

## Prioridades recomendadas

### Prioridade 1

Rebranding técnico do workspace para remover sinais de template e reforçar identidade do Bóris.

### Prioridade 2

Formalizar as fronteiras entre páginas públicas, labs experimentais e superfícies internas.

### Prioridade 3

Declarar o fluxo canônico de CTA do site para WhatsApp, CRM, trial ou painel.

### Prioridade 4

Revisar se o `supabase/` do site deve permanecer isolado ou se parte das capacidades deve convergir para a infraestrutura principal do produto.

## Decisão Atual

No estado atual, o `boris-site` já pode ser tratado como workspace oficial do site do Bóris dentro do AgentOS.

O movimento correto agora é consolidar governança, naming e integração com aquisição e produto sem misturar o site com o painel.
