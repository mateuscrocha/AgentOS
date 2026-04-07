# Pipeline Oficial do Boris

## Objetivo

Definir a leitura oficial de pipeline do Boris para uso dentro do AgentOS e alinhamento com o CRM do painel.

## Fonte Principal

O pipeline oficial deve seguir o CRM atual do painel do Boris.

## Estagios Oficiais

- `new_lead`
- `meeting`
- `proposal`
- `approval_pending`
- `customer`
- `lost`

## Interpretacao Operacional

### `new_lead`

- conta nova
- lead ainda em contato inicial ou inicio de conversa
- pode incluir casos em que houve primeiro toque, mas ainda sem avancar de verdade

### `meeting`

- conta ja em conversa comercial real
- inclui qualificacao, descoberta, demo, conversa marcada e follow-up ativo
- no modelo atual, `qualification` e tratado operacionalmente como `meeting`

### `proposal`

- proposta enviada ou proposta em montagem final com sinal claro de avancar

### `approval_pending`

- decisao interna do cliente em espera
- depende de aprovacao, validacao financeira ou alinhamento interno

### `customer`

- cliente ativo ou conta comercialmente convertida

### `lost`

- perdido, pausado sem tese forte de retomada ou inativo

## Traducao do Legado para o Pipeline Oficial

- `mapeado` -> `new_lead`
- `abordar` -> `new_lead`
- `abordado` -> `new_lead` ou `meeting`, dependendo da resposta
- `respondeu` -> `meeting`
- `qualificado` -> `meeting`
- `conversa-marcada` -> `meeting`
- `proposta` -> `proposal`
- `follow-up` -> normalmente `meeting`, ou `approval_pending` quando ja houver proposta e decisao em espera
- `fechado` -> `customer`
- `pausado` -> `lost` ou manutencao fora do CRM ativo
- `sem-fit` -> `lost`

## Regra de Operacao

- o CRM do painel e a fonte oficial do dia a dia
- a base legado e reservatorio de migracao e reativacao
- sempre registrar `next_step` e, quando possivel, `next_action_at`
- evitar multiplicar micro-estagios fora do pipeline oficial
- toda decisao comercial deve considerar tambem o contexto metodologico herdado da Enkrateia quando houver material relevante
- mensagens e follow-ups em WhatsApp devem preferir a skill `evolution-whatsapp-sender`
- a operacao deve distinguir claramente:
- campanha ativa sobre base legado
- entradas novas por WhatsApp, indicacao, site e canais equivalentes
- transcricoes de reuniao Loom devem ser tratadas como eventos de intake e reconciliadas com CRM + AgentOS antes de qualquer acao
