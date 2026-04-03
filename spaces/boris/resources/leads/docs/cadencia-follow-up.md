# Cadencia de follow-up Boris

Data: 2026-03-13
Base de origem: `data/segments/follow_up_prioritario.csv`
Base priorizada: `data/segments/follow_up_prioritario_priorizado.csv`

## Resumo da priorizacao

- `P1`: 146 leads
- `P2`: 298 leads
- `P3`: 3 leads

## Trilhas de abordagem

- `retomada_quente`: 146 leads
- `qualificacao_direta`: 298 leads
- `reativacao_leve`: 3 leads

## Como usar

1. Comecar pelos `P1`.
2. Avancar depois para `P2`.
3. Deixar `P3` para rodada ampliada ou automacao leve.

## Criterios usados

- `P1`: leads qualificados com historico anterior ou presenca em mais de uma base.
- `P2`: leads qualificados sem historico, mas com nome/contexto utilizavel para abordagem direta.
- `P3`: leads qualificados com sinal mais fraco ou contexto pouco confiavel.

## Templates de mensagem

### 1. Retomada quente

Oi, [nome]. Tudo bem?

Vi seu contato aqui no Boris e notei que voce ja tinha demonstrado interesse antes. Queria te chamar porque estamos organizando uma nova rodada de acompanhamento e achei que fazia sentido retomar por aqui.

Se fizer sentido, eu posso te mostrar rapidamente o melhor proximo passo.

### 2. Qualificacao direta

Oi, [nome]. Passando para retomar seu interesse no Boris.

Vi que seu contato entrou na nossa base e quis te escrever de forma objetiva: ainda faz sentido conversar sobre isso agora?

Se sim, me responde com um "sim" que eu continuo por aqui.

### 3. Reativacao leve

Oi. Tudo bem?

Seu contato apareceu aqui numa organizacao interna que estamos fazendo no Boris, e eu aproveitei para retomar a conversa sem compromisso.

Se ainda houver interesse, eu posso te mandar um resumo curto e ver se faz sentido seguir.

## Cadencia sugerida

### P1
- Dia 1: mensagem de retomada com contexto.
- Dia 3: follow-up curto perguntando se vale retomar.
- Dia 7: ultimo toque objetivo.

### P2
- Dia 1: mensagem direta de qualificacao.
- Dia 4: reforco com beneficio ou contexto de uso.
- Dia 8: encerramento leve.

### P3
- Dia 1: reabertura leve.
- Dia 5: lembrete curto.
- Dia 10: pausar contato se nao houver resposta.

## Observacoes

- Onde nao houver nome confiavel, usar abordagem neutra.
- Onde houver contexto de grupo/comunidade no campo `interest_context`, aproveitar esse gancho na mensagem.
- Nao usar essa cadencia para os arquivos de `contatos_grupo_admin`.
