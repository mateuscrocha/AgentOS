# Project Manager

Projeto pessoal criado para funcionar como a sua central diária de acompanhamento.

## Objetivo

Este projeto vai concentrar:

- visão rápida do que está acontecendo
- prioridades do dia
- projetos em andamento
- riscos e bloqueios
- linha do tempo recente das atualizações

## Como vamos usar

1. Você me conta o que aconteceu no dia.
2. Eu atualizo o estado em [`state.js`](./state.js).
3. A página em [`index.html`](./index.html) passa a refletir esse contexto.

## Estrutura

- `index.html`: interface principal
- `styles.css`: identidade visual e responsividade
- `app.js`: renderização da interface
- `state.js`: fonte de verdade inicial do projeto
- `vendor/`: assets locais da biblioteca `vis-timeline`

## Abrir localmente

Você pode servir a pasta com um servidor estático simples:

```bash
python3 -m http.server 4177
```

Depois abra `http://127.0.0.1:4177/` dentro desta pasta.
