---
name: track-published-themes
description: Lista, registra e controla os temas editoriais do Bóris que já entraram em produção ou já foram publicados, ajudando a evitar repetição de dor, tese e ângulo entre canais.
agent: editorial-strategist
project: boris
version: 1.0
created: 2026-05-15
---

# Skill: track-published-themes

## O que esta skill faz

Ajuda o agente editorial do Bóris a manter memória explícita do que já foi publicado ou já entrou em produção.

Ela usa `spaces/boris/resources/content/strategy/published-topics-registry.md` como registro central.

## Quando usar

- quando o usuário pedir para listar temas já publicados
- quando o usuário pedir controle de repetição editorial
- quando um novo episódio, post ou campanha estiver sendo iniciado
- quando for preciso saber se uma ideia já saiu, já foi desdobrada ou ainda está livre

## Processo

1. Ler `spaces/boris/resources/content/strategy/published-topics-registry.md`.
2. Se o pedido for consulta, resumir:
   - temas já publicados
   - temas em produção
   - dores mais repetidas
   - ângulos muito próximos entre si
3. Se o pedido for novo conteúdo, comparar a nova ideia com:
   - `tema-base`
   - `tese`
   - `dor_principal`
   - `angulo`
4. Classificar a nova ideia como:
   - segura
   - repetição controlada
   - repetição arriscada
5. Se o conteúdo for aprovado ou iniciado, adicionar ou atualizar a linha no registro.
6. Quando o mesmo tema aparecer em outro canal, preservar o `topic_id` e atualizar `canal`, `status` ou `observacoes`.

## Inputs

- `$ARGUMENTS`: tema, tese, dor, canal, status, pasta-fonte, URL publicada e contexto da série

## Outputs

- lista de temas já publicados
- diagnóstico de repetição
- recomendação do próximo tema
- registro atualizado quando aplicável

## Regras

1. Não tratar como tema novo algo que só mudou de canal sem mudar a tese ou o ângulo.
2. Uma mesma dor pode reaparecer, mas não com a mesma tese e o mesmo recorte em sequência curta.
3. Quando houver repetição intencional, marcar isso como `reaproveitado` e explicar o novo ângulo.
4. Sempre manter português do Brasil e a grafia `Bóris`.
