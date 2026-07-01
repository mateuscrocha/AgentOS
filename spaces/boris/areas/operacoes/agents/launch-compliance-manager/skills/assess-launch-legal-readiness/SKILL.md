---
name: assess-launch-legal-readiness
description: Avalia o que o Bóris precisa para entrar no ar com base mínima séria de LGPD, transparência, termos de uso, política de privacidade e resposta a incidentes
agent: launch-compliance-manager
project: boris
version: 1.0
created: 2026-07-01
---

# Skill: assess-launch-legal-readiness

## O que esta skill faz

Transforma uma ideia genérica de "precisamos estar juridicamente ok para lançar" em um diagnóstico prático e priorizado para o Bóris.

Ela cobre principalmente:

- LGPD aplicada ao produto e à operação
- política de privacidade e transparência
- termos de uso
- cookies e tecnologias de rastreamento
- atendimento a direitos do titular
- retenção, exclusão e segurança
- resposta a incidente
- lacunas contratuais com terceiros e fornecedores

## Quando usar

- quando o Bóris estiver perto de entrar no ar
- quando houver dúvida sobre o mínimo necessário para lançar sem descuido jurídico básico
- quando for preciso revisar coleta de dados, consentimento, cadastro, analytics, CRM, suporte ou integrações
- quando o produto precisar de um plano de adequação pragmático antes de envolver advogado externo

## Antes de agir

Leia `references/lgpd-launch-baseline.md`.

Se o pedido envolver setor regulado, dados sensíveis, menores, saúde, biometria, crédito, decisões automatizadas relevantes, compartilhamento amplo com clientes ou transferência internacional relevante, trate como risco elevado e explicite a necessidade de revisão jurídica especializada.

## Processo

1. Mapear rapidamente o produto e os pontos de coleta.
2. Identificar quais dados pessoais entram em cada fluxo, para qual finalidade e com qual base operacional provável.
3. Verificar a existência ou ausência de:
   - política de privacidade
   - termos de uso
   - aviso ou banner de cookies, se aplicável
   - canal para titular
   - rotina de retenção e exclusão
   - resposta a incidente
   - revisão de terceiros e operadores
4. Classificar cada lacuna em:
   - bloqueador de lançamento
   - alto
   - médio
   - baixo
5. Montar um plano enxuto em três faixas:
   - antes do go-live
   - D+30
   - D+60 ou melhoria contínua

## Checklist mínimo de saída

O diagnóstico final deve checar, no mínimo:

- quais dados o Bóris coleta e por quê
- onde os dados entram, ficam e saem
- quais terceiros processam dados em nome do Bóris
- qual documento público precisa existir no site ou app
- qual canal vai receber pedidos de titulares
- como o Bóris apaga, corrige e exporta dados quando necessário
- quem responde por incidente e qual é o primeiro fluxo de contenção
- o que não pode ir para produção antes de ajuste

## Inputs

- `$ARGUMENTS`: contexto do produto, fluxos do site/app, cadastro, integrações, analytics, CRM, suporte, cobrança, autenticação, uso de IA e preocupações do momento

## Outputs

Entregar um parecer prático com:

- resumo executivo de prontidão
- mapa resumido de dados e finalidades
- lacunas encontradas
- prioridade por risco
- checklist de go-live
- backlog D+30 e D+60
- pontos que precisam de advogado

## Regras

1. Não presumir que consentimento resolve tudo; verificar sempre finalidade e necessidade real.
2. Não sugerir coleta de dados "por precaução".
3. Diferenciar documento público, controle interno e obrigação contratual com terceiros.
4. Quando houver cookie não essencial, analytics, remarketing ou personalização comportamental, avaliar banner, preferência e transparência com mais rigor.
5. Quando faltar fato crítico, registrar a suposição usada.
6. Sempre mencionar que a skill organiza prontidão e risco, mas não substitui aconselhamento jurídico formal.
