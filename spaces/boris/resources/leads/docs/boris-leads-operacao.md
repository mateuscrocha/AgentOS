# Operacao Boris Leads

## Boris Context Fit
Esta estrutura atende o Boris como uma camada operacional de inteligencia comercial. Em vez de deixar leads espalhados, o workspace centraliza captacao, historico e acao futura em um fluxo simples e reutilizavel.

## Target User and Workflow
Usuario principal: operador do projeto Boris ou voce mesmo como responsavel por marketing e follow-up.

Fluxo principal:
1. receber listas e exportacoes antigas;
2. registrar a origem;
3. padronizar campos;
4. consolidar duplicados;
5. separar listas acionaveis por campanha ou follow-up.

## Recommended Product Surface
Superficie recomendada: operacao interna de leads com uma base mestra central e arquivos auxiliares por lote de importacao.

## Interaction and Layout Direction
- `data/raw/` como camada de entrada;
- `data/processed/` como camada de limpeza;
- `data/master/` como verdade operacional;
- `templates/` como contrato padrao entre fontes diferentes.

## Tone and UX Guidance
O projeto deve ser direto, limpo e operacional. A base precisa facilitar decisao rapida: quem abordar, quando abordar, e por qual contexto esse lead entrou.

## Avoid List
- misturar dado bruto com dado consolidado;
- perder a origem do lead;
- usar status vagos;
- sobrescrever bases antigas sem controle de lote;
- depender de memoria para saber o que fazer com cada lista.

## Alignment Notes
- A base mestra precisa ser simples o suficiente para manutencao manual.
- Todo lead deve carregar contexto suficiente para futuras automacoes.
- O desenho favorece campanhas, follow-up e priorizacao comercial antes de sofisticacao tecnica.

## Modelo operacional de status

Sugestao de status para a coluna `lead_status`:
- `new`
- `qualified`
- `contacted`
- `waiting`
- `follow_up_pending`
- `reactivation_candidate`
- `won`
- `lost`

## Campos minimos da base mestra

- `lead_id`
- `full_name`
- `company`
- `email`
- `phone`
- `instagram`
- `city`
- `state`
- `country`
- `source_name`
- `source_type`
- `original_id`
- `import_batch`
- `lead_status`
- `lead_temperature`
- `interest_context`
- `last_contact_at`
- `next_action`
- `next_action_due`
- `owner`
- `notes`
- `created_at`
- `updated_at`

## Proximo passo ideal

Comecar pela lista de fontes existentes. Exemplos:
- CSV exportado de formularios;
- contatos de WhatsApp;
- planilhas antigas;
- CRM anterior;
- leads vindos de landing pages;
- listas manuais.
