---
name: plan-cabeca-quente-production
description: Organiza a producao multimodal de cabeca quente usando a biblioteca especialista do Boris
agent: editorial-strategist
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: plan-cabeca-quente-production

## O que esta skill faz

Transforma uma ideia de `cabeça quente` em plano de produção multimodal, definindo o que vai para roteiro, imagem, áudio e asset final de CTA, além de indicar quais skills especialistas devem entrar.

## Quando usar

- quando uma peça de `cabeça quente` precisar sair do nível editorial e virar produção real
- quando houver dúvida sobre como distribuir a execução entre estratégia, imagem, áudio e orquestração

## Processo

1. Definir a dor, a persona, a resposta do Boris e o CTA.
2. Decidir se a peça pede apenas roteiro ou também imagem, locução e asset final.
3. Montar o plano de produção com arquivos esperados e skills a acionar.
4. Entregar o roteamento pronto para execução.

## Inputs

- `$ARGUMENTS`: dor principal, persona, canal, formato, necessidade de imagem, necessidade de áudio e CTA desejado

## Outputs

Plano de produção com:
- tese editorial
- componentes necessários
- skills a acionar
- checklist de assets
- observação de coerência entre persona visual e sonora

## Regras

1. `Cabeça quente` multimodal deve preservar coerência entre dor, imagem e voz.
2. Se houver imagem e áudio, a persona deve ser resolvida antes da execução.
3. Quando houver mais de um asset, preferir roteamento via `boris-content-orchestrator`.
4. Se o usuario pedir para `gerar uma peça` de `cabeça quente`, assumir por padrao pacote completo:
   - imagem principal
   - imagem de CTA
   - audio da persona
   - audio do Boris
5. So reduzir a entrega quando o usuario pedir explicitamente uma versao parcial.
