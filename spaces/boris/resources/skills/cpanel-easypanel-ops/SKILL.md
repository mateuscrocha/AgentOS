---
name: cpanel-easypanel-ops
description: Use quando precisar operar o cPanel configurado no .env da raiz do AgentOS para listar domínios, criar subdomínios e apontar DNS para o EasyPanel padrão em test.easypanel.euboris.com.br ou no IP 89.116.73.218.
---

# Skill: cpanel-easypanel-ops

## O que esta skill faz

Padroniza o acesso operacional ao cPanel já autenticado no projeto para tarefas recorrentes de domínio, subdomínio e DNS ligadas ao EasyPanel.

## Quando usar

- quando o usuário pedir para listar domínios ou subdomínios existentes na conta cPanel
- quando for preciso criar um novo subdomínio em um domínio já hospedado na conta
- quando for preciso criar um apontamento `A` ou `CNAME` para publicar apps no EasyPanel
- quando a tarefa depender do cPanel já configurado no `.env` da raiz do AgentOS

## Contexto padrão

- Base URL do cPanel: lida de `CPANEL_BASE_URL` no `.env` da raiz
- Credenciais: `CPANEL_USER` e `CPANEL_API_TOKEN`
- Destino padrão de EasyPanel para novos apontamentos:
  - host: `test.easypanel.euboris.com.br`
  - IP: `89.116.73.218`

## Processo

1. Validar que o `.env` da raiz contém `CPANEL_BASE_URL`, `CPANEL_USER` e `CPANEL_API_TOKEN`.
2. Para chamadas modernas do cPanel, usar `scripts/cpanel_uapi.sh`.
3. Para operações de DNS que não tenham equivalente conveniente em UAPI, usar `scripts/cpanel_api2.sh` com o módulo `ZoneEdit`.
4. Para listar domínios da conta, usar `scripts/list_domains.sh`.
5. Para criar subdomínio, usar `scripts/create_subdomain.sh SUBDOMINIO DOMINIO_RAIZ`.
6. Para apontar um host ao EasyPanel, preferir:
   - `A` para `89.116.73.218` quando o destino final é o IP do servidor
   - `CNAME` para `test.easypanel.euboris.com.br` quando fizer sentido apontar para o hostname do EasyPanel
7. Depois de qualquer alteração, verificar o resultado retornado pela API e confirmar o domínio/subdomínio alvo.

## Comandos úteis

Listar domínios:

```bash
spaces/boris/resources/skills/cpanel-easypanel-ops/scripts/list_domains.sh
```

Criar subdomínio:

```bash
spaces/boris/resources/skills/cpanel-easypanel-ops/scripts/create_subdomain.sh app rochamateus.com.br
```

Criar registro `A` apontando para o EasyPanel:

```bash
spaces/boris/resources/skills/cpanel-easypanel-ops/scripts/add_dns_record.sh rochamateus.com.br app A 89.116.73.218
```

Criar registro `CNAME` apontando para o host do EasyPanel:

```bash
spaces/boris/resources/skills/cpanel-easypanel-ops/scripts/add_dns_record.sh rochamateus.com.br app CNAME test.easypanel.euboris.com.br
```

## Regras

1. Nunca usar a URL de sessão do navegador com `/cpsess...`; usar apenas `CPANEL_BASE_URL`.
2. Não expor o token do cPanel na resposta ao usuário.
3. Antes de criar um subdomínio ou DNS, confirmar claramente o host final desejado.
4. Para DNS, lembrar que a conta cPanel precisa ser a autoridade da zona para que a mudança tenha efeito real.
5. Se a operação de DNS falhar, preservar o erro bruto da API na resposta para facilitar diagnóstico.

## Referência oficial

- UAPI para criação de subdomínio: [SubDomain/addsubdomain](https://api.docs.cpanel.net/openapi/cpanel/operation/addsubdomain/)
- cPanel API 2 para DNS: [ZoneEdit::add_zone_record](https://api.docs.cpanel.net/cpanel-api-2/cpanel-api-2-modules-zoneedit/cpanel-api-2-functions-zoneedit-add_zone_record)
