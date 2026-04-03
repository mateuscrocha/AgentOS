---
name: validate-skill
description: Valida o formato e conteúdo de um SKILL.md contra os padrões do AgentOS
agent: skill-manager
version: 1.0
---

# Skill: validate-skill

## O que esta skill faz

Valida que um arquivo SKILL.md segue o formato padrão do AgentOS.

## Inputs

- `skill_path`: Caminho completo para o SKILL.md a ser validado

## Processo

1. **Ler** o arquivo SKILL.md
2. **Validar frontmatter** — deve conter:
   - `name` (string, kebab-case)
   - `description` (string, não vazio)
   - `agent` (string, nome do agente dono)
   - `version` (string ou número)
3. **Validar seções** — deve conter pelo menos:
   - Descrição do que a skill faz
   - Processo (passos numerados)
4. **Verificar** que o diretório pai segue a convenção `skills/{nome}/SKILL.md`
5. **Reportar** resultado da validação

## Output

Relatório de validação:
- Status: Válido / Inválido
- Erros encontrados (se houver)
- Warnings (campos opcionais ausentes)
