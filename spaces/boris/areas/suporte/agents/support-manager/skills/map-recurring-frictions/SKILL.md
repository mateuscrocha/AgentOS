---
name: map-recurring-frictions
description: Mapeia fricções recorrentes do Boris para melhoria contínua
agent: support-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: map-recurring-frictions

## O que esta skill faz

Agrupa padrões de dúvida, travamento, onboarding ruim ou uso confuso do Boris para virar leitura de melhoria contínua.

## Quando usar

- quando houver vários casos parecidos surgindo no suporte
- quando for preciso transformar atendimento em aprendizado de produto e operação

## Processo

1. Levantar os casos recorrentes e o ponto comum entre eles.
2. Separar sintoma, causa provável e impacto real no usuário.
3. Identificar se a melhoria depende de suporte, produto, conteúdo ou operação.
4. Entregar o mapa de fricções com recomendação de ação.

## Inputs

- `$ARGUMENTS`: lista de casos, padrão percebido, contexto dos usuários e sinais de recorrência

## Outputs

Mapa de fricções com:
- padrão principal
- sintoma
- causa provável
- impacto
- área que deve agir
- recomendação

## Regras

1. Fricção recorrente não deve ficar escondida em tickets isolados.
2. Diferenciar sintoma de causa antes de recomendar ação.
3. Sempre sugerir o melhor destino do aprendizado dentro do Boris.
