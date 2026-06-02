# Guidelines: infra

## Sobre

Documentação estável da área `infra` do space `empresa`.

Esta área concentra playbooks e padrões para operar infraestrutura externa da empresa com segurança, especialmente painéis administrativos e APIs sensíveis.

## Herança

Herda de `spaces/empresa/guidelines/`.

## Documentos

| Documento | Descrição |
|---|---|
| `operacao-cpanel.md` | Padrões para operar cPanel com token em Keychain, uso de API e fallback pela interface |

## Como Usar

1. Registre aqui procedimentos estáveis da área.
2. Não armazene secrets em arquivos versionados.
3. Prefira Keychain, variáveis de ambiente locais ou o gerenciador de segredos do sistema.
