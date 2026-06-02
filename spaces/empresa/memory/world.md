# Space World: empresa

## Estado Atual

- Space inicializado em 2026-04-06
- Estrutura base criada para concentrar informações da empresa
- Escopo separado do produto `boris` para evitar mistura entre operação societária e operação de produto
- Guideline inicial criada para orientar cadastro institucional, dados fiscais e documentos oficiais
- Área `infra` criada para operar cPanel, DNS, hosting e painéis administrativos da empresa
- Agente `cpanel-operator` criado com skill para guardar token no Keychain do macOS e operar a API do cPanel com segurança

## Prioridades Iniciais

- Registrar razão social, nome fantasia, CNPJ e dados cadastrais oficiais
- Consolidar contatos, endereços, dados bancários e referências institucionais recorrentes
- Definir depois, se necessário, áreas adicionais como financeiro, jurídico ou administrativo
- Usar a área `infra` como base para capacidades de infraestrutura externa e acessos sensíveis

## Última Alteração

- **Data:** 2026-05-21
- **O que mudou:** Criada a área `infra` no space `empresa`, junto do agente `cpanel-operator` e da skill `cpanel-api-operator`, para guardar token no Keychain do macOS e operar cPanel com segurança por API e por interface quando necessário.
- **Agente:** kernel
