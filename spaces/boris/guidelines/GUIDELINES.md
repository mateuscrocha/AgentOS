# Guidelines: boris

## Sobre

Documentos de referência para **boris** (space).
Guidelines descrevem COMO o trabalho é feito — playbooks, padrões, processos, documentação de ferramentas e automações.

> **Guidelines != Memória.** Memória é estado de agente (history, world, handoff). Guidelines são documentação estável mantida por humanos.

## Herança

Escopo raiz do space. Estas guidelines são herdadas por todas as areas, times e agentes dentro de `boris`.

## Documentos

| Documento | Descrição |
|---|---|
| `product-foundation.md` | Verdades de produto, dores centrais e regras de decisão do Boris |
| `commercial-foundation.md` | Lógica comercial, funil, trilhos de venda e narrativa de oferta |
| `commercial-offers.md` | Fonte canônica compartilhada para ofertas, preços, custos e regras comerciais do Boris |
| `editorial-foundation.md` | Tese editorial, canais, pilares e guardrails de conteúdo |
| `editorial-lines.md` | Regras explícitas das linhas `cabeça quente` e `cabeça fria` |
| `pain-activation-matrix.md` | Matriz prática que conecta dores do Boris a ICP, linhas editoriais, formatos e usos em produto/comercial/CS |
| `cabeca-fria-stories.md` | Configuração operacional da linha `cabeça fria` para Stories do Instagram |
| `cabeca-fria-scenario-library.md` | Biblioteca de cenários do dia a dia para variar a `cabeça fria` e conectá-la às dores das personas |
| `language-and-locution.md` | Regra herdável de português brasileiro, acentuação e prosódia nas entregas do Boris |
| `multimodal-production.md` | Como imagem e áudio das linhas editoriais usam a biblioteca especialista do Boris |
| `meeting-intelligence.md` | Regra oficial para transformar reuniões, transcrições e calls em memória acionável do Boris |
| `persona-system.md` | Definição oficial das personas, com aparência, faixa etária, função e encaixe de voz |
| `../resources/README.md` | Índice da biblioteca operacional do Boris dentro do AgentOS |

## Cross-References

_Referencie guidelines de outros escopos quando necessário._

| Referência | Caminho | Motivo |
|---|---|---|
| Biblioteca de dores | `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/editorial/editorial/strategy/boris-pain-library.md` | Fonte canônica de dores do ecossistema Boris importada para o AgentOS |
| Source of truth editorial | `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/editorial/editorial/strategy/agent-editorial-source-of-truth.md` | Regras centrais de enquadramento editorial já trazidas para dentro do AgentOS |
| Manual editorial | `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/manual-operacao-editorial-boris.md` | Operação editorial e roteamento de skills localizados dentro do AgentOS |

## Como Usar

1. Crie arquivos `.md` neste diretório
2. Atualize a tabela "Documentos" acima com nome e descrição
3. Para referenciar guidelines de outro escopo, adicione na tabela "Cross-References"
