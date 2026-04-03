---
name: design-dashboard-surface
description: Define superfícies de dashboard e painel do Boris com foco em leitura e ação
agent: product-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: design-dashboard-surface

## O que esta skill faz

Estrutura dashboards, painéis e superfícies operacionais do Boris para expor sinal útil, leitura rápida e ação clara.

## Quando usar

- quando for preciso desenhar ou revisar um dashboard, admin ou painel do Boris
- quando uma superfície precisar sair de “lista de dados” e virar leitura operacional

## Processo

1. Definir quem usa o painel e qual decisão precisa tomar.
2. Escolher sinais, métricas e estados realmente úteis para essa decisão.
3. Organizar hierarquia da superfície em leitura principal, leitura secundária e ações.
4. Entregar a estrutura recomendada com racional de uso.

## Inputs

- `$ARGUMENTS`: tipo de painel, usuário principal, decisão esperada, sinais disponíveis e problema atual da interface

## Outputs

Estrutura de superfície com:
- usuário-alvo
- decisão principal
- hierarquia de informação
- blocos recomendados
- ações prioritárias

## Regras

1. Dashboard do Boris deve ajudar a decidir, não só mostrar número.
2. Atividade não é engajamento; escolher sinal útil em vez de volume bruto.
3. Se a métrica não for confiável ou acionável, ela não deve liderar a superfície.
