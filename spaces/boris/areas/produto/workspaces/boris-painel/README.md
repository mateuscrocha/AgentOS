# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Variáveis de ambiente

Em desenvolvimento local, variáveis podem ficar no `.env`. Em produção, elas precisam existir no ambiente onde o build é gerado e/ou onde o código server-side roda (por exemplo, Edge Functions/Functions). O `.env` local é usado pelo Vite para variáveis `VITE_*`.

O arquivo `.env` já está no `.gitignore`.

## Screenshots e testes E2E

O projeto já usa `Playwright` para automação de navegador. Para screenshots de páginas e testes end-to-end, prefira essa stack em vez de adicionar `Puppeteer` ou `Selenium`.

Fluxo recomendado:

```sh
# instalar navegadores do Playwright (uma vez)
npx playwright install chromium

# rodar o teste-exemplo que abre a tela pública de login e salva screenshot
npm run test:screenshot

# rodar toda a suíte E2E
npm run test:e2e
```

Por padrão, a suíte sobe o frontend em `http://127.0.0.1:4173`. Se você quiser apontar para outro ambiente já rodando, defina `PLAYWRIGHT_BASE_URL`.

Os artefatos ficam em `test-results/` e o relatório HTML em `playwright-report/`.

### VITE_APP_URL

`VITE_APP_URL` define a URL base usada no frontend para construir URLs absolutas (por exemplo, redirecionamentos de autenticação). Se não estiver definida, o sistema usa `window.location.origin`. Se isso não estiver disponível, o sistema lança erro.

Exemplo (desenvolvimento local):

```sh
VITE_APP_URL="http://127.0.0.1:8080"
```

Exemplo (produção):

```sh
VITE_APP_URL="https://admin.seudominio.com"
```

### VITE_SUPABASE_URL

`VITE_SUPABASE_URL` define a URL do projeto Supabase usada no frontend (por exemplo, para invocar Edge Functions em `/functions/v1`).

Exemplo (desenvolvimento local):

```sh
VITE_SUPABASE_URL="http://127.0.0.1:8080"
```

Exemplo (produção):

```sh
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
```

### SUPABASE_ANON_KEY

`SUPABASE_ANON_KEY` é usada nas Edge Functions que precisam validar a sessão autenticada recebida pelo header `Authorization`.

No onboarding público, `provision-onboarding` agora aceita apenas chamadas autenticadas. O frontend cria o usuário com `signUp` e a conclusão do provisionamento acontece com a própria sessão do Supabase.

### ZAPI_BASE_URL

`ZAPI_BASE_URL` permite sobrescrever a URL base da Z-API usada pelas Edge Functions. Quando ausente, o backend usa `https://api.z-api.io`.

### ZAPI_INSTANCE

`ZAPI_INSTANCE` define o identificador da instância da Z-API usado para envios.

### ZAPI_TOKEN

`ZAPI_TOKEN` define o token da instância da Z-API usado para envios.

### ZAPI_CLIENT_TOKEN

`ZAPI_CLIENT_TOKEN` define o `Client-Token` enviado nas chamadas de envio para a Z-API.

### MATEUS_PHONE

`MATEUS_PHONE` define o número de destino usado pelo listener migrado para encaminhar payloads que chegarem fora de contexto de grupo, preservando o comportamento legado do n8n. Também aceita `MATEUS_PHONE_E164`.

### TEST_BASE_URL

`TEST_BASE_URL` define a URL base usada pelos testes das Edge Functions (Deno) para construir URLs de request e para preencher `SUPABASE_URL` quando necessário.

Se não estiver definida, os testes tentam usar `SUPABASE_URL`, `VITE_SUPABASE_URL` e `VITE_APP_URL`. Como fallback final, usam `http://127.0.0.1:8080`.

### TEST_WEBHOOK_URL

`TEST_WEBHOOK_URL` permite sobrescrever, nos testes, a URL de um webhook HTTP auxiliar. Se não estiver definida, os testes usam `http://127.0.0.1:9999/webhook` como valor padrão.

## Checklist do onboarding público

Para o cadastro público funcionar de ponta a ponta, confirme estes itens no ambiente:

- `VITE_APP_URL` aponta para a URL pública correta do frontend.
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY` estão presentes no build.
- `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão definidos na Edge Function `provision-onboarding`.
- `ZAPI_INSTANCE`, `ZAPI_TOKEN` e `ZAPI_CLIENT_TOKEN` estão configurados para a validação do grupo.
- As Redirect URLs do Supabase incluem a URL usada em `VITE_APP_URL` para retorno pós-signup e recuperação de senha.

Fluxo esperado:

1. Usuário acessa `/signup`.
2. O frontend valida o grupo via `validate-whatsapp-group`.
3. O frontend cria a conta via `supabase.auth.signUp`.
4. Se houver sessão imediata, o frontend chama `provision-onboarding`.
5. Se o projeto exigir confirmação de email, o frontend guarda um rascunho local do onboarding e redireciona para `/auth`.
6. No primeiro login válido, o app conclui automaticamente `provision-onboarding` e redireciona para `/groups/:groupId`.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
