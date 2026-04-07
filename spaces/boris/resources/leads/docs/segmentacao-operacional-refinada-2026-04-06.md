# Segmentacao operacional refinada

Data: 2026-04-06
Bases usadas:
- `data/segments/follow_up_prioritario_priorizado.csv`
- `data/segments/reativacao_nao_pagos.csv`
- cruzamento com admins/managers da base antiga em `tmp/boris_leads_quentes_cruzamento_grupos_antigos.csv`

## Diagnostico
- A divisao antiga `P1/P2/P3` ajuda no texto e na ordem basica, mas nao separa bem quem ja tem prova operacional real de uso de grupo.
- O cruzamento com a base antiga mostrou que alguns leads quentes tambem sao admins/managers/superadmins de grupos, inclusive em grupos `PAID`.
- Para follow-up comercial do Boris, esse sinal vale mais do que prioridade antiga isolada.

## Nova estrutura recomendada
- `R1_reativacao_quente_estrategica`: 8 leads
  Leads de reativacao com match em grupo antigo forte: pelo menos 1 grupo `PAID` ou 2+ grupos cruzados. Deve entrar primeiro na rodada manual.
- `R2_follow_up_quente_com_prova`: 5 leads
  Leads do follow-up prioritario, especialmente ex-`P1`, com prova operacional em grupos. Sao quase tao quentes quanto reativacao.
- `R3_reativacao_manual`: 12 leads
  Reativacao de nao pagos sem prova tao forte de grupo, mas ainda com historico comercial claro. Continuam acima do follow-up comum.
- `R4_follow_up_manual_prioritario`: 141 leads
  Ex-`P1` sem cruzamento forte. Mantem contato manual, mas com menos customizacao profunda.
- `R5_follow_up_manual_contextual`: 298 leads
  Ex-`P2`. Pode rodar em lote curado ou segunda onda manual.
- `R6_cauda_baixa_prioridade`: 3 leads
  Cauda residual. Nao deve disputar tempo com os buckets acima.

## Ordem de execucao sugerida para amanha
1. R1 pela manha, com mensagem contextual e tentativa de resposta curta.
2. R2 ainda no mesmo bloco, aproveitando contexto de grupo e prova de uso.
3. R3 como segunda frente manual.
4. R4 se sobrar capacidade manual no dia.
5. R5 apenas em lote curado ou no dia seguinte.
6. R6 fica fora da rodada curta.

## Regra pratica de mensagem
- `R1` e `R2`: mencionar contexto de grupo/comunidade e falar como retomada concreta, nao como cold outbound.
- `R3`: retomada consultiva com foco em proposta pendente ou timing.
- `R4`: follow-up curto e direto, pedindo resposta simples.
- `R5`: texto mais neutro, pouco tempo investido por lead.

## Arquivo operacional
- Nova base ordenada: `tmp/boris_segmentacao_operacional_refinada.csv`

## Top exemplos por bucket
### R1_reativacao_quente_estrategica
- BL-00222 | (sem nome) | score=138 | contexto=AI ALLIANCE COMMUNITY
- BL-00702 | ADS GROUP - TRÁFEGO PAGO | score=123 | contexto=ADS GROUP - TRÁFEGO PAGO
- BL-01736 | Marilza Schausse | score=114 | contexto=ADM NALUUM Thaynara 01/10/24 a 01/10/25
- BL-01777 | (sem nome) | score=111 | contexto=Árvore Dos Saberes - Eletrônica e Hardware
- BL-01782 | Alessandra | score=111 | contexto=ACESSO TOTAL - Alunos
### R2_follow_up_quente_com_prova
- BL-00161 | Ihv Lucas Dantas | score=121 | contexto=! [TIRA DÚVIDAS] Magnetic Flows Lucas Dantas | Base Antiga do Bóris
- BL-00245 | cdg Li Saito | score=110 | contexto=! Comunidade B2Mamy Li Saito | Base Antiga do Bóris
- BL-01129 | de MarketingFelipe Bedin | score=103 | contexto=Inteligência Artificial | Tecnologia | Ferramentas de MarketingFelipe Bedin | Base Antiga do Bóris
- BL-00559 | mkgj Felipe Lucarelli | score=100 | contexto=T11 Mentoria Arrematador Felipe Lucarelli | Base Antiga do Bóris
- BL-00841 | Jefferson Cabral | score=91 | contexto=CBVAA - Casca Grossa Jefferson Cabral | Base Antiga do Bóris
### R3_reativacao_manual
- BL-00198 | (sem nome) | score=78 | contexto=AVanguarda
- BL-01098 | (sem nome) | score=78 | contexto=🔥 AQUECIMENTO DE CHIP WHATSAPP
- BL-01119 | (sem nome) | score=78 | contexto=AGORA notícias 70
- BL-01830 | (sem nome) | score=78 | contexto=ALERTA DE VÔOS - MANAUS 🎟️✈️🤑
- BL-01114 | Agora no vale Notícias | score=78 | contexto=AGORA notícias 70
### R4_follow_up_manual_prioritario
- BL-00308 | Giovanne Saraiva | score=58 | contexto=Hunters Black ® Giovanne Saraiva | Base Antiga do Bóris
- BL-00766 | Jwx Daniel Escaleira | score=58 | contexto=Liderança Daniel Escaleira | Base Antiga do Bóris
- BL-01404 | Rocha Denis Rocha | score=58 | contexto=! Só Cruz Rocha Denis Rocha | Base Antiga do Bóris
- BL-00818 | hWtaNfbd Ighor Miranda | score=58 | contexto=UP INSURANCE AGENCY - Liga do Marketing Ighor Miranda | Base Antiga do Bóris
- BL-00268 | m Fabiola Oliveira | score=58 | contexto=Comissão de Eventos SA🎉 Fabiola Oliveira | Base Antiga do Bóris