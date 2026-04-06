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
2. Escolher o cenario principal e a persona implicita ou explicita que melhor encaixam na dor.
3. Definir os elementos que devem permanecer constantes ao longo da sequencia.
4. Decidir quais assets realmente ajudam a peça e quais seriam excesso.
5. Montar o plano com skills especialistas adequadas.
6. Entregar o roteiro operacional de produção.

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
4. Para `Stories do Instagram`, assumir como default uma sequência curta com copy por tela e produção enxuta.
5. Em `Stories`, imagem e locução só entram quando realmente ajudam a leitura; o padrão é clareza antes de produção.
6. Antes de planejar a produção, variar conscientemente o cenario em relação às sequências recentes.
7. Sempre que possível, conectar o cenario escolhido a uma persona oficial e a uma dor real da biblioteca do Boris.
8. Dentro da mesma sequencia, garantir coerencia de personagem, ambiente, atmosfera e historia principal.
9. So mudar de ambiente ou universo visual se a transicao fizer parte da narrativa e estiver clara.
10. Planejar cada tela com funcao narrativa diferente para evitar repeticao de frase e de papel dramatúrgico.
11. Em Stories, validar formato vertical 9:16 antes de entregar a peça como pronta.
12. Quando a sequência depender da mesma cena, preferir fluxo com `tela âncora` + derivações coerentes.
13. Se a geração base não sair no tamanho final de Story, compor a entrega em canvas final `1080x1920`.
