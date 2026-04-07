---
name: send-personal-whatsapp
description: Opera o WhatsApp pessoal de Mateus com estrutura local do AgentOS, usando o perfil padrão pessoal e a workspace evolution-api-agent interna
agent: whatsapp-manager
project: pessoal
version: 1.0
created: 2026-04-06
---

# Skill: send-personal-whatsapp

## O que esta skill faz

Padroniza como o AgentOS deve operar o WhatsApp pessoal de Mateus usando apenas estrutura local do próprio AgentOS, com o perfil `pessoal` como padrão e a workspace `evolution-api-agent` como base técnica.

## Quando usar

- quando o usuário pedir para enviar mensagem pelo WhatsApp pessoal
- quando for preciso checar ou mencionar a instância pessoal da Evolution API
- quando outra parte do AgentOS precisar saber qual skill usar para esse canal

## Processo

1. Assumir `pessoal` como perfil padrão, salvo instrução contrária explícita.
2. Para envio real, executar os comandos a partir da workspace local `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent`.
3. Para texto por número, preferir `npm start -- request POST /message/sendText/{instance} ...`, que já foi validado nesta instalação.
4. Para buscas por nome, usar o cache local com `find-contact` e depois enviar com o comando correspondente.
5. Se a tarefa exigir troubleshooting, consultar os arquivos `package.json`, `.env.example` e `src/` dessa workspace local.
6. Informar de volta qual perfil foi usado, o destino e o resultado da operação.

## Inputs

- `$ARGUMENTS`: destino, texto, mídia opcional, intenção da ação e qualquer detalhe sobre perfil ou workspace

## Outputs

Resumo operacional com:
- perfil utilizado
- destino
- tipo de ação
- resultado da operação
- referência de workspace quando houver diagnóstico

## Regras

1. O perfil padrão deste fluxo é `pessoal`.
2. `boris_suporte` só entra se o pedido mencionar Boris ou suporte explicitamente.
3. Para envios comuns, priorizar o comando direto validado da workspace local.
4. A workspace `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent` é a fonte de verdade técnica da integração.
