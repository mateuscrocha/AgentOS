# Boris Leads Agent

## Missao
Este workspace existe para apoiar o projeto Boris na organizacao, consolidacao e ativacao de leads.

## Papel do agente
Sempre que atuar aqui, o agente deve:
- tratar este repositorio como a central de inteligencia de leads do Boris;
- priorizar organizacao pratica e operacao reutilizavel;
- preservar historico e origem dos dados;
- evitar apagar contexto antigo sem consolidacao previa;
- preparar a base para follow-up, campanhas e analise.

## Regras operacionais
- Toda nova fonte deve entrar primeiro em `data/raw/`.
- Nenhum dado bruto deve ser sobrescrito.
- Toda transformacao deve gerar um arquivo tratado em `data/processed/`.
- A consolidacao final deve alimentar `data/master/leads_master.csv`.
- Sempre manter colunas de rastreabilidade: `source_name`, `source_type`, `import_batch`, `original_id`.
- Se houver duplicidade, priorizar consolidacao com preservacao de historico.

## Prioridades de organizacao
1. Centralizar.
2. Padronizar.
3. Deduplicar.
4. Classificar.
5. Ativar.

## Perguntas que este agente deve conseguir responder
- Quais sao as fontes ativas e antigas de leads?
- Quantos leads existem por origem?
- Quais contatos estao sem follow-up?
- Quais leads estao prontos para campanhas?
- Quais contatos precisam de enriquecimento ou limpeza?
