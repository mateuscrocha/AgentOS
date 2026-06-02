# Saneamento do CRM — Prospecção 2026-04-28

## Objetivo

Traduzir o diagnóstico da fila quebrada em uma rotina objetiva de limpeza do CRM.

Este documento não reabre a prospecção.

Ele existe para separar:

- o que precisa mudar de etapa no CRM
- o que precisa sair de funil direto e virar base de relacionamento
- o que ainda exige leitura manual antes de qualquer ação

## Resumo Numérico

No estado atual do CRM:

- contas em `new_lead`: `1.553`
- contas que pareciam fila comercial pela leitura antiga: `109`
- dessas `109`, com perfil `manager/grupo`: `106`
- fora desse perfil: `3`
- fila segura real para novo disparo: `0`

## Baldes de Correção

### 1. Corrigir etapa no CRM

Esses casos não são prospecção nova. Já estão em movimento comercial real e só continuam em `new_lead` por modelagem errada.

#### Caso confirmado hoje

- `Guilherme Amorim / contabilidade`
  - trilho: `entrada_nova`
  - prioridade: `P1`
  - problema: `next_step` fala em confirmar reunião de `22/04/2026 às 15h`
  - ação recomendada: sair de `new_lead` e entrar em etapa equivalente a `meeting`

#### Caso muito próximo da mesma classe

- `Rafael Reid`
  - trilho: `entrada_nova`
  - prioridade: `P2`
  - problema: `next_step` já fala em aguardar resposta a follow-up enviado
  - ação recomendada: revisar se continua em `new_lead` ou se deve virar `qualification`/`meeting` conforme a operação real

### 2. Tirar de funil direto e tratar como base de relacionamento

Essa é a massa principal do problema.

Registros com estes tipos não devem alimentar lote de prospecção:

- `Manager de grupo`
- `Contato de grupo (manager)`
- `Contato de grupo (manager) | postgres_member_admin / manager`
- `Contato de grupo (manager) | postgres_member_admin`
- `Contato de grupo (manager) | postgres_member_super_admin / manager`
- `Contato de grupo (manager) | postgres_member_manager`
- `Super Admin`
- `Manager`

Volume atual em `new_lead` com esse perfil:

- `Manager de grupo`: `604`
- `Contato de grupo (manager) | postgres_member_admin / manager`: `258`
- `Contato de grupo (manager) | postgres_member_admin`: `110`
- `Contato de grupo (manager)`: `104`
- `Contato de grupo (manager) | postgres_member_super_admin / manager`: `66`
- `Contato de grupo (manager) | postgres_member_manager`: `40`
- demais variações menores: `45`

Leitura operacional:

- isso é base de comunidade, relacionamento, operação de grupo ou parceria
- não é fila de WhatsApp outbound direta
- o CRM precisa refletir isso de forma separada para não contaminar a prospecção

### 3. Reativação com perfil administrativo

Mesmo no trilho `reativacao`, ainda existem linhas administrativas que não podem entrar em lote:

- `Amilton`
- `Bruna Carvalho`
- `+5511913135066`
- `+55351919613361`

Leitura operacional:

- todos aparecem com marca de `Manager` ou `Super Admin`
- não são contatos prontos para disparo automático
- pedem curadoria manual individual

### 4. Legado `postgres_subscriber` em revisão manual

Também há um subconjunto de `new_lead` que não é disparo seguro, mas pode carregar valor comercial se for triado com mais cuidado.

Exemplos:

- `ALINE VON BAHTEN`
- `Bruno Viana Macedo`
- `Claudia Spinassi Justa Pena`
- `Danrlei Carlos daSilva`
- `Diogo Pinto da Costa Viana`
- `Fabio Melo Duran / Diogo Souza`
- `Felipe Amorim`
- `Gickson de Oliveira`
- `Junior UniFECAF`
- `Leandro Ferrari`
- `Lisaine Craft Eventos`
- `Matheus L O Santos`
- `Olivia Miranda Carneiro`

Leitura operacional:

- são linhas de `postgres_subscriber`
- várias já falam em `validar origem e priorizar follow_up comercial`
- isso significa revisão comercial manual, não disparo cego

## Regras Operacionais Confirmadas

Para esta campanha, não entra em lote:

- qualquer `Manager`, `Super Admin` ou `Contato de grupo`
- qualquer registro com `v_group_with_managers_rows`
- qualquer placeholder de triagem
- qualquer caso com reunião, follow-up, proposta, aguardando resposta ou perda
- qualquer número já usado nesta jornada

## Próximas Ações Recomendadas

1. Ajustar etapa de `Guilherme Amorim / contabilidade` para a etapa correta de reunião.
2. Revisar `Rafael Reid` e decidir se ainda é `new_lead` ou se já é follow-up ativo.
3. Criar uma categoria operacional explícita para `base de relacionamento/comunidade` e tirar dali os `manager/grupo`.
4. Separar os `postgres_subscriber` em revisão manual, fora da cadência automática de prospecção.
5. Só liberar novo lote quando a query endurecida voltar pelo menos um bloco real de leads limpos.
