---
name: run-weekly-ops
description: Estrutura a cadência semanal do Boris com foco em acompanhamento e destravamento
agent: operations-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: run-weekly-ops

## O que esta skill faz

Organiza a operação semanal do Boris com visão de prioridades, pendências, bloqueios, responsáveis e próximos passos.

## Quando usar

- quando for preciso rodar uma reunião semanal ou checkpoint operacional do Boris
- quando a execução estiver dispersa e precisar de reconcentração

## Processo

1. Levantar as frentes ativas por área.
2. Separar o que está em andamento, travado, atrasado ou sem dono claro.
3. Definir foco da semana, decisões pendentes e próximos passos.
4. Entregar uma visão operacional simples para acompanhamento.

## Inputs

- `$ARGUMENTS`: resumo da semana, frentes ativas, entregas pendentes, áreas envolvidas, bloqueios e objetivos imediatos

## Outputs

Resumo semanal operacional com:
- prioridades
- itens em risco
- bloqueios
- responsáveis
- próximos passos da semana

## Regras

1. O objetivo é destravar execução, não produzir relatório bonito.
2. Se algo estiver sem dono, isso deve aparecer explicitamente.
3. Priorizar poucas frentes críticas em vez de listar tudo no mesmo nível.
