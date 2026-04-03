# Protocolo de Manutenção — AgentOS

## Visão Geral

Define quando e como realizar tarefas de manutenção do sistema para manter o AgentOS saudável e rastreável.

---

## Resumo de Regras

1. Rodar cleanup de memória quando bus.md ultrapassar 50 entradas
2. Atualizar CHANGELOG.md ao fazer mudanças estruturais (nunca para operações rotineiras)
3. Auditar docs quando 3+ recursos novos foram criados sem auditoria
4. Incluir seção "Última Alteração" ao atualizar qualquer world.md

---

## Tarefas de Manutenção

### 1. Limpeza de Memória

- **Responsável:** memory-manager (skill `cleanup-memory`)
- **Quando:** Quando `bus.md` ultrapassar 50 entradas, OU quando solicitado pelo usuário
- **O que faz:**
  - Remove handoffs com status `Concluído` de todos os `handoff.md`
  - Arquiva entradas antigas do `bus.md` para `bus-archive.md` (mantém últimas 50)
  - Poda `history.md` com 100+ entradas (mantém últimas 50)
- **Registro:** Registrar evento `memory.cleaned` em `bus.md` e atualizar `history.md` do memory-manager

### 2. Atualização do CHANGELOG

- **Responsável:** O agente que realizou a mudança estrutural
- **Quando:** Ao criar agentes, spaces, areas, times, skills, protocolos, ou ao fazer mudanças que alteram a estrutura ou capacidades do sistema
- **Formato:** [Keep a Changelog](https://keepachangelog.com/pt-BR/), em português
- **Regra:** Não registrar operações rotineiras (cleanup, leituras, consultas). Apenas mudanças que alteram a estrutura do sistema.
- **Arquivo:** `CHANGELOG.md` na raiz do projeto

### 3. Auditoria de Documentação

- **Responsável:** doc-manager (skill `audit-docs`)
- **Quando:** Após 3+ recursos novos criados sem auditoria, OU quando solicitado
- **O que verifica:**
  - `docs/` reflete a realidade do sistema
  - Cada AGENT.md de agente está atualizado
  - Diretórios de runtime (`.claude/agents/` e `.gemini/agents/`) apontam corretamente para AGENT.md
  - CHANGELOG.md está atualizado

### 4. Rotação de Bus e Históricos

- **Responsável:** memory-manager
- **Thresholds:**

| Arquivo | Threshold | Ação |
|---|---|---|
| `bus.md` | > 50 entradas | Arquivar para `bus-archive.md`, manter últimas 50 |
| `history.md` | > 100 entradas | Podar, manter últimas 50 |
| `bus-archive.md` | Sem limite | Arquivo permanente |

### 5. Atualização de world.md

- **Responsável:** Qualquer agente que mude estado do escopo
- **Regra:** Ao reescrever world.md, sempre atualizar a seção `## Última Alteração` com:
  - Data da alteração
  - O que mudou (breve)
  - Agente responsável

---

## Checklist Obrigatório de Atualização do Sistema

Quando o sistema sofre uma **mudança estrutural** (novo agente, nova skill, novo protocolo, nova capacidade, nova versão), os seguintes documentos **DEVEM** ser atualizados na mesma operação. Este checklist é obrigatório e não pode ser adiado.

### Documentos a atualizar

| # | Documento | O que atualizar | Responsável |
|---|---|---|---|
| 1 | `CHANGELOG.md` | Nova entrada com versão, data, seções Added/Changed/Removed/Impact | Agente que fez a mudança |
| 2 | `system/memory/world.md` | Estatísticas, listas de agentes/skills, seção "Última Alteração" | Agente que fez a mudança |
| 3 | `system/memory/bus.md` | Evento registrado (ex: `agent.created`, `skill.installed`, `system.updated`) | Agente que fez a mudança |
| 4 | `CLAUDE.md` | Tabelas de agentes, skills, comandos (se aplicável) | Agente que fez a mudança |
| 5 | `GEMINI.md` | Referências correspondentes ao CLAUDE.md (se aplicável) | Agente que fez a mudança |
| 6 | `README.md` | Tabelas de agentes, comandos, versão | Agente que fez a mudança |
| 7 | `docs/system-agents.md` | Seção do agente (se agente novo/alterado) | doc-manager ou agente que fez a mudança |
| 8 | `docs/overview.md` | Contagem de agentes, versão, tabela (se mudou) | doc-manager ou agente que fez a mudança |
| 9 | `docs/getting-started.md` | Referências a contagens ou comandos (se mudou) | doc-manager ou agente que fez a mudança |
| 10 | `system/scripts/setup.py` | Lista de agentes, diretórios, versão, resumo (se mudou) | Agente que fez a mudança |
| 11 | Registries (`registry.md`, `skill-registry.md`) | Novos registros de agentes/skills | agent-manager ou skill-manager |
| 12 | `doc-registry.md` | Timestamps de docs atualizados | doc-manager |

### Quando aplicar

- **Novo agente de sistema**: itens 1-12
- **Nova skill global**: itens 1, 2, 3, 4, 5, 11
- **Novo comando**: itens 1, 2, 3, 4, 5, 6, 9
- **Mudança de protocolo**: itens 1, 2, 3
- **Novo space/area/team do usuário**: itens 2, 3, 11
- **Evolução de agente existente**: itens 1, 2, 3, 7

### Regra de ouro

> **Se você mudou a estrutura do sistema e não atualizou o checklist acima, a operação está incompleta.**

---

## Indicador de Última Manutenção

O memory-manager deve registrar em seu `history.md` a data da última limpeza no formato:

```
| YYYY-MM-DD HH:MM | cleanup | Handoffs: X, Bus arquivados: Y, Históricos podados: Z |
```
