# Guidelines: produto

## Sobre

Documentos de referência para **produto** (area).
Guidelines descrevem COMO o trabalho é feito — playbooks, padrões, processos, documentação de ferramentas e automações.

> **Guidelines != Memória.** Memória é estado de agente (history, world, handoff). Guidelines são documentação estável mantida por humanos.

## Herança

Herda de `spaces/boris/guidelines/`.

## Documentos

| Documento | Descrição |
|---|---|
| `workspace-boris-painel.md` | Define o papel do workspace do painel, limites entre código e documentação do AgentOS, e regras de operação local |
| `boris-painel-architecture.md` | Mapeia a arquitetura atual do painel, pontos saudáveis, sinais de legado e prioridades de organização |

## Cross-References

_Referencie guidelines de outros escopos quando necessário._

| Referência | Caminho | Motivo |
|---|---|---|
| Workspace do produto | `spaces/boris/areas/produto/workspaces/boris-painel/README.md` | Fonte local sobre stack, ambiente e execução do aplicativo principal |

## Como Usar

1. Crie arquivos `.md` neste diretório
2. Atualize a tabela "Documentos" acima com nome e descrição
3. Para referenciar guidelines de outro escopo, adicione na tabela "Cross-References"
