---
name: prepare-demo-trial
description: Estrutura reunião, demo contextual e trial seletivo de 7 dias para o Boris
agent: sales-operator
project: boris
version: 1.0
created: 2026-04-02
---

# Skill: prepare-demo-trial

## O que esta skill faz

Prepara a lógica comercial da reunião do Boris: diagnóstico curto, demonstração contextual, decisão sobre trial e encaminhamento da próxima conversa.

## Quando usar

- quando uma reunião ou demo do Boris estiver prestes a acontecer
- quando for preciso decidir se um lead deve ou não receber trial seletivo de 7 dias

## Processo

1. Ler o contexto do lead, sua dor principal, tipo de operação e grau de urgência.
2. Organizar uma reunião curta em sequência: contexto, dor, encaixe do Boris, demonstração e próximo passo.
3. Definir se trial faz sentido, com quais critérios, objetivo e condição de acompanhamento.
4. Produzir roteiro, pontos de prova, proposta de trial e mensagem de fechamento da reunião.

## Inputs

- `$ARGUMENTS`: perfil do lead, dor ativa, caso de uso, contexto da reunião, provas já disponíveis e intenção comercial

## Outputs

Pacote de preparação comercial com:
- roteiro curto de reunião
- pontos de demonstração
- critérios para trial ou não-trial
- mensagem de encerramento e próximo passo

## Regras

1. Demo do Boris deve ser contextual; mostrar uso real vale mais do que apresentação abstrata.
2. Trial não deve ser amplo nem solto; precisa ser curado, orientado e conectado à próxima reunião.
3. Se a oportunidade não justificar trial, sugerir outro caminho de avanço com honestidade.
