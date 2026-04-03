# Relatório de Saúde — AgentOS
**Data:** 2026-03-24
**Status Geral:** ATENCAO

## Resumo
- Verificações OK: 62
- Avisos (WARN): 3
- Erros (ERROR): 2

---

## Detalhes

### Agentes

#### Agentes do Sistema — Diretórios e AGENT.md

| Agente | Dir | AGENT.md | memory/ | Status |
|---|---|---|---|---|
| agent-manager | YES | YES | YES | OK |
| doc-manager | YES | YES | YES | OK |
| health-monitor | YES | YES | YES | OK |
| memory-manager | YES | YES | YES | OK |
| skill-manager | YES | YES | YES | OK |
| task-runner | YES | YES | YES | OK |
| team-manager | YES | YES | YES | OK |
| workflow-planner | YES | YES | YES | OK |
| brand-guidelines | YES | YES | YES | OK |
| canvas-design | YES | YES | YES | OK |
| doc-coauthoring | YES | YES | YES | OK |
| docx-manager | YES | YES | YES | OK |
| frontend-design | YES | YES | YES | OK |
| mcp-builder | YES | YES | YES | OK |
| pdf-manager | YES | YES | YES | OK |
| pptx-manager | YES | YES | YES | OK |
| theme-factory | YES | YES | YES | OK |
| web-artifacts-builder | YES | YES | YES | OK |
| xlsx-manager | YES | YES | YES | OK |

Todos os 19 agentes do sistema presentes no registry.md têm diretório, AGENT.md e memory/ no filesystem.

#### Runtime Files (.claude/agents/ e .gemini/agents/)

| Verificação | Resultado | Status |
|---|---|---|
| .claude/agents/ lista 19 arquivos | 19 arquivos encontrados | OK |
| .gemini/agents/ lista 19 arquivos | 19 arquivos encontrados | OK |
| .claude/agents/ == .gemini/agents/ | Idênticos (diff vazio) | OK |
| Cada runtime file tem frontmatter válido | Verificado (name, description, model, color) | OK |
| Todos os 19 agentes do registry têm runtime files | Confirmado | OK |
| Sem arquivos órfãos em .claude/agents/ | Nenhum | OK |
| Sem arquivos órfãos em .gemini/agents/ | Nenhum | OK |

#### Agentes do Usuário

| Verificação | Resultado | Status |
|---|---|---|
| Times no team-registry.md | Nenhum (esperado — sem spaces criados) | OK |
| Spaces no filesystem | Nenhum (consistente com world.md) | OK |

---

### Skills

#### Skills Globais (system/skills/)

| Skill | Dir | SKILL.md | Status |
|---|---|---|---|
| skill-creator | YES | YES | OK |
| brand-guidelines | YES | YES | OK |
| canvas-design | YES | YES | OK |
| doc-coauthoring | YES | YES | OK |
| docx | YES | YES | OK |
| frontend-design | YES | YES | OK |
| mcp-builder | YES | YES | OK |
| pdf | YES | YES | OK |
| pptx | YES | YES | OK |
| theme-factory | YES | YES | OK |
| web-artifacts-builder | YES | YES | OK |
| xlsx | YES | YES | OK |

#### Skills de Agentes (system/agents/{agente}/skills/)

| Skill | Agente | Dir | SKILL.md | Status |
|---|---|---|---|---|
| agent-bootstrap | agent-manager | NO (em .claude/skills/) | YES | ERROR |
| create-agent | agent-manager | YES | YES | OK |
| create-area | agent-manager | YES | YES | OK |
| create-space | agent-manager | YES | YES | OK |
| evolve-agent | agent-manager | YES | YES | OK |
| audit-docs | doc-manager | YES | YES | OK |
| generate-docs | doc-manager | YES | YES | OK |
| generate-readme | doc-manager | YES | YES | OK |
| check-handoffs | health-monitor | YES | YES | OK |
| check-health | health-monitor | YES | YES | OK |
| generate-report | health-monitor | YES | YES | OK |
| cleanup-memory | memory-manager | YES | YES | OK |
| init-memory | memory-manager | YES | YES | OK |
| validate-skill | skill-manager | YES | YES | OK |
| create-workflow | task-runner | YES | YES | OK |
| resume-workflow | task-runner | YES | YES | OK |
| run-workflow | task-runner | YES | YES | OK |
| create-team | team-manager | YES | YES | OK |
| manage-members | team-manager | YES | YES | OK |
| estimate-impact | workflow-planner | YES | YES | OK |
| plan-action | workflow-planner | YES | YES | OK |
| brand-guidelines | brand-guidelines | NO (skills/ dir ausente) | — | ERROR |
| canvas-design | canvas-design | NO (skills/ dir ausente) | — | ERROR |
| doc-coauthoring | doc-coauthoring | NO (skills/ dir ausente) | — | ERROR |
| docx | docx-manager | NO (skills/ dir ausente) | — | ERROR |
| pdf | pdf-manager | NO (skills/ dir ausente) | — | ERROR |
| pptx | pptx-manager | NO (skills/ dir ausente) | — | ERROR |
| xlsx | xlsx-manager | NO (skills/ dir ausente) | — | ERROR |
| frontend-design | frontend-design | NO (skills/ dir ausente) | — | ERROR |
| theme-factory | theme-factory | NO (skills/ dir ausente) | — | ERROR |
| web-artifacts-builder | web-artifacts-builder | NO (skills/ dir ausente) | — | ERROR |
| mcp-builder | mcp-builder | NO (skills/ dir ausente) | — | ERROR |

**Nota de severidade:** Os 11 agentes de skills Anthropic (brand-guidelines, canvas-design, doc-coauthoring, docx-manager, pptx-manager, xlsx-manager, pdf-manager, frontend-design, theme-factory, web-artifacts-builder, mcp-builder) têm suas skills registradas como skills do agente no skill-registry.md, mas fisicamente as skills residem em `system/skills/` (global), não em `system/agents/{agente}/skills/`. Estes agentes atuam como thin wrappers da skill global — o diretório `skills/` está ausente nos diretórios dos agentes. Isso é uma inconsistência de registro, não um risco operacional imediato, pois as skills globais existem.

**agent-bootstrap:** A skill está em `.claude/skills/agent-bootstrap/SKILL.md` em vez de `system/agents/agent-manager/skills/agent-bootstrap/`. A inconsistência de localização persiste.

---

### Memória

#### bus.md

| Arquivo | Entradas Atuais | Threshold | Status |
|---|---|---|---|
| system/memory/bus.md | 18 entradas | 50 | OK |

#### history.md por Agente

| Agente | Pipe-rows | Entradas Reais (rows-2) | Threshold | Status |
|---|---|---|---|---|
| agent-manager | 3 | 1 | 100 | OK |
| doc-manager | 9 | 7 | 100 | OK |
| health-monitor | 5 | 3 | 100 | OK |
| memory-manager | 6 | 4 | 100 | OK |
| skill-manager | 4 | 2 | 100 | OK |
| task-runner | 3 | 1 | 100 | OK |
| team-manager | 3 | 1 | 100 | OK |
| workflow-planner | 3 | 1 | 100 | OK |
| brand-guidelines | 0 | 0 | 100 | OK |
| canvas-design | 0 | 0 | 100 | OK |
| doc-coauthoring | 0 | 0 | 100 | OK |
| docx-manager | 0 | 0 | 100 | OK |
| frontend-design | 0 | 0 | 100 | OK |
| mcp-builder | 0 | 0 | 100 | OK |
| pdf-manager | 0 | 0 | 100 | OK |
| pptx-manager | 0 | 0 | 100 | OK |
| theme-factory | 0 | 0 | 100 | OK |
| web-artifacts-builder | 0 | 0 | 100 | OK |
| xlsx-manager | 0 | 0 | 100 | OK |

Todos os históricos muito abaixo do threshold de 100. Nenhuma ação necessária.

#### world.md — Seção "Última Alteração"

| Arquivo | Tem seção | Status |
|---|---|---|
| system/memory/world.md | SIM (2026-03-24, v0.8.0 hooks) | OK |

Não existem outros world.md no sistema (nenhum space criado).

#### memory-map.md — Atualidade

| Verificação | Detalhe | Status |
|---|---|---|
| Última atualização do mapa | 2026-03-23 | WARN |
| bus.md: mapa diz 1698 bytes, real é 3046 bytes | Delta +1348 bytes (18 entradas vs ~10 entradas em mar-23) | WARN |
| registry.md: mapa diz 1465 bytes, real é 2832 bytes | Atualização pós 2026-03-23 | WARN |
| skill-registry.md: mapa diz 3083 bytes, real é 4610 bytes | Atualização pós 2026-03-23 | WARN |
| health-monitor/history.md: mapa diz 612 bytes, real é 612 bytes | Consistente | OK |

O memory-map.md não foi atualizado após as mudanças do dia 2026-03-24 (hooks, novos agentes, novas skills).

---

### Handoffs

#### check-handoffs — Scan Completo

| Escopo | Arquivo | Handoffs Ativos | Status |
|---|---|---|---|
| system | system/memory/handoff.md | 0 (sem handoffs ativos) | OK |
| spaces | (nenhum space existe) | — | OK |

Nenhum handoff stale, travado, órfão ou pendente de cleanup encontrado.

---

### Documentação

| Verificação | Detalhe | Status |
|---|---|---|
| docs/overview.md existe | SIM | OK |
| docs/architecture.md existe | SIM | OK |
| docs/getting-started.md existe | SIM | OK |
| docs/system-agents.md existe | SIM | OK |
| docs/commands.md existe | SIM | OK |
| docs/protocols.md existe | SIM | OK |
| docs/creating-projects.md existe | SIM | OK |
| docs/memory-system.md existe | SIM | OK |
| docs/development-guide.md existe | SIM | OK |
| docs/index.html existe | SIM | OK |
| README.md existe | SIM | OK |
| CHANGELOG.md existe | SIM (v0.8.0 é entrada mais recente) | OK |
| Docs referenciam hooks/v0.8.0 | NÃO — nenhum doc em docs/ menciona hooks | WARN |

---

## Issues Identificados

### HM-008 — ERROR — Skill agent-bootstrap em localização não-canônica

- **Severidade:** ERROR
- **Detalhe:** skill-registry.md registra `agent-bootstrap` como skill do agente `agent-manager` (convenção: `system/agents/agent-manager/skills/agent-bootstrap/`). O SKILL.md está em `.claude/skills/agent-bootstrap/SKILL.md` — localização não-canônica para skills de agente.
- **Responsável:** skill-manager
- **Ação:** Mover ou criar link em `system/agents/agent-manager/skills/agent-bootstrap/SKILL.md`.

### HM-009 — ERROR — 11 agentes de skills Anthropic sem diretório skills/ local

- **Severidade:** ERROR (inconsistência de registro)
- **Detalhe:** skill-registry.md lista 11 skills (brand-guidelines, canvas-design, doc-coauthoring, docx, pdf, pptx, xlsx, frontend-design, theme-factory, web-artifacts-builder, mcp-builder) com `agente` = nome do agente wrapper. Os agentes wrapper não têm diretório `skills/` — as skills físicas estão em `system/skills/` (global). O registro diz "skill do agente X" mas o filesystem diz "skill global". Não é falha operacional, mas é inconsistência de modelo.
- **Responsável:** skill-manager + agent-manager
- **Ação recomendada:** Atualizar skill-registry.md para listar essas skills como `global` (não vinculadas a agente), ou criar symlinks/referências nos diretórios dos agentes.

### HM-010 — WARN — memory-map.md desatualizado

- **Severidade:** WARN
- **Detalhe:** memory-map.md foi atualizado pela última vez em 2026-03-23. Após as mudanças do dia 2026-03-24 (sistema de hooks, novos agentes, scripts), vários arquivos cresceram significativamente (bus.md: +80% em bytes, registry.md: +93%, skill-registry.md: +50%).
- **Responsável:** memory-manager
- **Ação:** Executar regeneração do memory-map.md.

### HM-011 — WARN — Docs não refletem v0.8.0 (sistema de hooks)

- **Severidade:** WARN
- **Detalhe:** Nenhum arquivo em `docs/` menciona o sistema de hooks implementado em 2026-03-24 (v0.8.0). `docs/system-agents.md`, `docs/overview.md`, `docs/architecture.md` e `docs/development-guide.md` estão potencialmente desatualizados.
- **Responsável:** doc-manager
- **Ação:** Executar `audit-docs` e atualizar os docs afetados + `doc-registry.md`.

---

## Ações Recomendadas

- [ ] Mover/duplicar `agent-bootstrap` SKILL.md para `system/agents/agent-manager/skills/agent-bootstrap/SKILL.md` → skill-manager
- [ ] Corrigir skill-registry.md: 11 skills Anthropic devem ser `global` ou ter referências nos agentes wrapper → skill-manager + agent-manager
- [ ] Regenerar `memory-map.md` com tamanhos reais → memory-manager
- [ ] Atualizar `docs/` para refletir hooks/v0.8.0 + atualizar `doc-registry.md` → doc-manager
