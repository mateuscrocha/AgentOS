# Operação do WhatsApp Pessoal

## Fluxo Padrão

1. Assumir perfil `pessoal` por padrão.
2. Se a tarefa for envio real, usar a skill `send-personal-whatsapp`.
3. Preferir os comandos locais da workspace `evolution-api-agent`; usar `request POST /message/sendText/{instance}` como fallback confiável para texto por número.
4. Se houver falha de cache por nome, usar a workspace local `evolution-api-agent` para sincronizar contatos antes de tentar novamente.
5. Reportar sempre qual perfil foi usado, para quem foi a ação e se a API aceitou ou não.

## Limites

- Não misturar comunicação pessoal com `boris_suporte`.
- Não improvisar chamadas diretas da API para envios usuais.
- Se faltar configuração do perfil pessoal, informar exatamente qual variável ou conexão precisa ser corrigida.

## Workspace de Referência

- `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent`

## Skill de Referência

- `spaces/pessoal/areas/comunicacao/agents/whatsapp-manager/skills/send-personal-whatsapp/SKILL.md`
