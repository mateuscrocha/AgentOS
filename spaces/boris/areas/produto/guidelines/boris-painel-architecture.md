# Arquitetura Atual do Boris Painel

## Resumo

O `boris-painel` ja entrou no AgentOS como um workspace de produto valido e funcional.

A base atual tem tres blocos bem definidos:

- frontend React em `src/`
- backend de Edge Functions em `supabase/functions/`
- documentacao tecnica local do app na raiz do workspace

Isso significa que o painel nao entrou como legado caotico. Ele entrou como produto real, com alguns sinais de crescimento incremental que agora podem ser organizados com mais criterio.

## Estrutura Saudavel

### Frontend

- `src/components/` esta organizado por dominio visual e por superfícies do produto
- `src/hooks/` concentra a maior parte da leitura e derivacao de dados
- `src/integrations/supabase/` isola a integracao principal de dados
- `src/design-system/` ja indica intencao de sistematizar UI, tokens e documentacao visual

### Backend

- `supabase/functions/` separa bem capacidades administrativas, billing, onboarding, ingestao de eventos e IA de grupos
- `supabase/functions/_shared/` concentra utilitarios que reduzem duplicacao entre funcoes
- existe cobertura de testes para partes relevantes das Edge Functions

### Operacao

- o app tem `Playwright`, `Vitest`, `.env.example`, `Dockerfile` e README local
- a aplicacao tolera falha de configuracao do Supabase no build e explicita o erro no frontend

## Sinais de Legado Importado

### Naming e identidade historica

- `FREEZE.md` ainda fala em `Admin V4`
- `src/App.tsx` abre com comentario de `Admin V4 - Core Frozen`
- parte da documentacao ainda usa a linguagem de `Admin` em vez de `Boris Painel`

Isso sugere que a base cresceu sobre uma fase anterior do produto e ainda nao foi renomeada por completo.

### Rotas e aliases acumulados

- o router em `src/App.tsx` concentra muitas rotas, redirects legados e aliases
- coexistem caminhos como `/system`, `/organization/:orgId`, `/groups/:groupId`, `/group/:groupId/*` e `/org/:orgId/*`

Isso funciona, mas hoje mistura compatibilidade historica com estrutura canonica.

### Superficies de desenvolvimento misturadas ao app principal

- `src/pages/DevTestUsers.tsx`
- `src/pages/CRMScreenshotSandbox.tsx`

Essas paginas sao uteis, mas aparecem dentro da arvore principal do produto. Isso aumenta ruido conceitual e dificulta entender o que e superficie de producao vs ferramenta interna.

### Dominio espalhado entre paginas e hooks

- `src/pages/` esta grande e mistura telas de sistema, organizacao, grupo, conta, onboarding, testes e sandboxes
- `use-group-dashboard.ts` concentra orquestracao pesada de queries, realtime, invalidacao e derivacoes

Aqui a base ainda parece funcional, mas com risco de virar gargalo de manutencao.

## Leitura Arquitetural

Hoje o painel parece seguir este desenho:

1. `src/App.tsx` concentra roteamento e compatibilidade historica
2. paginas fazem composicao de telas e fluxo
3. hooks carregam regra de leitura, agregacao e sincronizacao
4. Supabase e o backend operacional principal
5. Edge Functions expandem onboarding, billing, ingestao e automacao de IA

Esse desenho e aceitavel para o tamanho atual do produto, mas ja pede uma segunda camada de organizacao por dominio.

## Prioridades de Organizacao

### Prioridade 1

Separar claramente o que e superficie de producao do que e sandbox, fixture ou ferramental interno.

Direcao recomendada:

- mover paginas de sandbox para uma area explicitamente interna
- considerar um prefixo ou pasta `internal/`, `labs/` ou `dev/` fora da arvore principal de produto

### Prioridade 2

Formalizar a arquitetura canonica de rotas.

Direcao recomendada:

- declarar quais paths sao canonicos
- manter redirects legados apenas como camada de compatibilidade
- documentar prazo ou criterio para aposentadoria de aliases antigos

### Prioridade 3

Reduzir arquivos de orquestracao pesada no frontend.

Direcao recomendada:

- quebrar `use-group-dashboard.ts` em modulos mais explicitamente orientados a dominio
- separar fetch, realtime, invalidacao e derivacao computacional

### Prioridade 4

Completar o rebranding tecnico de `Admin` para `Boris Painel` onde isso ja nao fizer mais sentido historico.

Direcao recomendada:

- revisar `FREEZE.md`
- revisar comentarios de topo e textos de documentacao tecnica
- manter nomes antigos apenas quando forem referencia historica deliberada

## Decisao Atual

No estado atual, o painel ja pode ser tratado como o workspace oficial do produto Boris.

As proximas limpezas devem focar em:

- clareza arquitetural
- naming consistente
- isolamento de superficies de desenvolvimento
- modularizacao progressiva por dominio

Nao ha sinal de que seja necessario reestruturar tudo agora.
O movimento correto e consolidar a base atual e limpar incrementalmente os pontos de atrito.
