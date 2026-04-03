# Issues Conhecidos — Health Monitor

## Issues Registrados

| ID | Data | Severidade | Descricao | Status |
|---|---|---|---|---|
| HM-001 | 2026-03-21 | WARN | memory-map.md nao inclui arquivos de memoria de health-monitor, task-runner e workflow-planner | Resolvido |
| HM-002 | 2026-03-21 | WARN | doc-registry.md nao referencia os 3 agentes criados em 2026-03-21 | Resolvido |
| HM-003 | 2026-03-21 | WARN | docs/system-agents.md documenta apenas 5 dos 8 agentes de sistema | Resolvido |
| HM-004 | 2026-03-23 | WARN | skill agent-bootstrap existe em .claude/skills/agent-bootstrap/SKILL.md mas nao esta em skill-registry.md | Resolvido |
| HM-005 | 2026-03-23 | WARN | memory-map.md tem tamanhos de arquivo desatualizados para registry.md, skill-registry.md, team-registry.md e o proprio memory-map.md | Resolvido |
| HM-006 | 2026-03-23 | WARN | system/memory/handoff.md contem HO-001 e HO-002 com status Concluido que deveriam ser removidos pelo memory-manager | Resolvido |
| HM-007 | 2026-03-23 | INFO | README.md nao existe na raiz do projeto | Resolvido |
| HM-008 | 2026-03-24 | ERROR | skill agent-bootstrap em .claude/skills/ em vez de system/agents/agent-manager/skills/agent-bootstrap/ (localizacao nao-canonica) | Aberto |
| HM-009 | 2026-03-24 | ERROR | 11 agentes wrapper (brand-guidelines, canvas-design, doc-coauthoring, docx-manager, pptx-manager, xlsx-manager, pdf-manager, frontend-design, theme-factory, web-artifacts-builder, mcp-builder) nao tem diretorio skills/ local — skills fisicamente em system/skills/ mas registradas como skills de agente no skill-registry.md | Aberto |
| HM-010 | 2026-03-24 | WARN | memory-map.md desatualizado desde 2026-03-23 — tamanhos de bus.md, registry.md e skill-registry.md divergem significativamente dos valores reais | Aberto |
| HM-011 | 2026-03-24 | WARN | docs/ nao refletem v0.8.0 (sistema de hooks) — nenhum arquivo em docs/ menciona hooks, pre_tool_use, post_tool_use ou system/scripts/hooks/ | Aberto |
