---
name: generate-docs
description: Gera ou atualiza toda a documentação do AgentOS no diretório docs/
agent: doc-manager
version: 1.0
created: 2026-03-20
---

# Skill: generate-docs

## O que esta skill faz

Lê o estado atual do sistema e gera/atualiza toda a documentação estruturada em `docs/`.

## Quando usar

- Quando o usuário pede para gerar ou atualizar a documentação
- Quando novos agentes, skills ou funcionalidades foram adicionados ao sistema
- Quando a auditoria indicar docs desatualizados

## Inputs

Nenhum obrigatório. O estado é lido automaticamente do sistema.

Opcional:
- `--only <topico>`: Regenerar apenas um doc específico (ex: `--only architecture`)

## Processo

1. **Ler estado do sistema** — Obter informação atualizada de:
   - `CLAUDE.md` — definição do kernel
   - `system/memory/world.md` — estado global
   - `system/agents/agent-manager/memory/registry.md` — todos os agentes
   - `system/agents/skill-manager/memory/skill-registry.md` — todas as skills
   - `system/agents/memory-manager/memory/memory-map.md` — mapa de memória
   - `system/agents/team-manager/memory/team-registry.md` — todos os times
   - `system/protocols/*.md` — todos os protocolos
   - `system/templates/` — templates disponíveis
   - Cada `system/agents/*/AGENT.md` — definição de cada agente

2. **Gerar/atualizar docs** — Criar ou atualizar cada arquivo em `docs/`:

   | Arquivo | Fontes principais | Conteúdo |
   |---|---|---|
   | `overview.md` | `CLAUDE.md`, `world.md` | O que é o AgentOS, visão geral, status atual |
   | `architecture.md` | `CLAUDE.md` | Duas camadas (system/users), níveis de skills, namespaces |
   | `getting-started.md` | `CLAUDE.md`, scripts | Setup (`/setup`), primeiros passos, criar projeto |
   | `system-agents.md` | Todos `AGENT.md`, `registry.md` | Cada agente: propósito, capacidades, skills |
   | `commands.md` | `CLAUDE.md` | Referência completa de comandos com exemplos |
   | `protocols.md` | `system/protocols/*.md` | Comunicação, memória e handoff |
   | `creating-projects.md` | Skills de criação, templates | Como criar projetos, agentes, skills e times |
   | `memory-system.md` | `protocols/memory.md`, `memory-map.md` | Escopos, tipos de arquivo, regras de acesso |
   | `development-guide.md` | Templates, `standards.md` | Como estender o AgentOS, convenções |

3. **Atualizar doc-registry.md** — Registrar cada arquivo gerado com timestamp

4. **Registrar evento** — Adicionar `docs.generated` em `system/memory/bus.md`

5. **Atualizar history.md** — Registrar a ação no histórico do agente

## Output

- Diretório `docs/` com todos os arquivos atualizados
- `doc-registry.md` atualizado
- Evento registrado no bus

## Regras

1. Nunca inventar informação — tudo deve vir das fontes do sistema
2. Manter linguagem clara e acessível
3. Incluir exemplos práticos quando possível
4. Manter links relativos entre os docs
5. Se um doc já existe, preservar conteúdo adicionado manualmente pelo usuário quando possível
