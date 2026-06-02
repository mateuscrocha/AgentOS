---
name: run-live-show-flow
description: Prepara a execução da transmissão com roteiro de host, checklist de live e desdobramentos pós-evento
agent: youtube-live-producer
project: boris
version: 1.0
created: 2026-05-19
---

# Skill: run-live-show-flow

## O que esta skill faz

Converte o briefing e o pacote de publicação em execução prática de live. Organiza abertura, condução, quadros, CTA ao vivo, checklist técnico e próximos passos depois da transmissão.

## Quando usar

- quando a live já foi definida e precisa ficar pronta para ir ao ar
- quando for necessário padronizar a operação da série ao vivo
- quando o usuário quiser reduzir improviso operacional durante a transmissão

## Processo

1. Montar o roteiro do host com abertura, apresentação do convidado, transições, perguntas-chave, CTA e encerramento.
2. Definir uma checklist pré-live com arte, links, estúdio, conexão, áudio, comentários e materiais de apoio.
3. Organizar pontos de atenção para o durante, incluindo leitura de chat, momentos de demonstração e retomada caso a conversa disperse.
4. Fechar com checklist pós-live para corte, reaproveitamento, follow-up com convidado e documentação do episódio.
5. Se a série estiver recorrente, capturar o que deve virar padrão da operação.

## Inputs

- `$ARGUMENTS`: briefing do episódio, pacote de publicação, duração estimada, formato da live, links e qualquer restrição operacional

## Outputs

Plano operacional de transmissão com:
- roteiro do host
- checklist pré-live
- checkpoints durante a transmissão
- checklist pós-live
- pontos padronizáveis da série

## Regras

1. O roteiro deve guiar a conversa sem engessar o convidado.
2. A checklist precisa ser executável em ambiente real, não apenas conceitual.
3. Sempre prever CTA no meio e no final da live.
4. O pós-live deve considerar reaproveitamento de conteúdo e relacionamento com o convidado.
