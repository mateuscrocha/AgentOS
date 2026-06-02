---
name: infra
space: empresa
description: Infraestrutura operacional da empresa, incluindo cPanel, DNS, hospedagem e painéis administrativos
created: 2026-05-21
---

# Area: infra

## Propósito

Centralizar no AgentOS a operação de infraestrutura externa da empresa, com foco inicial em cPanel, DNS, hospedagem e tarefas administrativas recorrentes.

## Agentes

| Agente | Papel | Status |
|---|---|---|
| cpanel-operator | Opera cPanel por API e por interface quando necessário | Ativo |

## Times

| Time | Propósito | Membros |
|---|---|---|
| — | — | — |

## Memória

- Area: `spaces/empresa/areas/infra/memory/`
- Agentes: `spaces/empresa/areas/infra/agents/{nome}/memory/`
- Times: `spaces/empresa/areas/infra/teams/{nome}/memory/`

## Guidelines

- Diretório: `spaces/empresa/areas/infra/guidelines/`
- Herda de: `spaces/empresa/guidelines/`
- Adicione playbooks de infraestrutura, acesso, DNS, hosting e painéis administrativos.
