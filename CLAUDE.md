# AgentOS — Kernel (Claude Code Runtime)

> **INSTRUÇÃO OBRIGATÓRIA:** Antes de qualquer ação, leia o arquivo `KERNEL.md` na raiz do projeto. Ele contém todas as regras do kernel — arquitetura, agentes do sistema, comandos, protocolos, roteamento, memória e namespace. As instruções abaixo são **COMPLEMENTARES** ao KERNEL.md e NÃO o substituem.

---

## Detalhes Específicos do Claude Code

- **Invocação de subagente**: Use o **Agent tool** para invocar agentes definidos em `.claude/agents/`
- **Diretório de runtime**: `.claude/`
- **Namespace de agentes**:
  - Sistema: `.claude/agents/{nome}.md`
  - Agente de area: `.claude/agents/{space}--{area}--{agente}.md`
  - Agente de team: `.claude/agents/{space}--{area}--{team}--{agente}.md`
- **Comandos**: Implementados como slash commands em `.claude/commands/`
- **Interop**: O diretório `.gemini/agents/` espelha a mesma estrutura para o Gemini CLI. Ao criar agentes, o sistema faz **dual-write** em ambos os diretórios.

---

## Hooks de Enforcement

O sistema possui hooks automáticos configurados em `.claude/settings.json` que **enforcam os protocolos**:

| Hook | Evento | Comportamento |
|---|---|---|
| **Guardrails** | `PreToolUse` (Write/Edit) | **Bloqueia** writes em: `system/protocols/`, `system/scripts/`, `system/agents/*/AGENT.md`, `system/skills/*/SKILL.md`, `.claude/settings.json`, arquivos de secrets (`.env`, `*.key`, `*.pem`) |
| **Enforcement** | `PostToolUse` (Write/Edit) | **Warn** — rastreia mudanças estruturais e checklist de manutenção |
| **Validation** | `Stop` | **Warn** — verifica se o checklist de manutenção foi cumprido ao final da sessão |

Scripts em `system/scripts/hooks/`. Caminhos em `system/` que **são** editáveis: `system/memory/*.md`, `system/agents/*/memory/*.md`.

---

## Sync de Runtimes

O hook PostToolUse detecta automaticamente mudanças em `KERNEL.md`, `.claude/agents/` e `.claude/commands/` e emite avisos de sync pendente. Para verificar/corrigir manualmente:

```bash
python3.14 system/scripts/sync.py        # Relatório
python3.14 system/scripts/sync.py --fix  # Corrige automaticamente
```

Detalhes em `system/protocols/sync.md`.
