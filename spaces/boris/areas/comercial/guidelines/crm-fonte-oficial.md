# CRM Como Fonte Oficial

## Regra Permanente

O Twenty nao e mais parte da operacao do Bóris.

O CRM oficial agora existe dentro do painel do Bóris e deve ser tratado como unica fonte oficial da operacao comercial viva.

Sempre que houver conflito entre memoria antiga, documentos legados, scripts antigos ou referencias ao Twenty, vale esta regra:

- o Twenty esta descontinuado para o CRM do Bóris
- o painel do Bóris e a fonte oficial atual
- nao orientar operacao nova assumindo Twenty
- nao diagnosticar casos comerciais partindo do Twenty como sistema principal
- qualquer referencia ao Twenty deve ser tratada como contexto historico ou legado

## Objetivo

Formalizar que o CRM do painel do Bóris e a fonte oficial da operacao comercial viva.

Arquivos locais, memoria viva e conversa continuam importantes, mas funcionam como apoio, contexto e inteligencia operacional. O estado comercial que precisa ser acompanhado no dia a dia deve existir no CRM.

## Regra de Ouro

Toda conta que estiver em uma destas situacoes precisa existir e estar atualizada no CRM no mesmo dia:

- lead novo
- follow-up em andamento
- reuniao marcada
- proposta
- reativacao
- perda
- cliente em reabertura
- ponte estrategica com proximo passo comercial

## Campos Minimos Obrigatorios

Toda conta viva no CRM deve ter, no minimo:

- `stage`
- `commercial_priority`
- `pipeline_track`
- `next_step`

Sempre que houver data ou prazo claro, registrar tambem:

- `next_action_at`

Sempre que houver pausa ou perda, registrar tambem:

- `reactivation_status`
- `lost_reason`, quando aplicavel

## Interpretacao Operacional

### Prioridade

- `P1` = conta quente, acionavel agora, com maior peso de curto prazo
- `P2` = conta viva, relevante, mas fora do topo da fila
- `P3` = conta de cultivo, baixa urgencia ou menor clareza operacional

### Trilho

- `entrada_nova` = lead novo, inbound, WhatsApp, site ou contato novo direto
- `indicacao` = ponte quente, networking ou recomendacao
- `reativacao` = retorno de ex-cliente, quase-cliente ou conta antiga com nova leitura
- `legado` = conta herdada da base antiga ainda em organizacao ou triagem
- `expansao` = crescimento em conta ja convertida
- `institucional` = frente institucional, parceria ou venda com dinamica propria

### Reativacao

- `none` = nao e caso de reativacao
- `candidate` = reativacao viva e acionavel
- `paused` = reativacao faz sentido, mas nao agora
- `blocked` = nao deve voltar para fila sem contexto novo explicito

## Quando Atualizar

Atualizar o CRM imediatamente quando acontecer qualquer um destes eventos:

- envio de mensagem comercial relevante
- resposta do lead
- mudanca de prioridade
- definicao de proximo passo
- marcacao de reuniao
- pausa consciente
- perda
- abertura de reativacao
- surgimento de novo contato quente

## Papel Dos Outros Registros

- CRM = operacao viva
- `spaces/boris/resources/comercial/contas/` = contexto por conta, inteligencia e historico
- `spaces/boris/resources/comercial/processos/` = metodo, relatórios, lotes e contexto operacional
- `spaces/pessoal/areas/dia/memory/` = prioridade do dia, follow-ups e contexto corrente

Se uma informacao comercial importante estiver apenas em conversa ou em `.md`, ela ainda nao esta suficientemente operacionalizada.

## Regras Praticas

- conversa sem CRM = contexto em risco
- `.md` sem CRM = memoria auxiliar, nao operacao oficial
- CRM sem `next_step` = conta mal operada
- prospeccao nova so pode usar lead sem `last_contact_at`
- lead com `last_contact_at` ja nao pertence a fila de prospeccao nova; pertence a follow-up, resposta ou reativacao
- `lost` sem `lost_reason` = perda mal registrada
- reativacao sem `reactivation_status` = fila confusa

## Regra De Encerramento

Antes de considerar uma frente comercial organizada, ela precisa estar:

- criada no CRM
- com etapa correta
- com prioridade correta
- com trilho correto
- com proximo passo claro
- com bloqueio explicito quando nao puder voltar para fila
