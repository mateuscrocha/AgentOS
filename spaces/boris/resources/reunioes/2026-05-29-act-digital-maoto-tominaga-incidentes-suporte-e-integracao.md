# Reunião — ACT Digital / Maoto Tominaga

## Identificação

- data do registro: `2026-05-29`
- data original da conversa: `2026-05-29`
- conta: `ACT Digital / Maoto Tominaga`
- participantes: `Mateus Rocha`, `Maoto Tominaga`, `Isa`, `Thaís`, `Hércules`, `Rondinelli`
- tipo: `reunião de descoberta com avaliação técnica e desenho de piloto`
- status: `consolidada a partir de transcrição`

## Contexto

Conversa com Maoto Tominaga, CEO da ACT Digital, e outras pessoas da equipe para avaliar o uso do Bóris em grupos de suporte e incidentes. A operação usa grupos separados por canal, perfil ou contexto, mas o problema central é parecido: chegam muitas mensagens de erro, problema ou reclamação operacional, e o time precisa entender o que está acontecendo, categorizar, tratar em sistemas internos e responder de volta no grupo.

## Fatos Observados

- O cliente final da operação não foi revelado por cautela, porque ainda não existe `NDA`.
- O time trabalha com grupos separados, mas a leitura principal é individual por grupo.
- O principal uso do Bóris para eles seria ajudar a:
  - entender o que está sendo reportado
  - perceber se o problema é massivo
  - identificar regiões, lojas ou canais afetados
  - resumir rapidamente o cenário
- Hoje isso exige leitura manual de mensagem por mensagem.
- Eles enxergaram valor em:
  - gráfico de pico de mensagens
  - diário e resumo do grupo
  - alertas
  - módulo de atendimento
- Foi levantada uma dor mais avançada:
  - correlacionar o mesmo erro entre grupos diferentes
- O Bóris hoje ainda não está pronto para isso de forma nativa.
- A equipe técnica perguntou sobre `API REST`, `webhook` e integração com CRM.
- A resposta foi que isso não está aberto hoje, mas pode ser adaptado, e que exportação ou envio pode ser até mais simples que consumo externo.
- O time pediu acesso para testar em grupo real ou grupo interno com volume.
- `NDA` foi explicitamente solicitado como parte do avanço.
- O `NDA` já foi enviado e devolvido assinado no mesmo dia.
- Um grupo de trabalho já foi criado para seguir com a homologação.
- O próximo passo operacional agora é definir quais grupos receberão o Bóris no piloto.

## Dores e Oportunidades Percebidas

- necessidade de detectar incidentes massivos sem leitura manual
- necessidade de consolidar mensagens parecidas que usam palavras diferentes
- necessidade de enxergar impacto por região, loja ou canal
- necessidade de integrar o Bóris ao fluxo operacional já existente
- oportunidade de transformar leitura de grupo em camada de gestão de incidente
- oportunidade de criar uma feature reaproveitável de correlação cross-group

## Sinais de Interesse

- elogio explícito à ferramenta
- pedido de acesso para navegar e testar
- interesse real em pilotar em grupo com volume
- pergunta técnica objetiva sobre integração
- abertura para trabalhar em parceria e adaptar solução
- encaminhamento prático para `NDA` e continuidade
- agilidade para devolver o `NDA` assinado
- criação imediata do grupo de trabalho

## Objeções e Cuidados

- sem `NDA`, eles evitavam abrir detalhes do cliente final
- a correlação entre grupos ainda não está resolvida
- a integração é importante para a aderência do caso
- trata-se de contexto mais sensível de incidente e suporte, então confiabilidade pesa bastante

## Leitura Comercial

- estágio provável: `piloto em preparação`
- qualidade do interesse: `alta`
- fit estratégico: `alto`
- fit de compra imediata: `alto`, condicionado à escolha dos grupos e à boa experiência inicial
- melhor ângulo de curto prazo:
  - plugar o Bóris nos grupos certos
  - escolher grupo piloto
  - mapear integração mínima
- risco principal:
  - entrar cedo demais em promessa de correlação entre grupos sem desenho técnico claro

## Próximos Passos Recomendados

1. Escolher os grupos do piloto.
2. Liberar acesso de teste.
3. Plugar o Bóris em um grupo com volume alto para validar leitura prática.
4. Entender com o time técnico se o melhor caminho é:
   - `webhook`
   - exportação
   - integração posterior
5. Mapear hipótese de produto para crise massiva e correlação entre grupos.

## Nota de Confiança

- confiança alta: dor real de operação
- confiança alta: interesse em testar
- confiança alta: avanço operacional real depois do `NDA`
- confiança média-alta: necessidade de integração
- confiança média-alta: potencial de virar caso forte de produto para suporte e incidentes
