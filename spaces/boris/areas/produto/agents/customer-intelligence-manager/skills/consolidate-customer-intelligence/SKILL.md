---
name: consolidate-customer-intelligence
description: Consolida transcrições, pesquisas, anotações e insights do Bóris em memória acionável com implicações para produto, comercial, conteúdo, suporte e operações. Use sempre que o usuário trouxer reunião com cliente, call, discovery, pesquisa de mercado, resumo solto, insight estratégico ou quiser transformar material disperso em leitura prática para decisão.
agent: customer-intelligence-manager
project: boris
version: 1.0
created: 2026-05-24
---

# Skill: consolidate-customer-intelligence

## O que esta skill faz

Transforma material bruto do ecossistema do Bóris em inteligência utilizável.

Ela existe para evitar que calls, pesquisas e sinais de cliente fiquem presos em conversa, transcrição solta ou memória implícita.

## Quando usar

- quando o usuário enviar transcrição de reunião, call ou áudio transcrito
- quando houver resumo bruto de conversa com lead, cliente, parceiro ou prospect
- quando surgir pesquisa, benchmark, insight de mercado ou padrão observado
- quando for preciso responder o que isso muda em produto, comercial, suporte, conteúdo ou operação
- quando o usuário quiser criar uma memória estratégica a partir de materiais dispersos

## Processo

1. Classificar a entrada:
   - `reuniao`
   - `pesquisa`
   - `insight`
   - `sintese de varios materiais`
2. Armazenar ou referenciar a matéria-prima no lugar correto:
   - reunião ou transcrição em `spaces/boris/resources/reunioes/`
   - pesquisa em `spaces/boris/resources/inteligencia-cliente/pesquisas/`
3. Produzir uma síntese em `spaces/boris/resources/inteligencia-cliente/sinteses/` com nome iniciado por data ISO.
4. Separar explicitamente:
   - fatos observados
   - inferências
   - riscos
   - oportunidades
   - implicações por área
   - próximos passos
5. Propagar os aprendizados para os destinos corretos quando fizer sentido:
   - conta comercial em `spaces/boris/resources/comercial/`
   - hipótese ou diretriz de produto em `spaces/boris/areas/produto/`
   - tese editorial ou pauta em `spaces/boris/resources/content/` ou `spaces/boris/resources/editorial/`
   - ajustes de suporte ou operação nas áreas correspondentes

## Inputs

- `$ARGUMENTS`: contexto do material, conta ou tema, objetivo da leitura e qualquer data conhecida

## Output padrão

Use esta estrutura sempre que a skill consolidar material:

```md
# [titulo]

## Fonte

## Resumo executivo

## Fatos observados

## Inferencias e hipoteses

## Dores, desejos e objecoes

## Oportunidades e riscos

## Implicacoes por area
- Produto
- Comercial
- Conteudo
- Suporte
- Operacoes

## Proximos passos
```

## Regras

1. Reunião relevante do Bóris deve seguir a guideline `spaces/boris/guidelines/meeting-intelligence.md`.
2. Não inventar certeza onde só existe hipótese; sinalizar o grau de confiança.
3. Se o material tocar conta já existente, refletir o aprendizado também no arquivo da conta.
4. Se houver muito ruído na transcrição, preservar o que é confiável e marcar o que ficou ambíguo.
5. Priorizar utilidade decisória acima de resumo bonito.
