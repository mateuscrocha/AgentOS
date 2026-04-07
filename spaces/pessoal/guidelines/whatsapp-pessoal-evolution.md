# WhatsApp Pessoal via Evolution API

## Objetivo

Formalizar o WhatsApp pessoal de Mateus como capacidade operacional estável do AgentOS, evitando ambiguidade entre uso pessoal e uso do Boris.

## Fonte de Verdade

- Skill principal: `send-personal-whatsapp`
- Perfil padrão: `pessoal`
- Workspace operacional: `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent`
- Comando preferencial: `npm start -- request POST /message/sendText/{instance} ...` dentro da workspace local

## Regras

1. Sempre que o pedido envolver o WhatsApp pessoal, assumir `pessoal` como perfil padrão, salvo instrução contrária explícita.
2. Não usar `boris_suporte` para mensagens pessoais.
3. Para envios normais, usar os comandos locais da workspace `evolution-api-agent`, priorizando o endpoint `request` quando o envio precisar ser mais confiável.
4. Se houver necessidade de diagnóstico operacional, consultar primeiro a workspace local `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent`, que concentra a implementação e as variáveis de ambiente.
5. O projeto legado `/Users/eu.rochamateus/Documents/Codex/Evolution API Agent` passa a ser apenas referência histórica e não dependência operacional do AgentOS.

## Casos de Uso

- enviar mensagem pessoal por número
- enviar mensagem pessoal por nome em cache
- disparar mídia pelo perfil pessoal
- checar status da instância pessoal
- localizar onde vive a integração da Evolution API
