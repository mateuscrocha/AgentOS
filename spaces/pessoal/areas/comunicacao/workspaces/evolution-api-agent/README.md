# Evolution API Agent

Base minima para operar a Evolution API por terminal/chat, sem interface web.

Esta workspace foi internalizada no AgentOS e agora vive em `spaces/pessoal/areas/comunicacao/workspaces/evolution-api-agent`.
O projeto externo antigo deixa de ser dependencia operacional; qualquer evolucao daqui para frente deve acontecer nesta copia local.

## Preparacao

1. Copie `.env.example` para `.env`.
2. Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`.
3. Configure os perfis de envio em `EVOLUTION_PROFILE_PESSOAL_INSTANCE` e `EVOLUTION_PROFILE_BORIS_SUPORTE_INSTANCE`.
4. Se cada perfil usar sua propria chave/token, preencha `EVOLUTION_PROFILE_PESSOAL_API_KEY` e `EVOLUTION_PROFILE_BORIS_SUPORTE_API_KEY`.
5. Configure o espacamento entre mensagens com faixas separadas para mesmo destinatario e destinatario diferente.
6. Se a sua instalacao usar rotas diferentes, ajuste os caminhos opcionais no `.env`.

## Comandos

Sincronizar cache local de contatos e grupos:

```bash
npm start -- sync
```

Ver estado do cache local:

```bash
npm start -- cache-info
```

Listar instancias:

```bash
npm start -- list-instances
```

Verificar status da instancia padrao:

```bash
npm start -- instance-status
```

Criar grupo:

```bash
npm start -- create-group --subject "Casamento" --description "Combinados e infos do aluguel dos ternos." --participants 5511999999999,5511888888888
```

Adicionar participantes ao grupo:

```bash
npm start -- update-group-participants --group-jid 120363000000000000@g.us --action add --participants 5511999999999,5511888888888
```

Enviar texto:

```bash
npm start -- send-text --number 5511999999999 --text "Oi"
```

Enviar texto por perfil/remetente:

```bash
npm start -- send-text-profile --profile pessoal --number 5511999999999 --text "Oi"
npm start -- send-text-profile --profile boris_suporte --number 5511999999999 --text "Oi"
```

Enviar imagem:

```bash
npm start -- send-media --number 5511999999999 --media https://example.com/imagem.jpg --caption "Oi"
```

Enviar imagem por perfil/remetente:

```bash
npm start -- send-media-profile --profile boris_suporte --number 5511999999999 --media https://example.com/imagem.jpg --caption "Oi"
```

Buscar contato no cache:

```bash
npm start -- find-contact --name "Pedro Oliveira"
```

Buscar grupo no cache:

```bash
npm start -- find-group --name "Testes"
```

Enviar texto por nome do contato:

```bash
npm start -- send-text-contact --name "Pedro Oliveira" --text "Oi"
```

Enviar texto por nome usando perfil:

```bash
npm start -- send-text-contact --profile pessoal --name "Pedro Oliveira" --text "Oi"
```

Enviar imagem por nome do contato:

```bash
npm start -- send-media-contact --name "Pedro Oliveira" --media https://example.com/imagem.jpg --caption "Oi"
```

Fazer chamada generica:

```bash
npm start -- request GET /instance/fetchInstances
```

POST generico:

```bash
npm start -- request POST /message/sendText/minha-instancia '{"number":"5511999999999","text":"Oi"}'
```

## Observacoes

- O projeto usa apenas Node 20+ e `fetch` nativo.
- Os endpoints padrao refletem rotas comuns da Evolution API, mas podem variar por versao. Se variar no seu ambiente, ajuste os paths no `.env`.
- Para desempenho, rode `npm start -- sync` e use os comandos por nome. Eles leem do cache local em vez de consultar toda a base a cada envio.
- Os perfis aceitam aliases como `pessoal`, `mateus`, `mateus_pessoal`, `boris`, `boris_suporte` e `suporte`.
- Cada perfil pode usar sua propria `instance` e sua propria `API key`.
- O wrapper da skill aplica um cooldown automatico entre envios para reduzir risco de bloqueio.
- O padrao atual e `10-15` segundos para o mesmo destinatario e `45-60` segundos ao trocar para outro numero.
- Quando voce me pedir uma acao aqui no chat, eu posso reutilizar essa base para executar chamadas e te devolver o resultado.
