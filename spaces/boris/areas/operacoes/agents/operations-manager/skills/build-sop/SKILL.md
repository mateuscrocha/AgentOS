---
name: build-sop
description: Cria SOPs e checklists operacionais do Boris com dono, etapa e critério de conclusão
agent: operations-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: build-sop

## O que esta skill faz

Transforma uma rotina, processo ou operação recorrente do Boris em um SOP claro, com etapas, responsáveis, gatilhos, handoffs e critério de conclusão.

## Quando usar

- quando um processo do Boris estiver informal, inconsistente ou dependente demais de memória humana
- quando for preciso criar checklist operacional para comercial, conteúdo, suporte ou produto

## Processo

1. Identificar o objetivo do processo, quem participa e onde hoje existe ruído.
2. Mapear etapas, dono, gatilho de entrada, handoff e saída esperada.
3. Organizar o SOP em ordem prática, sem excesso de burocracia.
4. Entregar checklist ou playbook utilizável no dia a dia.

## Inputs

- `$ARGUMENTS`: descrição da rotina, área envolvida, pessoas ou agentes participantes, problema atual e resultado esperado

## Outputs

SOP operacional com:
- objetivo
- responsáveis
- etapas
- handoffs
- checklist
- critério de conclusão

## Regras

1. Todo SOP deve deixar claro quem faz o quê, quando e com qual critério de término.
2. Se o processo estiver complexo demais, simplificar antes de documentar.
3. O SOP deve ajudar execução real, não parecer documentação morta.
