---
name: qualify-lead
description: Qualifica leads do Boris com lógica simples de dor, fit, urgência e próximo passo
agent: sales-operator
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: qualify-lead

## O que esta skill faz

Estrutura a leitura de um lead do Boris para decidir fit, estágio, trilho comercial, mensagem adequada e próximo passo mais claro.

## Quando usar

- quando um lead novo entra na base ou responde ao outbound
- quando for preciso decidir se a oportunidade vai para qualificação, reunião, trial ou pausa

## Processo

1. Identificar contexto do lead: tipo de operação, quantidade de grupos, momento da conversa e dor aparente.
2. Mapear a dor principal e verificar fit com Boris sem complicar o funil.
3. Definir trilho (`caixa rápido` ou `conta estratégica`), estágio atual e próximo passo recomendado.
4. Gerar uma saída prática com leitura do lead, mensagem sugerida e atualização de CRM em linguagem simples.

## Inputs

- `$ARGUMENTS`: descrição do lead, contexto da conversa, respostas recebidas, dor percebida e qualquer informação de CRM já existente

## Outputs

Classificação do lead com:
- dor principal
- nível de fit
- trilho comercial
- estágio recomendado
- próximo passo
- mensagem sugerida para avançar

## Regras

1. Qualificar pelo problema real e pela clareza do próximo passo, não por excesso de critérios abstratos.
2. Se houver resposta do lead, priorizar avanço para conversa manual ou reunião curta em vez de seguir roteiros rígidos.
3. Se o lead não demonstrar fit claro, explicar por que pausar é melhor do que forçar pipeline.
