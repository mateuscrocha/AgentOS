# AgentOS — Gemini CLI Runtime

@KERNEL.md

---

## Detalhes Específicos do Gemini CLI

- **Invocação de subagente**: Use `@nomeagente` para invocar agentes definidos em `.gemini/agents/`
- **Diretório de runtime**: `.gemini/`
- **Namespace de agentes**:
  - Sistema: `.gemini/agents/{nome}.md`
  - Agente de area: `.gemini/agents/{space}--{area}--{agente}.md`
  - Agente de team: `.gemini/agents/{space}--{area}--{team}--{agente}.md`
- **Comandos**: Disponíveis como skills em `.gemini/skills/`
- **Interop**: O diretório `.claude/agents/` espelha a mesma estrutura para o Claude Code. Ao criar agentes, o sistema faz **dual-write** em ambos os diretórios.
- **Sync**: O runtime `.gemini/` é derivado de `.claude/` via `system/scripts/sync.py`. Detalhes em `system/protocols/sync.md`.
