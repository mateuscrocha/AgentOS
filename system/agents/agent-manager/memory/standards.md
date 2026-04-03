# Padrões de Criação de Agentes — AgentOS

## Formato Obrigatório

Todo agente (sistema ou usuário) DEVE ter:

1. **AGENT.md** com frontmatter YAML contendo: name, scope, description, version, created
2. **Seções obrigatórias**: Persona, Capacidades, Matriz de Colaboração, Memória, Regras
3. **Diretório memory/** com pelo menos `history.md`
4. **Diretório skills/** (pode estar vazio inicialmente)

## Convenção de Nomes

- **Agentes**: kebab-case (ex: `meu-agente`, `data-analyst`)
- **Spaces**: kebab-case (ex: `meu-space`)
- **Areas**: kebab-case (ex: `backend`, `data-pipeline`)
- **Skills**: kebab-case (ex: `criar-relatorio`)
- **Times**: kebab-case (ex: `time-pesquisa`)

## Namespace nos Runtimes

Cada runtime tem seu diretório de agentes. O sistema faz **dual-write** em ambos:

| Runtime | Diretório |
|---|---|
| Claude Code | `.claude/agents/` |
| Gemini CLI | `.gemini/agents/` |

Convenção de nomes (compartilhada):
- Sistema: `{runtime}/agents/{nome}.md`
- Agente de area: `{runtime}/agents/{space}--{area}--{agente}.md`
- Agente de team: `{runtime}/agents/{space}--{area}--{team}--{agente}.md`

## Template Base

Usar: `system/templates/agent/AGENT.md.template`

## Validações na Criação

1. Nome único (não conflita com agentes existentes no registry)
2. Space e area existem (para agentes de usuário)
3. Formato do nome é kebab-case
4. Template foi aplicado corretamente
5. Arquivos de runtime foram criados (`.claude/agents/` e `.gemini/agents/`)
6. Registry foi atualizado
7. Evento foi registrado no bus.md
