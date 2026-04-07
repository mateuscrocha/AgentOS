# Reunião — Bilheteria Digital

## Identificação

- data: `2026-04-06`
- conta: `Bilheteria Digital`
- participantes: `Mateus Rocha`, `Guilherme Marra`, `Matheus Prado`
- tipo: `reunião de descoberta e desenho de piloto`
- status: `consolidada`

## Contexto

A Bilheteria Digital opera atendimento em escala via WhatsApp e usa o DigiSAC como ferramenta de fila e distribuição. A necessidade central da reunião foi validar o quanto o Bóris já está maduro para apoiar leitura de qualidade de atendimento, pendências reais, consolidado gerencial e inteligência operacional sem interferir na naturalidade dos grupos.

## Dor Principal

- medir qualidade do atendimento, não só tempo ou SLA
- reduzir dependência de leitura manual e exportações operacionais
- consolidar visão gerencial por grupo, cliente, atendente e período
- identificar grupos sem resposta a partir do contexto da conversa
- gerar inteligência útil para gestão interna e para o produtor

## Contexto Operacional Compartilhado

- operação `100% WhatsApp`
- uso atual de `DigiSAC`
- mais de `800` grupos no universo total
- recorte de março/2026:
- `10.361` chamados totais
- cerca de `7` a `8 mil` chamados limpos por mês
- `74.576` mensagens no mês
- `665` contatos únicos no período citado
- histórico acumulado acima de `3 milhões` de mensagens

## O Que Fez Sentido Para a Conta

- leitura de qualidade de atendimento por contexto, não só por ticket
- detecção de grupos sem resposta com base em quem está configurado como equipe de atendimento
- diário e consolidado curado por grupo
- possibilidade de panorama executivo por organização
- uso em modo silencioso `spy`, sem atrapalhar a operação
- potencial de valor também para o produtor, não só para gestão interna

## Restrições e Cuidados

- não faz sentido colocar em `100%` da base
- volume alto exige proposta e arquitetura de custo customizadas
- cuidado com automação excessiva e perda de naturalidade
- produto precisa ajudar sem poluir o grupo
- necessidade potencial de exportação ou compilação posterior

## Hipótese de Piloto Acordada

- iniciar com `5` grupos
- operar em modo silencioso `spy`
- escolher grupos de `3` segmentos diferentes para comparar comportamento:
- suporte / ponto de venda
- produção
- operação interna
- liberar acesso ao painel para avaliação do time da BD
- revisar a experiência em nova reunião na semana seguinte

## Perguntas e Sinais Importantes

- a BD quer entender qualidade e não apenas tempo de resposta
- há interesse em descobrir também grupos inativos ou sem mensagem há muitos dias
- o time quer observar se faz sentido depois consolidar períodos como `15 dias` ou `mês`
- existe abertura para futura entrega de resumos ao produtor, mas isso não deve ser prioridade agora
- o time entende que a ferramenta pode ser valiosa para contas mais críticas e estratégicas

## Encaminhamentos Combinados

1. Guilherme Marra vai indicar a lista inicial de grupos para teste.
2. Mateus Rocha vai cadastrar a conta e inserir o Bóris nos grupos selecionados.
3. O piloto começa em modo silencioso, sem envio de resumo no grupo.
4. A BD recebe acesso ao painel para acompanhar os grupos.
5. As partes voltam a se falar na semana seguinte para revisar aprendizados, dúvidas e possíveis ajustes.
6. Depois do teste, a proposta comercial será desenhada com base em volume, uso real e necessidade da conta.

## Atualização Pós-Reunião

- em `2026-04-06 17:57`, Guilherme Marra sinalizou que a BD precisa formalizar um `NDA` antes de avançar, porque a ferramenta terá acesso a informações sensíveis da operação e de clientes
- Mateus Rocha respondeu positivamente e sem objeção
- isso transforma a formalização de confidencialidade em pré-requisito prático para o início do piloto

## Leitura Comercial

- tratar como piloto orientado por operação, não como demo genérica
- argumento principal é `inteligência operacional de atendimento`
- conta demonstra dor real, volume relevante e maturidade para co-desenhar KPIs
- potencial de expansão existe, mas só depois de prova controlada

## Próxima Mensagem Recomendada no Grupo

```text
Perfeito, pessoal.

Criando o grupo para centralizarmos por aqui os próximos passos que alinhamos na call.

Seguindo o combinado, vamos começar com um piloto em alguns grupos da Bilheteria Digital, inicialmente em modo silencioso, para avaliarmos a leitura do Bóris sobre contexto, qualidade do atendimento, grupos sem resposta e os insights que isso pode gerar para a operação.

Gui, quando puder, me manda por aqui a lista inicial dos grupos que vocês querem colocar nesse teste. A ideia é começarmos com um recorte enxuto, olhando segmentos diferentes, e na sequência eu faço o cadastro e libero o acesso de vocês ao painel.

Depois disso, marcamos uma nova conversa para revisar o que apareceu e ajustar os próximos passos.
```
