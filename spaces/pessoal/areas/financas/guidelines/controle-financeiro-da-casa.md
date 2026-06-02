# Controle Financeiro da Casa

## Objetivo

Manter uma leitura simples, atualizável e confiável da vida financeira da casa de Mateus e Alice.

## Princípios

1. Começar com poucos blocos: entradas, contas previstas, dívidas, saldo disponível e lançamentos classificados.
2. Tratar previsibilidade como prioridade maior do que categorização detalhada, sem abrir mão da classificação mínima dos lançamentos.
3. Sempre destacar o que já está comprometido, mesmo que o débito ainda não tenha acontecido.
4. Separar fato confirmado, compromisso futuro e estimativa.
5. Registrar dúvidas que impeçam uma leitura segura em vez de completar lacunas no improviso.

## Estrutura mínima sugerida

- `resumo-atual.md` para o retrato do momento
- `contas-previstas.md` para vencimentos, recorrências e parcelas
- `dividas.md` para pendências abertas e acordos
- `lancamentos-classificados.md` para o histórico estruturado de entradas e saídas com categoria e estabelecimento

## Camada de classificação

Cada lançamento deve poder carregar, quando conhecido:

- data
- tipo (`entrada`, `saida`, `resgate`, `investimento`, `transferencia`, `fatura`, `parcela`)
- valor
- descrição original
- estabelecimento
- categoria principal
- subcategoria opcional
- responsável
- observação curta

### Categorias principais iniciais

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

### Regra estrutural

Estabelecimento não deve virar coluna fixa da estrutura principal. Ele deve ser armazenado como atributo do lançamento para permitir agregação futura em painel.

## Fontes de dados aceitas

- extrato bancário exportado
- fatura de cartão
- planilha manual
- texto livre enviado na conversa

## Resultado esperado

Sempre que possível, a leitura deve responder de forma simples:

1. Quanto dinheiro existe agora.
2. Quanto já está comprometido.
3. O que vence em breve.
4. Quanto está sendo devido.
5. Até quando o caixa atual aguenta nas premissas conhecidas.
6. Onde o dinheiro está saindo por categoria.
7. Quais estabelecimentos mais puxam o caixa.
