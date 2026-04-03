---
name: generate-readme
description: Gera o README.md do projeto a partir dos documentos em docs/
agent: doc-manager
version: 1.0
created: 2026-03-20
---

# Skill: generate-readme

## O que esta skill faz

Gera o `README.md` na raiz do projeto a partir do conteúdo existente em `docs/`.

## Quando usar

- Quando o usuário pede para gerar o README
- Após a documentação em `docs/` estar completa ou atualizada

## Inputs

Nenhum obrigatório. Lê automaticamente de `docs/`.

## Processo

1. **Verificar docs** — Ler `memory/doc-registry.md` para confirmar que docs existem
   - Se `docs/` estiver vazio, executar `generate-docs` primeiro

2. **Ler todos os docs** — Ler cada arquivo em `docs/` para extrair conteúdo

3. **Compor README.md** com as seguintes seções:
   - **Título e descrição** — Extraído de `docs/overview.md`
   - **Quick Start** — Resumo de `docs/getting-started.md`
   - **Arquitetura** — Resumo de `docs/architecture.md`
   - **Agentes do Sistema** — Tabela resumo de `docs/system-agents.md`
   - **Comandos** — Tabela de `docs/commands.md`
   - **Documentação** — Links para todos os docs em `docs/`
   - **Desenvolvimento** — Resumo de `docs/development-guide.md`

4. **Escrever README.md** na raiz do projeto

5. **Atualizar doc-registry.md** — Registrar o README com timestamp

6. **Registrar evento** — Adicionar `readme.generated` em `system/memory/bus.md`

7. **Atualizar history.md** — Registrar a ação

## Output

- `README.md` na raiz do projeto
- `doc-registry.md` atualizado
- Evento registrado no bus

## Regras

1. O README é um resumo — não duplicar todo o conteúdo dos docs
2. Incluir links para os docs completos
3. Manter conciso e escaneável
4. Se docs não existem, gerar primeiro (não criar README vazio)
