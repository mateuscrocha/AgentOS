---
name: boris-proposal-orchestrator
description: Use as the main entry point for Boris commercial proposals. This skill organizes proposal production end to end: frames the commercial case, aligns brand and offer, routes design and document work, and writes everything into a single proposal folder. Prefer this skill whenever the user asks for proposta comercial, proposta, deck comercial, one-pager comercial, escopo, investimento, or an account-specific Boris sales document.
---

# Boris Proposal Orchestrator

Use this skill as the primary gateway for Boris commercial proposals.

It coordinates the commercial, brand, design, and document layers so proposals are not built ad hoc.

## Positioning

Esta skill e a porta principal para propostas comerciais Boris.

Use como primeira escolha quando o pedido envolver:

- proposta comercial
- one-pager comercial
- deck comercial
- proposta para conta especifica
- escopo + investimento
- material de apoio para fechamento
- adaptacao de proposta para ICP ou conta

Nao use como primeira escolha quando:

- o pedido for so estrategia comercial sem material final
- o pedido for so identidade visual
- o pedido for so um documento tecnico isolado sem framing comercial

## Mission

Quando um novo pedido de proposta chegar, faca nesta ordem:

1. Entender a conta, ICP ou contexto comercial.
2. Definir a tese da proposta, oferta, escopo e proximo passo.
3. Alinhar voz, marca e consistencia visual.
4. Escolher o formato final mais adequado: doc, deck, one-pager ou combinacao.
5. Criar ou atualizar uma unica pasta-fonte da verdade para a proposta.
6. Produzir apenas os arquivos necessarios para fechar ou avancar a oportunidade.

## Primary routing

- comercial, oferta, objecoes, pricing, ICP, tese -> `boris-commercial-mentor`
- marca, voz, guideline, consistencia -> `brand`
- direcao de design, adaptacoes visuais, materiais amplos -> `design`
- documento final `.docx` -> `doc`
- deck final `.pptx` -> `slides`
- se precisar de apoio PDF final -> `pdf`

Se mais de uma skill se aplicar, use o menor conjunto que cubra o pedido com clareza.

## Workspace structure

Use como raiz comercial:

- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/leads/docs/propostas`

Cada proposta deve viver em uma pasta unica:

- `YYYY-MM-DD-slug-da-conta-ou-oportunidade`

Exemplos:

- `2026-04-01-proposta-escola-x`
- `2026-04-01-proposta-comunidade-y`
- `2026-04-01-one-pager-consultoria-z`

## Folder policy

Cada oportunidade deve ter uma unica pasta-fonte da verdade.

Essa pasta pode conter:

- `README.md`
- `00-brief-comercial.md`
- `01-proposta.md`
- `02-escopo.md`
- `03-investimento.md`
- `04-objeções-e-riscos.md`
- `05-assets-checklist.md`
- arquivo final `.docx` e/ou `.pptx` quando produzido

Nao espalhe a mesma proposta por varias pastas sem necessidade.

## Workflow

1. Identifique se a oportunidade e:
- proposta rapida
- proposta customizada
- proposta strategica para conta-chave
- material de apoio de venda

2. Consulte `boris-commercial-mentor` para:
- framing comercial
- ICP
- tese de valor
- escopo
- investimento
- objecoes previsiveis
- proximo passo sugerido

3. Consulte `brand` para validar:
- tom
- mensagem
- consistencia de marca
- aderencia a Boris

4. Consulte `design` quando o material depender de:
- one-pager visual
- deck mais trabalhado
- proposta visualmente apresentada
- assets extras de apoio comercial

5. Use `doc` quando o formato final principal for proposta formal em `.docx`.

6. Use `slides` quando o formato final principal for deck comercial em `.pptx`.

7. Mantenha a proposta com linguagem clara, especifica e comercialmente acionavel.

## Defaults

- idioma padrao: portugues do Brasil
- tom: consultivo, claro, seguro e objetivo
- evitar linguagem generica de SaaS
- conectar a proposta a dores reais de grupos, comunidades, operacao, clareza e contexto
- quando faltar formato, assumir `doc` primeiro e `slides` apenas quando a apresentacao fizer mais sentido

## Output expectations

Quando entregar, deixar claro:

- conta ou oportunidade
- formato produzido
- valor central da proposta
- escopo resumido
- investimento ou logica de investimento
- proximo passo comercial
- caminho completo da pasta da proposta

## Trigger phrases

Esta skill deve disparar para pedidos como:

- "faz uma proposta comercial do Boris"
- "monta uma proposta para esse cliente"
- "preciso de um one-pager comercial"
- "cria um deck comercial do Boris"
- "organiza uma proposta com escopo e investimento"
- "faz um material comercial para fechar essa conta"
