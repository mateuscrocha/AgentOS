---
name: produce-youtube-boris-assets
description: Transforma materiais brutos de um vídeo do Loom em pacote de publicação do Bóris, com descrição e títulos para YouTube, adaptação para LinkedIn, brief de thumbnail e roteamento para geração da imagem.
agent: editorial-strategist
project: boris
version: 1.1
created: 2026-05-13
---

# Skill: produce-youtube-boris-assets

## O que esta skill faz

Transforma o material bruto de um vídeo do Loom em um pacote de publicação do Bóris.

Ela organiza o episódio como `post`, reaproveita a base editorial já existente e prepara:

- descrição final do vídeo
- opções de título
- capítulos quando fizer sentido
- adaptação do episódio para LinkedIn
- CTA e links placeholders
- brief e prompt de thumbnail
- encaminhamento para geração da imagem final

## Quando usar

- quando o usuário enviar transcrição, summary, legendas ou vídeo bruto de um episódio
- quando o usuário quiser publicar um vídeo longo do Bóris no YouTube
- quando o pedido envolver descrição do vídeo, adaptação para LinkedIn e thumbnail no mesmo fluxo
- quando os arquivos chegarem em etapas e precisarem ser consolidados na mesma pasta-fonte

## Inputs

- `$ARGUMENTS`: tema do episódio, objetivo do vídeo, CTA desejado e contexto extra
- arquivos do Loom, quando existirem:
  - summary
  - transcript
  - legendas (`.srt`, `.vtt` ou similar)
  - vídeo exportado
  - frames ou screenshots de apoio

## Processo

1. Ler `spaces/boris/resources/content/agente-boris-conteudo.md`.
2. Ler `spaces/boris/resources/content/manual-operacao-editorial-boris.md`.
3. Ler `spaces/boris/resources/content/strategy/published-topics-registry.md` para verificar repetição de dor, tese e ângulo.
4. Tratar o episódio como `post` e criar ou reutilizar uma pasta em `spaces/boris/resources/content/producao/posts/YYYY-MM-DD-youtube-slug`.
5. Consolidar as fontes do Loom nesta ordem de confiança:
   - transcript
   - vídeo
   - legendas
   - summary
6. Definir uma tese central, uma dor principal e a linha editorial dominante do episódio.
7. Identificar:
   - a promessa real do vídeo
   - a melhor prova visual
   - o trecho que mais sustenta a thumbnail
   - o CTA natural para o fim da descrição
8. Preencher `07-youtube-package.md` com:
   - contexto do episódio
   - 3 opções de título
   - descrição final pronta para publicação
   - capítulos, se houver material suficiente
   - CTA final
   - observações de publicação
9. Preencher `02-copy.md` com:
   - CTA curto do episódio
   - adaptação para LinkedIn em tom de fundador, produto e operação
   - versão curta para WhatsApp quando fizer sentido
10. Preencher `08-thumbnail-brief.md` com:
   - conceito visual
   - enquadramento
   - elementos obrigatórios
   - elementos proibidos
   - texto curto da thumbnail, se realmente necessário
   - prompt final para execução
11. Registrar ou atualizar o episódio em `spaces/boris/resources/content/strategy/published-topics-registry.md` com `status`, `canal`, `tese`, `dor_principal`, `angulo` e `arquivo-fonte`.
12. Se o usuário pedir a imagem final, rotear para:
   - `boris-image-agent` para direção visual e consistência
   - `boris-image-kit` se a thumb for formato recorrente
   - `imagegen` para gerar ou editar o arquivo final
13. Se novos arquivos chegarem depois, atualizar a mesma pasta em vez de criar outra.

## Outputs

Pacote de publicação com:

- descrição do YouTube pronta
- opções de título
- capítulos opcionais
- copy derivada para LinkedIn
- brief de thumbnail
- prompt final de thumbnail
- checklist do que ainda falta para publicar

## Regras

1. Todo episódio deve nascer de uma dor real do ecossistema Bóris, nunca de hype sobre IA.
2. A descrição deve soar como fundador explicando algo que viveu na prática, não como texto de SEO genérico.
3. Se summary e transcript divergirem, priorizar transcript e vídeo.
4. Não inventar funcionalidades, resultados ou promessas que não estejam demonstrados no material.
5. A thumbnail deve vender uma ideia clara, não um monte de elementos pequenos.
6. Se o vídeo mostrar painel, operação ou fluxo real, preferir esse concreto visual à metáfora genérica de tecnologia.
7. Manter português do Brasil em toda a copy e preservar a grafia `Bóris`.
8. Se o usuário estiver criando uma série, preservar a linha editorial da série e variar o ângulo de cada episódio para não parecer repetição.
9. A versão de LinkedIn deve soar como observação vivida de fundador, não como resumo mecânico do vídeo.
10. A adaptação para LinkedIn deve priorizar tese, contraste e leitura operacional, e não depender de o leitor assistir ao vídeo para fazer sentido.
11. Todo episódio novo deve ser comparado com o registro de temas publicados antes de assumir que é realmente novo.
