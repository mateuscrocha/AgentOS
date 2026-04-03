---
name: setup
description: Bootstrap inicial do AgentOS — cria estrutura, agentes de sistema e memória
---

# AgentOS Setup

Execute o bootstrap do AgentOS.

## Processo

1. Verifique se o arquivo `KERNEL.md` existe na raiz (confirma que estamos no diretório correto)
2. Verifique se `system/memory/world.md` já existe — se sim, o sistema já foi instalado. Informe o usuário.
3. Se ainda não instalado, execute: `python system/scripts/setup.py`
4. Após execução, leia `system/memory/world.md` para confirmar o estado
5. Reporte ao usuário os componentes instalados e os comandos disponíveis

## Mensagem de Boas-Vindas

Após setup bem-sucedido, exiba:
- Versão do AgentOS
- Agentes do sistema instalados
- Comandos core (/new-space, /new-area, /new-agent, /new-team, /new-skill, /status, /health, /plan, /run, /workflows, /handoff)
- Comandos de skills Anthropic (/brand-guidelines, /canvas-design, /doc-coauthoring, /docx, /pptx, /xlsx, /pdf, /frontend-design, /theme-factory, /web-artifacts, /mcp-builder)
- Sistema de guidelines: cada space, area e time criado terá um diretório `guidelines/` para documentação de processos, playbooks e padrões
- Próximo passo sugerido: `/new-space <nome>`
