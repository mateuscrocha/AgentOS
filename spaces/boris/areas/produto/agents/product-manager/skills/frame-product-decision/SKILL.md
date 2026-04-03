---
name: frame-product-decision
description: Enquadra decisões de produto do Boris com dor, trade-off e impacto
agent: product-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: frame-product-decision

## O que esta skill faz

Organiza uma decisão de produto do Boris em termos de dor, opções, trade-offs, risco e recomendação.

## Quando usar

- quando houver uma decisão ambígua de produto, UX, onboarding ou mensageria
- quando for preciso escolher entre caminhos com impacto diferente

## Processo

1. Definir a decisão a ser tomada e a dor principal por trás dela.
2. Mapear opções viáveis e seus trade-offs.
3. Avaliar impacto em clareza, adoção, confiança e operação.
4. Recomendar um caminho com justificativa clara.

## Inputs

- `$ARGUMENTS`: decisão em aberto, contexto, opções conhecidas, usuários afetados e restrições

## Outputs

Enquadramento de decisão com:
- problema
- opções
- trade-offs
- impacto esperado
- recomendação

## Regras

1. Toda decisão deve ser legível em termos de dor e impacto, não só preferência.
2. Escolha simples e operacional vence escolha sofisticada mas difícil de sustentar.
3. Sempre explicitar o que se ganha e o que se perde.
