---
name: reactivate-opportunity
description: Reativa oportunidades antigas do Boris com contexto prévio e nova leitura de valor
agent: sales-operator
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: reactivate-opportunity

## O que esta skill faz

Retoma oportunidades antigas, não-fechamentos ou contatos mornos com mensagem contextual, reenquadramento de dor e proposta de novo passo.

## Quando usar

- quando um contato antigo já conheceu o Boris mas não avançou
- quando houver base morna, ex-cliente, indicação antiga ou oportunidade parada para reabrir

## Processo

1. Recuperar o contexto antigo: dor, timing, motivo da pausa e relação prévia com Boris.
2. Identificar o melhor gatilho de reentrada: maturidade do produto, novo caso de uso, melhor fit, prova ou pilotagem seletiva.
3. Montar uma mensagem leve, relacional e concreta para reabrir a conversa.
4. Definir o novo próximo passo e o critério para insistir ou encerrar.

## Inputs

- `$ARGUMENTS`: resumo da oportunidade antiga, contexto anterior, motivo do não-fechamento e motivo atual para reativação

## Outputs

Plano de reativação com:
- ângulo de reentrada
- mensagem sugerida
- próximo passo esperado
- critério de continuidade ou encerramento

## Regras

1. Reativação deve partir do contexto antigo do lead, não de uma abertura fria e genérica.
2. Não inventar desconto, urgência ou argumento falso; a reentrada deve ser honesta.
3. Se o timing continua ruim ou o fit continua fraco, recomendar pausa com clareza.
