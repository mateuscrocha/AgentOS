# Boris + ElevenLabs

Setup minimo para conectar a voz do Boris no ElevenLabs e gerar audios via API.

## 1. Configurar ambiente

Crie um arquivo `.env` a partir do `.env.example` e preencha:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID` opcional

## 2. Listar vozes da conta

```bash
npm run eleven:list-voices
```

## 3. Gerar um audio

```bash
npm run eleven:tts -- "Eu sou o Boris, seu parceiro de marketing e vendas."
```

O arquivo sera salvo em `output/`.

Voce tambem pode informar um nome de arquivo e um preset:

```bash
npm run eleven:tts -- "Eu sou o Boris." intro.mp3 institucional
```

Para usar uma voz por personagem da linha editorial:

```bash
npm run eleven:tts -- "Hoje eu organizo as conversas do grupo para voce." marina.mp3 calmo marina
```

Ou com flag explicita:

```bash
npm run eleven:tts -- "Hoje eu organizo as conversas do grupo para voce." marina.mp3 --preset calmo --persona marina
```

Presets disponiveis:

- `padrao`
- `calmo`
- `energetico`
- `institucional`
- `anuncio`

## 4. Gerar audios em lote

Crie um arquivo `.txt` com uma frase por linha:

```txt
Eu sou o Boris.
Hoje eu vou te ajudar a vender mais.
Vamos transformar estrategia em resultado.
```

Depois rode:

```bash
npm run eleven:batch -- roteiro.txt energetico
```

Com personagem:

```bash
npm run eleven:batch -- roteiro.txt energetico livia
```

Os arquivos serao salvos em `output/<nome-do-arquivo>/`.

## 5. Gerar campanhas prontas

Campanhas ficam na pasta `campanhas/` em formato `.json`.

Exemplos incluidos:

- `boas-vindas`
- `anuncios-curtos`
- `cta-whatsapp`

Para gerar:

```bash
npm run eleven:campaign -- boas-vindas institucional
npm run eleven:campaign -- anuncios-curtos anuncio
```

Com personagem:

```bash
npm run eleven:campaign -- boas-vindas institucional marina
```

Os arquivos serao salvos em `output/campanhas/<nome-da-campanha>/`.
Cada campanha tambem gera um `manifest.json` com os textos e os nomes dos arquivos.

## 6. Criar campanha por objetivo

Voce pode gerar um arquivo de campanha automaticamente a partir de um objetivo comercial:

```bash
npm run eleven:campaign:create -- captacao captacao-clinica "sua consultoria" "clinicas e especialistas"
```

Objetivos disponiveis:

- `captacao`
- `remarketing`
- `follow-up`
- `fechamento`

Depois gere os audios:

```bash
npm run eleven:campaign -- captacao-clinica anuncio
```

## 7. Criar pack de conteudo comercial

Voce tambem pode gerar pacotes de roteiro prontos para formatos especificos:

```bash
npm run eleven:pack:create -- vsl vsl-clinica "sua consultoria" "clinicas e especialistas" "mais agenda qualificada"
npm run eleven:pack:create -- criativos criativos-clinica "sua consultoria" "clinicas e especialistas" "mais pacientes"
npm run eleven:pack:create -- ctas ctas-clinica "sua consultoria" "clinicas e especialistas" "mais conversas qualificadas"
```

Tipos disponiveis:

- `vsl`
- `criativos`
- `ctas`

Depois gere os audios com:

```bash
npm run eleven:campaign -- vsl-clinica institucional
npm run eleven:campaign -- criativos-clinica anuncio
npm run eleven:campaign -- ctas-clinica energetico
```

## 8. Criar campanha por nicho

Voce tambem pode gerar campanhas completas com linguagem adaptada ao nicho:

```bash
npm run eleven:niche:create -- clinica nicho-clinica "seu servico"
npm run eleven:niche:create -- imobiliaria nicho-imobiliaria "sua consultoria"
npm run eleven:niche:create -- advogado nicho-advocacia "seu atendimento juridico"
npm run eleven:niche:create -- infoproduto nicho-infoproduto "seu programa"
```

Nichos disponiveis:

- `clinica`
- `imobiliaria`
- `advogado`
- `infoproduto`

Depois gere os audios:

```bash
npm run eleven:campaign -- nicho-clinica institucional
```

## 9. Abrir o studio interativo

Se voce preferir um fluxo guiado no terminal:

```bash
npm run eleven:studio
```

O studio permite:

- gerar texto unico
- criar campanha por objetivo
- criar pack comercial
- criar campanha por nicho
- escolher a persona da linha editorial para puxar a voz automaticamente

Depois ele ja dispara a geracao dos audios automaticamente.

## 10. Mapa oficial de vozes por personagem

O elenco editorial fica em:

`config/persona-voices.json`

Referencia canonica para contexto editorial + voz:

`referencias/boris-character-voice-system.md`

Personas disponiveis hoje:

- `marina`
- `rafael`
- `livia`
- `diego`
- `camila`
- `bruno`
