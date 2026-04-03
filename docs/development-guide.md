# Guia de Desenvolvimento

Este guia é para quem quer entender as convenções internas do AgentOS e como estender o sistema corretamente.

---

## Princípios fundamentais

1. **Tudo é arquivo** — memória, definições de agentes, skills, protocolos. Nada existe fora do sistema de arquivos.
2. **Escopo explícito** — toda operação tem um escopo definido. Nunca escreva fora do seu escopo.
3. **Templates first** — sempre use os templates em `system/templates/` como base para criar recursos.
4. **Registre tudo** — toda criação/mudança relevante vai para o registry e o bus de eventos.
5. **Leia antes de agir** — agentes sempre leem sua memória antes de executar qualquer tarefa.
6. **Nunca invente** — agentes documentam e executam apenas o que está definido no sistema.

---

## Convenções de nomes

| Recurso | Convenção | Exemplos |
|---|---|---|
| Spaces | kebab-case | `meu-space`, `analise-dados` |
| Áreas | kebab-case | `backend`, `data-pipeline` |
| Agentes | kebab-case | `analista`, `executor-tarefas` |
| Skills | kebab-case | `analisar-dados`, `gerar-relatorio` |
| Times | kebab-case | `time-analise`, `squad-producao` |
| Arquivos de sistema | kebab-case | `AGENT.md`, `SKILL.md` |

**Regra:** Letras minúsculas, sem espaços, sem underscores, sem caracteres especiais. Apenas letras, números e hífens.

---

## Templates disponíveis

Todos os templates ficam em `system/templates/`:

| Template | Localização | Usado para |
|---|---|---|
| AGENT.md.template | `system/templates/agent/` | Criar AGENT.md de novos agentes |
| SPACE.md.template | `system/templates/space/` | Criar SPACE.md de novos spaces |
| AREA.md.template | `system/templates/area/` | Criar AREA.md de novas áreas |
| SKILL.md.template | `system/templates/skill/` | Criar SKILL.md de novas skills |
| TEAM.md.template | `system/templates/team/` | Criar TEAM.md de novos times |

### Placeholders dos templates

Os templates usam `{{PLACEHOLDER}}` para valores a serem substituídos:

**AGENT.md.template:**
- `{{AGENT_NAME}}` — nome do agente
- `{{SCOPE}}` — `system` ou `user`
- `{{SPACE_NAME}}` — nome do space (apenas para agentes de usuário)
- `{{AREA_NAME}}` — nome da área (apenas para agentes de usuário)
- `{{TEAM_NAME}}` — nome do time (se for membro de time)
- `{{DESCRIPTION}}` — descrição curta do agente
- `{{CREATED_DATE}}` — data de criação (YYYY-MM-DD)

**SPACE.md.template:**
- `{{SPACE_NAME}}` — nome do space
- `{{DESCRIPTION}}` — descrição do space
- `{{CREATED_DATE}}` — data de criação
- `{{OWNER}}` — usuário proprietário

**AREA.md.template:**
- `{{AREA_NAME}}` — nome da área
- `{{SPACE_NAME}}` — nome do space
- `{{DESCRIPTION}}` — descrição da área
- `{{CREATED_DATE}}` — data de criação

**SKILL.md.template:**
- `{{SKILL_NAME}}` — nome da skill
- `{{DESCRIPTION}}` — descrição da skill
- `{{AGENT_NAME}}` — agente dono da skill
- `{{SPACE_NAME}}` — space do agente
- `{{AREA_NAME}}` — área do agente
- `{{CREATED_DATE}}` — data de criação

**TEAM.md.template:**
- `{{TEAM_NAME}}` — nome do time
- `{{SPACE_NAME}}` — space do time
- `{{AREA_NAME}}` — área do time
- `{{DESCRIPTION}}` — descrição do time
- `{{LEAD_AGENT}}` — agente líder
- `{{CREATED_DATE}}` — data de criação

---

## Estrutura de um AGENT.md válido

Todo `AGENT.md` deve ter:

**Frontmatter YAML obrigatório:**
```yaml
---
name: nome-do-agente
scope: user  (ou system)
space: nome-do-space  (apenas user)
area: nome-da-area    (apenas user)
team: nome-do-time    (se for membro)
description: o que este agente faz
version: 1.0
created: YYYY-MM-DD
---
```

**Seções obrigatórias:**
1. `# Persona` — descrição do comportamento e missão do agente
2. `# Capacidades` — lista de o que o agente pode fazer
3. `# Matriz de Colaboração` — tabela: situação → agente → protocolo
4. `# Memória` — onde fica a memória do agente
5. `# Skills` — lista de skills disponíveis (pode estar vazia)
6. `# Regras` — lista numerada de regras que o agente deve seguir

---

## Estrutura de um SKILL.md válido

Todo `SKILL.md` deve ter:

**Frontmatter YAML obrigatório:**
```yaml
---
name: nome-da-skill
description: o que a skill faz
agent: nome-do-agente
space: nome-do-space
area: nome-da-area
version: 1.0
created: YYYY-MM-DD
---
```

**Seções obrigatórias:**
1. `## O que esta skill faz` — descrição clara do propósito
2. `## Quando usar` — casos de uso (lista)
3. `## Processo` — passos numerados de execução
4. `## Inputs` — parâmetros e dados necessários
5. `## Outputs` — o que a skill produz
6. `## Regras` — restrições e regras de execução

---

## Namespace no Claude Code

O Claude Code descobre agentes através de `.claude/agents/`. O AgentOS mantém três tipos:

**Agentes de sistema** (criados durante o setup):
```
.claude/agents/agent-manager.md
.claude/agents/skill-manager.md
.claude/agents/memory-manager.md
.claude/agents/team-manager.md
.claude/agents/doc-manager.md
```

**Agentes de área** (criados pelo agent-manager):
```
.claude/agents/{space}--{area}--{agente}.md
```

**Agentes de time** (criados pelo agent-manager):
```
.claude/agents/{space}--{area}--{time}--{agente}.md
```

O separador `--` (dois hífens) é o delimitador de namespace obrigatório para distinguir os níveis.

---

## Eventos do bus e quando publicar

Sempre que um agente de sistema realizar uma operação relevante, deve publicar um evento em `system/memory/bus.md`:

| Evento | Quem publica | Quando |
|---|---|---|
| `space.created` | agent-manager | Novo space criado |
| `area.created` | agent-manager | Nova área criada |
| `agent.created` | agent-manager | Novo agente criado |
| `agent.evolved` | agent-manager | Agente atualizado |
| `agent.deprecated` | agent-manager | Agente desativado |
| `team.created` | team-manager | Novo time criado |
| `team.member.added` | team-manager | Membro adicionado |
| `team.member.removed` | team-manager | Membro removido |
| `skill.created` | skill-manager | Nova skill criada |
| `memory.cleaned` | memory-manager | Limpeza de memória executada |
| `docs.generated` | doc-manager | Documentação gerada/atualizada |

**Formato de entrada no bus:**
```markdown
| YYYY-MM-DD HH:MM | {agente} | {evento} | {escopo} | {dados} |
```

---

## Como adicionar um novo agente de sistema

Se você precisar adicionar um novo agente de sistema ao core do AgentOS (operação avançada):

1. Crie `system/agents/{nome}/AGENT.md` seguindo o template
2. Crie `system/agents/{nome}/memory/history.md`
3. Crie `system/agents/{nome}/skills/` (vazio inicialmente)
4. Crie `.claude/agents/{nome}.md` para integração com Claude Code
5. Adicione o agente em `system/agents/agent-manager/memory/registry.md`
6. Adicione em `system/memory/world.md` na tabela de agentes do sistema
7. Registre o evento `agent.created` no `system/memory/bus.md`
8. Atualize `system/agents/memory-manager/memory/memory-map.md`
9. Documente o agente em `docs/system-agents.md`

---

## Como criar uma skill global

Skills globais ficam em `system/skills/` e são acessíveis por todos os agentes:

1. Crie `system/skills/{nome}/SKILL.md` seguindo o template
2. Adicione a skill em `system/agents/skill-manager/memory/skill-registry.md`
3. Registre evento `skill.created` no bus
4. Documente a skill no `CLAUDE.md` (seção de skills globais)

---

## Como manter o sistema

O AgentOS tem um protocolo de manutenção definido em `system/protocols/maintenance.md`. As tarefas mais importantes:

### Atualizar o CHANGELOG.md

Localizado na raiz (`CHANGELOG.md`). Use o formato Keep a Changelog em português.

**Registre quando:**
- Criar um novo agente, space, área, time ou skill
- Adicionar um novo protocolo ou skill global
- Fazer mudanças que alteram a estrutura ou capacidades do sistema

**Não registre:** operações rotineiras como cleanup de memória, leituras, consultas.

**Formato de entrada:**
```markdown
## [versão] - YYYY-MM-DD

### Adicionado
- Descrição da adição

### Alterado
- Descrição da mudança

### Removido
- Descrição da remoção
```

### Atualizar world.md

Ao reescrever qualquer `world.md`, sempre incluir a seção `## Última Alteração`:

```markdown
## Última Alteração

- **Data:** YYYY-MM-DD
- **O que mudou:** Breve descrição
- **Agente:** nome-do-agente
```

### Quando acionar limpeza de memória

Peça ao `memory-manager` para executar a skill `cleanup-memory` quando:
- `system/memory/bus.md` tiver mais de 50 entradas
- `history.md` de algum agente tiver mais de 100 entradas
- Houver muitos handoffs com status Concluído acumulados

### Quando acionar auditoria de docs

Peça ao `doc-manager` para executar a skill `audit-docs` quando:
- 3 ou mais recursos novos (agentes, skills, times) foram criados sem auditoria
- Suspeitar que a documentação está desatualizada

---

## Sistema de Hooks — o que todo desenvolvedor precisa saber

O AgentOS enforça protocolos automaticamente através de hooks configurados em `.claude/settings.json`. Entender como eles funcionam evita bloqueios inesperados durante o desenvolvimento.

### Guardrails (PreToolUse) — o que é bloqueado

O hook `PreToolUse` intercepta operações de Write e Edit e bloqueia qualquer tentativa de modificar:

- `system/protocols/` — use os agentes de sistema para evoluir protocolos
- `system/scripts/` — use os agentes de sistema para evoluir scripts
- `system/agents/*/AGENT.md` — use o `agent-manager` para evoluir agentes de sistema
- `system/skills/*/SKILL.md` — use o `skill-manager` para evoluir skills globais
- `.claude/settings.json` — configuração dos hooks em si
- Secrets: `.env`, `*.key`, `*.pem`

**Caminhos em `system/` que podem ser editados diretamente:** `system/memory/*.md` e `system/agents/*/memory/*.md`.

### Enforcement (PostToolUse) — o que é rastreado

O hook `PostToolUse` monitora criações estruturais (novos spaces, áreas, times, agentes) e verifica se o checklist de manutenção foi seguido — atualização de CHANGELOG.md, world.md, bus.md, registries e docs.

### Validation (Stop) — verificação final

Ao encerrar a sessão, o hook `Stop` valida se todas as mudanças estruturais da sessão foram devidamente registradas.

### Testando hooks

Os hooks têm 62 testes unitários em `system/scripts/hooks/test_hooks.py`. Para executar:

```bash
py -3 system/scripts/hooks/test_hooks.py
```

---

## Regras que nunca devem ser quebradas

1. **Nunca modifique `system/` manualmente** sem usar os agentes do sistema
2. **Nunca crie agentes de usuário fora de `spaces/{space}/areas/{area}/agents/`**
3. **Nunca use nomes que conflitam com agentes existentes** (valide no registry antes)
4. **Nunca escreva em escopos de outros agentes** (respeite a hierarquia de memória)
5. **Nunca pule o registro** — toda criação deve atualizar o registry correspondente
6. **Nunca pule o bus** — toda operação relevante deve ser registrada como evento

---

## Documentação relacionada

- [Arquitetura](architecture.md) — estrutura completa do sistema
- [Agentes do sistema](system-agents.md) — quem faz o quê
- [Criando spaces, áreas e agentes](creating-projects.md) — processo de criação
- [Sistema de memória](memory-system.md) — escopos e tipos de memória
- [Protocolos](protocols.md) — comunicação e memória
