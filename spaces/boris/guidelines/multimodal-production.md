# Multimodal Production

## Objetivo

Este documento organiza como o `boris` deve lidar com criacao de imagem e audio dentro das linhas editoriais, reaproveitando corretamente a biblioteca especialista ja consolidada no AgentOS em vez de duplicar logica.

## Regra principal

As skills especialistas continuam sendo a camada principal de execucao.

O AgentOS local do `boris` deve:

- decidir a linha editorial
- organizar o fluxo
- definir brief, roteiro e criterios
- rotear para a skill especialista certa

Nao deve reinventar a execucao de imagem e audio quando ja existe skill madura para isso.

## Skills especialistas que continuam valendo

### Estrategia e orquestracao

- `boris-content-orchestrator`
  - usar quando o pedido tiver mais de um asset, mais de uma etapa ou precisar de pasta-fonte de verdade
- `boris-editorial-strategy`
  - usar como framing editorial principal

### Imagem

- `boris-image-agent`
  - skill principal para direcao, identidade, personagem, persona e consistencia visual
- `boris-image-kit`
  - skill de aceleracao quando o formato ja estiver conhecido e o objetivo for velocidade e padrao
- `imagegen`
  - camada final de execucao da geracao/edicao

### Audio

- `boris-audio-agent`
  - skill principal para persona, casting, voz, consistencia e geracao final Boris
- `speech`
  - usar apenas para TTS generico quando a logica Boris nao for necessaria

## Regra de roteamento por linha editorial

## Cabeça Quente

### Natureza

- dor em cena
- persona ou pessoa trazendo desabafo concreto
- Boris reagindo diretamente
- CTA final

### Fluxo padrao

1. `editorial-strategist` define dor, cena, estrutura, CTA e necessidade de asset final.
2. Se houver multiplos assets ou pasta de producao, acionar `boris-content-orchestrator`.
3. Para imagem:
   - usar `boris-image-agent` como principal
   - usar `boris-image-kit` quando houver template ou fluxo recorrente
   - executar com `imagegen`
4. Para audio:
   - usar `boris-audio-agent`
   - resolver persona antes da voz
   - aplicar a regra de resposta do Boris como continuidade real do caso
   - manter 1.5s de silencio inicial por padrao nos audios finais

### Regras visuais

- linguagem premium cartoon editorial
- persona humana no mesmo universo visual do Boris
- evitar realismo fotografico por padrao
- prever frame ou imagem final de CTA quando a peca pedir fechamento visual

### Regras de audio

- abertura em primeira pessoa
- dor concreta e recente
- nomear Boris naturalmente quando fizer sentido
- Boris responde como Boris, nao como narrador

## Cabeça Fria

### Natureza

- leitura calma
- organizacao racional do problema
- microclareza
- CTA como continuidade logica

### Fluxo padrao

1. `editorial-strategist` define problema, leitura, explicacao e CTA.
2. Se a peca for parte de um pacote maior, acionar `boris-content-orchestrator`.
3. Para imagem:
   - usar `boris-image-agent` quando houver Boris ou persona consistente
   - usar `boris-image-kit` para Stories, templates ou assets recorrentes
   - executar com `imagegen`
4. Para audio:
   - usar `boris-audio-agent` apenas se houver locucao ou personagem recorrente
   - se for apenas texto/Stories sem locucao, nao forcar audio

### Regras visuais

- composicao mais calma, limpa e legivel
- para Stories, seguir padrao aprovado de overlay e leitura rapida
- menos tensao dramatica que `cabeça quente`

### Regras de audio

- tom analitico e claro
- menos dramatizacao
- foco em entendimento, nao em impacto emocional

## Regra de sincronizacao entre imagem e audio

Quando a peca usa persona editorial:

1. resolver a persona primeiro
2. manter o mesmo nome de persona no brief, roteiro, imagem e audio
3. nao tratar a pessoa como placeholder generico
4. validar coerencia entre papel visual e voz escolhida

## Regra operacional

Quando o pedido envolver:

- so tese e formato: resolver localmente no `editorial-strategist`
- tese + imagem: `editorial-strategist` + `boris-image-agent`
- tese + audio: `editorial-strategist` + `boris-audio-agent`
- tese + imagem + audio + pasta de producao: `boris-content-orchestrator` coordenando os especialistas
