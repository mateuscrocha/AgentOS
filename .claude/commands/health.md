---
description: Executa diagnóstico de integridade do sistema AgentOS
allowed-tools: Read, Glob, Grep, Write, Edit, Agent
---

Invoque `health-monitor` via Agent tool para executar skill `check-health`:
- Consistência entre registros (registry.md, skill-registry.md, team-registry.md) e filesystem
- Validade dos agentes em `.claude/agents/*.md` e `.gemini/agents/*.md`
- Handoffs pendentes/órfãos em todos os escopos
- Tamanho do bus.md e history.md contra thresholds
- Atualização dos world.md

Gere relatório com skill `generate-report` e apresente o resumo.
