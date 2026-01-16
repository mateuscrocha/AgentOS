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

### TEST_BASE_URL

`TEST_BASE_URL` define a URL base usada pelos testes das Edge Functions (Deno) para construir URLs de request e para preencher `SUPABASE_URL` quando necessário.

Se não estiver definida, os testes tentam usar `SUPABASE_URL`, `VITE_SUPABASE_URL` e `VITE_APP_URL`. Como fallback final, usam `http://127.0.0.1:8080`.

### TEST_WEBHOOK_URL

`TEST_WEBHOOK_URL` permite sobrescrever, nos testes, a URL do webhook (ex.: N8N). Se não estiver definida, os testes usam `http://127.0.0.1:9999/webhook` como valor padrão.

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
