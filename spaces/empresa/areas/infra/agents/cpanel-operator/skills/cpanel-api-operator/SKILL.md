---
name: cpanel-api-operator
description: Opera contas cPanel com credenciais locais em .env.local ou token armazenado no Keychain do macOS, preferindo API para leitura e automação e usando a interface web apenas como fallback
agent: cpanel-operator
project: empresa
version: 1.0
created: 2026-05-21
---

# Skill: cpanel-api-operator

## O que esta skill faz

Padroniza como o AgentOS deve operar contas cPanel com segurança:

- lê credenciais de `spaces/empresa/areas/infra/.env.local` quando esse arquivo existir
- guarda perfis no Keychain do macOS
- faz chamadas autenticadas à API do cPanel
- prefere API antes de interface manual
- evita vazar token em arquivo versionado ou saída para o usuário

## Quando usar

- quando o usuário pedir para operar o cPanel
- quando for preciso diagnosticar domínio, e-mail, SSL, arquivos ou configuração hospedada em cPanel
- quando houver necessidade de guardar ou reaproveitar um token de API do cPanel

## Processo

1. Definir ou confirmar um `perfil` de cPanel, como `principal` ou `staging`.
2. Se existir `spaces/empresa/areas/infra/.env.local`, a skill usa esse arquivo como fonte primária local.
3. Se o perfil ainda não existir e você quiser usar Keychain, usar `scripts/store_profile.sh`.
4. Para inspecionar o perfil sem mostrar secrets, usar `scripts/show_profile.sh`.
5. Para chamadas genéricas autenticadas, usar `scripts/cpanel_request.sh`.
6. Para endpoints UAPI, usar `scripts/cpanel_uapi.sh`.
7. Se a ação não for coberta por API ou exigir inspeção visual, usar Browser ou Computer Use com a URL do perfil.
8. Em ações de escrita, mutação ou risco operacional, pedir confirmação explícita antes de executar.

## Arquivo local suportado

Se você quiser operar por `.env.local` durante testes, use:

`spaces/empresa/areas/infra/.env.local`

Com variáveis como:

```env
CPANEL_BASE_URL=https://seu-host:2083
CPANEL_USERNAME=seu-usuario
CPANEL_PASSWORD=sua-senha
CPANEL_API_TOKEN=seu-token
```

O arquivo é local, não versionado, e tem prioridade sobre o Keychain.

## Comandos principais

### Criar ou atualizar um perfil

```bash
spaces/empresa/areas/infra/agents/cpanel-operator/skills/cpanel-api-operator/scripts/store_profile.sh principal https://host.exemplo.com:2083 usuario
```

O script pede o token sem ecoar na tela e salva tudo no Keychain. Se você estiver usando `.env.local`, ele pode nem ser necessário.

### Ver um perfil sem expor o token

```bash
spaces/empresa/areas/infra/agents/cpanel-operator/skills/cpanel-api-operator/scripts/show_profile.sh principal
```

### Fazer uma chamada UAPI

```bash
spaces/empresa/areas/infra/agents/cpanel-operator/skills/cpanel-api-operator/scripts/cpanel_uapi.sh principal Email list_pops
```

### Fazer uma chamada genérica

```bash
spaces/empresa/areas/infra/agents/cpanel-operator/skills/cpanel-api-operator/scripts/cpanel_request.sh principal GET /execute/DomainInfo/list_domains
```

## Inputs

- `$ARGUMENTS`: perfil, objetivo da ação, endpoint desejado, se é leitura ou mutação e qualquer contexto sobre o ambiente

## Outputs

Resumo operacional com:
- perfil usado
- tipo de operação
- endpoint ou área consultada
- resultado ou diagnóstico
- próximos passos sugeridos

## Regras

1. Nunca escrever o token em arquivos versionados do repositório.
2. Nunca imprimir o token em respostas ao usuário.
3. `.env.local` é aceitável para teste local; Keychain continua sendo o padrão mais seguro.
4. Tratar leitura como padrão; mutação só com pedido claro do usuário.
5. Para mudanças destrutivas ou sensíveis, confirmar antes de executar.
