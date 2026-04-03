---
name: plan-action
description: Analisa request do usuário e produz plano de execução passo-a-passo
agent: workflow-planner
version: 1.0
---

# Skill: plan-action

## O que esta skill faz

Recebe um request complexo do usuário e produz um plano de execução detalhado com passos atômicos, agentes responsáveis e dependências.

## Quando usar

- Quando o kernel detecta um request multi-recurso ou ambíguo
- Quando o usuário executa `/plan <descrição>`
- Quando a intenção do usuário envolve mais de 2 agentes diferentes

## Inputs

- `$REQUEST`: Descrição do que o usuário quer (pode ser vaga ou detalhada)

## Processo

1. **Entender intenção:**
   - Analisar o request do usuário
   - Identificar os recursos envolvidos (spaces, areas, agentes, times, skills)
   - Verificar se existe um template similar em `plan-templates.md`

2. **Consultar estado atual:**
   - Ler `system/agents/agent-manager/memory/registry.md` — agentes existentes
   - Ler `system/agents/skill-manager/memory/skill-registry.md` — skills existentes
   - Ler `system/agents/team-manager/memory/team-registry.md` — times existentes
   - Ler `system/memory/world.md` — estado geral

3. **Decompor em passos atômicos:**
   - Cada passo = uma chamada a um agente + skill específica
   - Determinar dependências entre passos (qual passo precisa de qual)
   - Identificar passos que podem ser paralelos

4. **Invocar skill `estimate-impact`** para listar impacto previsto

5. **Formatar plano** para apresentação:

```markdown
## Plano: {título}

### Resumo
{o que vai ser feito, em 1-2 linhas}

### Passos

| # | Agente | Skill | Ação | Depende de | Paralelo |
|---|---|---|---|---|---|
| 1 | agent-manager | create-space | Criar space "X" | — | Não |
| 2 | agent-manager | create-area | Criar area "backend" | 1 | Sim (com 3) |
| 3 | agent-manager | create-area | Criar area "frontend" | 1 | Sim (com 2) |

### Impacto Estimado
- Diretórios novos: X
- Arquivos novos: X
- Registros atualizados: X

### Aprovação
Deseja executar este plano? (sim/não)
```

6. **Apresentar ao usuário** e aguardar aprovação

7. **Se aprovado:** Informar ao kernel para encaminhar ao task-runner
   **Se rejeitado:** Ajustar conforme feedback e re-apresentar

8. **Registrar** plano em `history.md`

## Output

Plano formatado para revisão do usuário, com passos, dependências e impacto estimado.
