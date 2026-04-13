# Workspace: Boris Site

## Papel

`spaces/boris/areas/produto/workspaces/boris-site/` é o workspace oficial do site do Bóris dentro do AgentOS.

Ele concentra:

- código do site institucional e comercial
- páginas públicas de posicionamento, manifesto e campanhas
- superfícies de captação, CTA e encaminhamento para WhatsApp, CRM ou trial
- integrações técnicas próprias do site, como analytics, SEO e backend auxiliar quando existir

## Regra de organização

- `guidelines/` e `memory/` da área `produto` continuam sendo a camada de decisão, contexto operacional e governança
- `workspaces/boris-site/` é a camada executável do site
- `workspaces/boris-painel/` continua sendo a camada executável do produto autenticado e operacional
- materiais de marca, conteúdo, mídia e acervo compartilhado continuam em `spaces/boris/resources/`

## Operação

- o workspace oficial dentro do AgentOS é um `git submodule` apontando para `https://github.com/mateuscrocha/euboris.git`
- alterações no site devem acontecer dentro do workspace
- os commits do site pertencem ao repositório próprio do site
- documentação estável de posicionamento, arquitetura, operação, fluxos de captação e fronteiras com o painel deve ser promovida para `guidelines/` quando deixar de ser detalhe de implementação

## Fronteiras

- o site responde por aquisição, narrativa pública, manifesto, páginas institucionais, landing pages e superfícies abertas
- o painel responde por onboarding autenticado, operação do produto, CRM operacional, billing e gestão de clientes
- o site pode encaminhar para o painel, mas não substitui o app principal

## Limites

- não usar o workspace do site como depósito geral de arquivos do Bóris
- não mover memória do space ou da área para dentro do site
- manter secrets fora do repositório e seguir o padrão de variáveis do próprio projeto
