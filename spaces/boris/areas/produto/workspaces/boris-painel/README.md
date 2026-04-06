# Boris Painel

Aplicacao principal do produto Boris dentro do AgentOS.

Este workspace concentra:

- frontend web do painel
- Edge Functions e configuracao Supabase ligadas ao produto
- testes de interface e fluxos E2E
- documentacao tecnica local do app

## Contexto no AgentOS

Este repositorio foi importado para:

`spaces/boris/areas/produto/workspaces/boris-painel/`

Este workspace agora e a origem principal de operacao do Boris Painel dentro do AgentOS.

Camadas de responsabilidade:

- codigo executavel do produto: este workspace
- contexto operacional e guidelines de produto: `spaces/boris/areas/produto/`
- acervo editorial, campanhas e materiais Boris: `spaces/boris/resources/`

## Documentacao principal

- `00_README.md`: ponto de entrada da documentacao funcional do admin
- `01_PRODUCT_CONTEXT.md`: contexto de produto
- `02_DOMAIN_MODEL.md`: modelo de dominio
- `03_ACCESS_CONTROL.md`: papeis e acesso
- `04_ONBOARDING_FLOW.md`: fluxo de onboarding
- `07_KPIS_AND_DASHBOARDS.md`: metricas e dashboards

## Stack

- Vite
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Supabase
- Playwright
- Vitest

## Desenvolvimento local

Requisitos:

- Node.js instalado
- dependencias instaladas com `npm install`

Comandos principais:

```sh
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

Para screenshots com Playwright:

```sh
npx playwright install chromium
npm run test:screenshot
```

## Variaveis de ambiente

Use `.env.example` como base para o ambiente local.

Preencha por contexto:

Frontend build:

- `VITE_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PRICE_ID_DEFAULT`

Edge Functions e backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `ZAPI_BASE_URL`
- `ZAPI_INSTANCE`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN`
- `MATEUS_PHONE` ou `MATEUS_PHONE_E164`
- `GROUP_AI_CRON_API_KEY`
- `OPENAI_API_KEY`

Testes locais:

- `TEST_BASE_URL`
- `TEST_WEBHOOK_URL`
- `TEST_EMAIL`
- `TEST_PASSWORD`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_PORT`

## Observacoes de operacao

- o workspace possui configuracao local em `.codex/config.toml` para integracao com Supabase MCP
- secrets devem permanecer fora do repositorio
- artefatos gerados como `dist/`, `playwright-report/` e `test-results/` nao devem ser versionados
