---
name: audit-docs
description: Audita a documentação existente para completude e acurácia contra o estado atual do sistema
agent: doc-manager
version: 1.0
created: 2026-03-20
---

# Skill: audit-docs

## O que esta skill faz

Compara a documentação existente em `docs/` com o estado real do sistema e produz um relatório de discrepâncias.

## Quando usar

- Quando o usuário quer saber se a documentação está atualizada
- Após mudanças no sistema (novos agentes, skills, protocolos)
- Antes de gerar o README, para garantir que os docs estão corretos

## Inputs

Nenhum obrigatório.

## Processo

1. **Ler doc-registry.md** — Obter lista de docs existentes

2. **Ler estado atual do sistema** — Mesmas fontes de `generate-docs`:
   - `CLAUDE.md`, `world.md`, `registry.md`, `skill-registry.md`, `memory-map.md`, `team-registry.md`
   - Todos os `AGENT.md`, todos os protocolos

3. **Para cada doc esperado**, verificar:
   - O arquivo existe em `docs/`?
   - O conteúdo menciona todos os itens relevantes do sistema?
   - Há referências a itens que não existem mais?
   - Faltam seções esperadas?

4. **Produzir relatório** com:
   - Status por arquivo: `Atualizado` / `Desatualizado` / `Ausente`
   - Discrepâncias específicas encontradas
   - Ações recomendadas

5. **Exibir relatório** ao usuário

6. **Registrar evento** — Adicionar `docs.audited` em `system/memory/bus.md`

7. **Atualizar history.md** — Registrar a ação

## Output

- Relatório de auditoria (exibido ao usuário)
- Evento registrado no bus

## Regras

1. Comparar contra o estado REAL, não contra o doc-registry
2. Ser específico nas discrepâncias (ex: "agente X não mencionado em system-agents.md")
3. Não modificar docs automaticamente — apenas reportar
4. Sugerir `generate-docs` quando há muitas discrepâncias
