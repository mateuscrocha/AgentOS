---
name: plan-cabeca-fria-production
description: Organiza a producao multimodal de cabeca fria usando a biblioteca especialista do Boris
agent: editorial-strategist
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: plan-cabeca-fria-production

## O que esta skill faz

Transforma uma ideia de `cabeça fria` em plano de produção multimodal, definindo se a peça precisa só de copy, ou também de imagem, locução, adaptação por canal e assets de apoio.

## Quando usar

- quando uma peça de `cabeça fria` precisar seguir para produção real
- quando houver dúvida sobre se a saída deve ser Stories, post, carrossel, vídeo ou peça com locução

## Processo

1. Definir o problema central, a leitura e o CTA.
2. Decidir quais assets realmente ajudam a peça e quais seriam excesso.
3. Montar o plano com skills especialistas adequadas.
4. Entregar o roteiro operacional de produção.

## Inputs

- `$ARGUMENTS`: problema central, canal, formato, necessidade de imagem, necessidade de áudio e CTA desejado

## Outputs

Plano de produção com:
- tese editorial
- assets necessários
- skills a acionar
- checklist de execução
- observação de formato por canal

## Regras

1. `Cabeça fria` deve priorizar clareza e não inflar produção sem necessidade.
2. Áudio só entra quando realmente aumenta entendimento ou faz parte do formato.
3. Para peças multietapa ou com muitos assets, preferir roteamento via `boris-content-orchestrator`.
