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

## Sync de Runtimes

O hook PostToolUse detecta automaticamente mudanças em `KERNEL.md`, `.Codex/agents/` e `.Codex/commands/` e emite avisos de sync pendente. Para verificar/corrigir manualmente:

```bash
python3.14 system/scripts/sync.py        # Relatório
python3.14 system/scripts/sync.py --fix  # Corrige automaticamente
```

Detalhes em `system/protocols/sync.md`.
