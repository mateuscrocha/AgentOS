# Plano de Piloto — Verd Sucos

## Objetivo

Reduzir retrabalho manual na operação da Verd Sucos sem criar sistema grande nem aplicativo dedicado no primeiro momento.

O foco do piloto é provar que a Verd consegue transformar melhor seus registros diários em dado útil, com menos relançamento manual e mais visibilidade operacional.

## Problema a Atacar

Hoje a Verd opera com:

- pedido entrando por `WhatsApp`
- repasse manual para produção
- ficha física de produção
- planilhas de compras e produção
- lançamento posterior em `Conta Azul`

O problema principal não parece ser ausência de controle. O problema é `fragmentação + retrabalho`.

## Hipótese do Piloto

Se a Verd conseguir capturar de forma mais simples os dados da ficha física diária e estruturar isso em uma base mínima confiável, já haverá ganho real de tempo, clareza e consistência sem precisar construir um sistema completo.

## Escopo Recomendado

### Fase 1 — Entendimento do fluxo real

Levantar:

- como o pedido entra
- quem registra
- como a produção recebe
- como a ficha física é preenchida
- quando a foto é tirada
- quem lança em planilha
- o que vai para o Conta Azul

Saída esperada:

- mapa simples do processo atual
- lista dos pontos de duplicidade
- definição do dado mínimo que precisa ser capturado

### Fase 2 — Captura simples do dado

Criar um fluxo inicial de teste em que:

- a ficha diária é fotografada
- a foto é enviada para um canal único
- a informação é extraída para uma base estruturada
- alguém confere rapidamente antes de consolidar

Saída esperada:

- base diária de produção mais rápida de alimentar
- menos relançamento manual
- redução do tempo de fechamento do mês

### Fase 3 — Consolidação mínima

Com a base estruturada, gerar no mínimo:

- visão diária de produção
- visão por insumo principal
- visão por cliente/pedido
- insumo para comparação com compras e faturamento

Saída esperada:

- uma leitura operacional mínima já útil para a gestão

## O que Não Fazer Agora

- não construir aplicativo do zero
- não tentar substituir o Conta Azul
- não tentar unificar B2B, B2C, site, produção e financeiro de uma vez
- não abrir um projeto de software grande antes de validar o fluxo simples

## Entregável Inicial Recomendado

Um piloto funcional e feio, se necessário, mas que resolva:

1. entrada padronizada da ficha diária
2. estruturação básica dos dados
3. consulta simples da produção do período

## Critérios de Sucesso

- menos tempo gasto no relançamento manual
- maior facilidade para fechar o mês
- menor dependência de múltiplas planilhas paralelas
- confiança suficiente para continuar evoluindo a solução

## Perguntas que Precisam ser Respondidas

1. Quem é a pessoa certa para enviar a ficha todos os dias?
2. A ficha física atual é estável ou muda com frequência?
3. Quais campos são realmente obrigatórios no primeiro piloto?
4. O que já pode continuar no Conta Azul e o que precisa ficar fora?
5. Qual é a dor mais cara hoje:
   - perder tempo
   - errar número
   - fechar o mês atrasado
   - não ter visão de produção

## Próximo Passo Imediato

Receber do João Pedro:

- desenho do processo atual
- fotos reais da ficha
- exemplo de planilhas usadas
- amostra de como o pedido entra e vira produção
