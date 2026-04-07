# AgentOS — Kernel (Codex Runtime)

> **INSTRUÇÃO OBRIGATÓRIA:** Antes de qualquer ação, leia o arquivo `KERNEL.md` na raiz do projeto. Ele contém todas as regras do kernel — arquitetura, agentes do sistema, comandos, protocolos, roteamento, memória e namespace. As instruções abaixo são **COMPLEMENTARES** ao KERNEL.md e NÃO o substituem.

---

## Detalhes Específicos do Codex

- **Invocação de subagente**: Use o **Agent tool** para invocar agentes definidos em `.Codex/agents/`
- **Diretório de runtime**: `.Codex/`
- **Namespace de agentes**:
  - Sistema: `.Codex/agents/{nome}.md`
  - Agente de area: `.Codex/agents/{space}--{area}--{agente}.md`
  - Agente de team: `.Codex/agents/{space}--{area}--{team}--{agente}.md`
- **Comandos**: Implementados como slash commands em `.Codex/commands/`
- **Interop**: O diretório `.gemini/agents/` espelha a mesma estrutura para o Gemini CLI. Ao criar agentes, o sistema faz **dual-write** em ambos os diretórios.

## Idioma e Grafia Oficiais

- A língua oficial deste AgentOS é **português do Brasil**.
- Use grafia brasileira correta, com acentos, cedilha, til, crase e pontuação apropriada sempre que couber.
- Não simplifique português para ASCII quando estiver escrevendo para o usuário, produzindo mensagens, documentos, notas comerciais ou textos operacionais.
- A grafia oficial do produto é **Bóris**, com acento agudo no `ó`.
- Sempre preserve nomes, marcas e termos internos com a grafia oficial correta.

---

## Hooks de Enforcement

O sistema possui hooks automáticos configurados em `.Codex/settings.json` que **enforcam os protocolos**:

| Hook | Evento | Comportamento |
|---|---|---|
| **Guardrails** | `PreToolUse` (Write/Edit) | **Bloqueia** writes em: `system/protocols/`, `system/scripts/`, `system/agents/*/AGENT.md`, `system/skills/*/SKILL.md`, `.Codex/settings.json`, arquivos de secrets (`.env`, `*.key`, `*.pem`) |
| **Enforcement** | `PostToolUse` (Write/Edit) | **Warn** — rastreia mudanças estruturais e checklist de manutenção |
| **Validation** | `Stop` | **Warn** — verifica se o checklist de manutenção foi cumprido ao final da sessão |

Scripts em `system/scripts/hooks/`. Caminhos em `system/` que **são** editáveis: `system/memory/*.md`, `system/agents/*/memory/*.md`.

---

## WhatsApp Pessoal via Evolution API

- O AgentOS deve tratar o **WhatsApp pessoal** de Mateus como uma capacidade operacional oficial do sistema.
- Sempre que uma tarefa envolver **enviar mensagem, checar instância, consultar contatos ou operar o WhatsApp pessoal**, priorize o agente `whatsapp-manager` e a skill local `send-personal-whatsapp`.
- Perfil padrão: `pessoal`.
- Workspace de referência: `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent/`.
- Comando preferencial para envios: `npm start -- request POST /message/sendText/{instance} ...` executado em `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent/`.
- A instância `boris_suporte` só deve ser usada quando o pedido for explicitamente ligado ao Boris ou suporte.
- Sempre que o usuário pedir **uma mensagem de WhatsApp para revisar ou enviar**, a resposta deve trazer o texto da mensagem dentro de **bloco de código**, preservando claramente quebras de linha, formatação e versão final pronta para uso.

---

## Sync de Runtimes

O hook PostToolUse detecta automaticamente mudanças em `KERNEL.md`, `.Codex/agents/` e `.Codex/commands/` e emite avisos de sync pendente. Para verificar/corrigir manualmente:

```bash
python3.14 system/scripts/sync.py        # Relatório
python3.14 system/scripts/sync.py --fix  # Corrige automaticamente
```

Detalhes em `system/protocols/sync.md`.
