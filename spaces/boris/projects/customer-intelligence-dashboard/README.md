# Customer Intelligence Dashboard

Dashboard standalone para visualizar a inteligência de reuniões, sínteses e padrões recorrentes do Bóris sem depender do `boris-painel`.

## Objetivo

Concentrar em uma interface própria:

- visão geral das conversas consolidadas
- dores, objeções e soluções propostas que mais se repetem
- leitura detalhada por conta
- radar recorrente para apoiar decisões de produto, comercial e conteúdo

## Fontes oficiais do AgentOS

- `spaces/boris/resources/reunioes/`
- `spaces/boris/resources/inteligencia-cliente/`
- `spaces/boris/resources/comercial/contas/`

## Estado atual

- primeira versão visual pronta
- dados gerados automaticamente a partir dos `.md` oficiais
- parser inicial lendo contas comerciais e normalizando sinais para a interface

## Rodar localmente

```bash
npm install
npm run generate:data
npm run dev
```

Depois abra `http://127.0.0.1:5173/` ou a porta indicada pelo Vite.
