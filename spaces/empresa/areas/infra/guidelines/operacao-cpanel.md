# Operação de cPanel

## Princípios

- O token da API do cPanel não deve ser salvo em arquivos do repositório.
- O padrão desta área é usar o **Keychain do macOS** para armazenar:
  - URL base do cPanel
  - username
  - token
- O agente `cpanel-operator` deve preferir **API** para tarefas reproduzíveis e auditáveis.
- Quando a API não cobrir a ação, o agente pode usar a interface web com Browser ou Computer Use.

## Perfis

Cada ambiente deve usar um perfil explícito, por exemplo:

- `principal`
- `staging`
- `cliente-x`

## Itens salvos no Keychain

Para cada perfil, a skill salva:

- `agentos-cpanel-base-url`
- `agentos-cpanel-username`
- `agentos-cpanel-token`

## Regra de segurança

- Nunca imprimir o token em respostas ao usuário.
- Nunca commitar o token em `.env`, `.md`, `.json`, scripts ou notas.
- Qualquer ação destrutiva ou de escrita deve ser confirmada pelo usuário antes de executar.
