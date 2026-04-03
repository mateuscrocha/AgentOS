# Protocolo de Sincronização — AgentOS

## Visão Geral

Define quando e como sincronizar os runtimes (`.Codex/` e `.gemini/`) para garantir que todos os usuários — independente do CLI que usam — tenham acesso às mesmas capacidades e documentação atualizada.

---

## Resumo de Regras

1. `.Codex/` é o runtime **primário** (source of truth para agents e commands)
2. `.gemini/` é **derivado** de `.Codex/` — nunca edite `.gemini/` diretamente
3. Toda mudança em KERNEL.md, agents ou commands **deve** disparar sync
4. Executar `sync.py` antes de qualquer release ou merge em branch principal
5. Hooks detectam automaticamente mudanças que requerem sync e emitem avisos

---

## Fluxo de Sincronização

### Direção

```
KERNEL.md (source of truth agnóstico)
    │
    ├── CODEX.md (delta Codex)
    │       │
    │       └── .Codex/agents/      ──sync──►  .gemini/agents/
    │           .Codex/commands/    ──sync──►  .gemini/skills/
    │
    └── GEMINI.md (delta Gemini CLI)
```

**Regra:** A sincronização é **unidirecional**: `.Codex/ → .gemini/`. Mudanças feitas diretamente em `.gemini/` serão sobrescritas no próximo sync.

### Quando sincronizar

| Evento | Ação necessária |
|---|---|
| Edição de `KERNEL.md` | Verificar se CODEX.md e GEMINI.md ainda são consistentes |
| Novo agent em `.Codex/agents/` | Sync para `.gemini/agents/` |
| Agent atualizado em `.Codex/agents/` | Sync conteúdo para `.gemini/agents/` |
| Novo command em `.Codex/commands/` | Gerar skill correspondente em `.gemini/skills/` |
| Command atualizado em `.Codex/commands/` | Atualizar skill correspondente em `.gemini/skills/` |
| Novo system agent em `system/agents/` | Criar loader em `.Codex/agents/` e `.gemini/agents/` |
| Release/merge em branch principal | Executar `sync.py --fix` como validação final |

### Como executar

```bash
# Modo relatório (apenas detecta problemas)
py -3 system/scripts/sync.py

# Modo correção (aplica fixes automáticos)
py -3 system/scripts/sync.py --fix

# Modo JSON (para integração com hooks/scripts)
py -3 system/scripts/sync.py --json
```

---

## O que o sync verifica

### 1. Paridade de Agents

- Cada agent em `.Codex/agents/` deve ter um equivalente em `.gemini/agents/`
- Conteúdo deve ser idêntico (exceto campos Codex-específicos: `model`, `color`)
- Agents órfãos em `.gemini/` são sinalizados como warning

### 2. Paridade de Commands/Skills

- Cada command em `.Codex/commands/` deve ter uma skill em `.gemini/skills/`
- Skills órfãs (sem command correspondente) são sinalizadas como warning
- Exceção: `agent-bootstrap` é uma skill legítima sem command

### 3. Completude de System Agents

- Cada agent em `system/agents/` com `AGENT.md` deve ter loader em ambos os runtimes
- Garante que novos system agents não fiquem esquecidos em um runtime

### 4. Referências ao KERNEL

- `CODEX.md` deve referenciar `KERNEL.md`
- `GEMINI.md` deve referenciar `KERNEL.md`
- Garante que o modelo de "thin loader + kernel" está íntegro

### 5. Consistência de Versão

- A versão em `world.md`, `README.md` e `CHANGELOG.md` deve ser a mesma
- Divergências indicam que algum documento ficou para trás numa atualização

---

## Transformações no Sync

Ao copiar de `.Codex/` para `.gemini/`, o sync aplica as seguintes transformações:

### Agents
- Remove campo `model:` do frontmatter (Codex-específico)
- Remove campo `color:` do frontmatter (Claude-específico)

### Commands → Skills
- Converte frontmatter: mantém `name` e `description`
- Substitui invocações: `via Agent tool` → `via @subagent`
- Adapta referências de paths: `.Codex/agents/` → ambos runtimes
- Estrutura: arquivo flat → diretório com `SKILL.md` dentro

---

## Enforcement via Hooks

O sistema de hooks detecta automaticamente mudanças que requerem sync:

| Arquivo alterado | Mensagem do hook |
|---|---|
| `KERNEL.md` | "KERNEL.md alterado — verificar se CODEX.md e GEMINI.md estão consistentes. Execute sync." |
| `.Codex/agents/*.md` | "Agent alterado — sync com .gemini/ pode estar pendente." |
| `.Codex/commands/*.md` | "Command alterado — sync com .gemini/skills/ pode estar pendente." |

Esses avisos são emitidos pelo hook PostToolUse (Phase 2) e são **warnings** — não bloqueiam a operação.

---

## Responsabilidades

| Ator | Responsabilidade |
|---|---|
| **Hooks (automático)** | Detectar mudanças e avisar sobre sync pendente |
| **sync.py (sob demanda)** | Detectar drift e aplicar correções |
| **Agente que fez a mudança** | Garantir que o sync foi executado após a alteração |
| **health-monitor** | Incluir verificação de sync no diagnóstico de integridade |

---

## Regra de Ouro

> **Se você mudou um agent, command ou o KERNEL, e não verificou o sync entre runtimes, a operação está incompleta.**
