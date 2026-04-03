---
name: prioritize-roadmap
description: Prioriza roadmap do Boris com base em dor, impacto e simplicidade operacional
agent: product-manager
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: prioritize-roadmap

## O que esta skill faz

Organiza prioridades de roadmap do Boris com foco em dor real, impacto para operação e clareza de decisão.

## Quando usar

- quando houver muitas frentes de produto concorrendo ao mesmo tempo
- quando for preciso decidir o que entra agora, depois ou sai do foco

## Processo

1. Listar frentes candidatas e a dor principal de cada uma.
2. Comparar impacto, urgência, adoção, confiança no dado e simplicidade de entrega.
3. Separar o que merece prioridade, espera ou descarte.
4. Entregar uma ordem de prioridade com rationale claro.

## Inputs

- `$ARGUMENTS`: lista de frentes, dores associadas, contexto atual do produto, pressão comercial ou operacional e restrições

## Outputs

Prioridade de roadmap com:
- itens prioritários
- itens secundários
- itens fora de foco
- rationale por item

## Regras

1. Prioridade deve seguir dor real e impacto operacional, não volume de opinião.
2. Evitar roadmap inchado e sem consequência prática.
3. Quando houver dúvida, preferir aquilo que aumenta clareza e confiança de leitura para o usuário.
