# Lançamentos Classificados

## Objetivo

Este arquivo é a base transacional simples da operação financeira da casa. Cada linha representa um lançamento classificado, preservando o estabelecimento original sempre que possível.

## Regras de Preenchimento

- Registrar aqui entradas e saídas relevantes consolidadas a partir de extratos, faturas, textos ou planilhas.
- Quando um PDF ou extrato trouxer muitos lançamentos, pode-se registrar primeiro só os mais relevantes e depois completar.
- Se a classificação estiver incerta, usar a melhor hipótese e marcar isso em `Observação`.
- O nome do estabelecimento deve refletir o texto original do extrato, com limpeza mínima.

## Estrutura

| Data | Tipo | Valor | Descrição original | Estabelecimento | Categoria | Subcategoria | Responsável | Conta/Origem | Recorrente | Observação |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — |

## Tipos Permitidos

- `entrada`
- `saida`
- `resgate`
- `investimento`
- `transferencia`
- `fatura`
- `parcela`

## Categorias Principais Iniciais

- `moradia-contas`
- `mercado`
- `alimentacao-fora`
- `transporte`
- `saude`
- `assinaturas`
- `cartao-fatura`
- `emprestimos`
- `boris`
- `extras`

## Subcategorias Exemplos

- `conveniencia`
- `restaurante`
- `delivery`
- `padaria`
- `farmacia`
- `streaming`
- `combustivel`
- `parcela`
- `transferencia-familiar`
