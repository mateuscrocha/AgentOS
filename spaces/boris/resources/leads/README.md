# Boris Leads

Central de organizacao de leads do ecossistema Boris.

Este workspace foi estruturado para:
- reunir leads antigos e novos em um unico lugar;
- preservar a origem de cada contato;
- facilitar follow-up, campanhas e reativacao;
- preparar uma base limpa para operacao comercial e marketing.

## Estrutura

- `docs/`: regras, fluxo operacional e decisoes do projeto.
- `templates/`: modelos de importacao e mapeamento de fontes.
- `data/raw/`: arquivos brutos vindos das fontes originais.
- `data/processed/`: arquivos tratados por fonte.
- `data/master/`: base consolidada e pronta para uso.
- `data/segments/`: listas operacionais prontas para follow-up e campanhas.

## Fluxo recomendado

1. Colocar cada exportacao original em `data/raw/`.
2. Registrar a fonte em `templates/source_inventory.csv`.
3. Normalizar os dados usando `templates/lead_import_template.csv`.
4. Consolidar na base mestra `data/master/leads_master.csv`.
5. Classificar os leads por status, prioridade e proxima acao.

## Resultado esperado

Ao final, teremos uma operacao em que o Boris consegue responder:
- de onde veio cada lead;
- quando houve o ultimo contato;
- quais leads estao esquecidos;
- quais listas podem receber follow-up ou campanha;
- quais contatos merecem prioridade comercial.
