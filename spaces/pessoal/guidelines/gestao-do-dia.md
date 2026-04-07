# Gestão do Dia

## Objetivo

Usar o AgentOS como base prática para organizar o dia sem depender de contexto espalhado.

O histórico da conversa pode ajudar, mas não deve ser tratado como memória confiável para o que está em andamento no cotidiano. O estado operacional importante precisa ser persistido em arquivos vivos da área `pessoal/dia`.

## Fonte de Verdade Operacional

Para temas do dia a dia, a fonte de verdade deve ficar em:

- `spaces/pessoal/areas/dia/memory/agora.md` — snapshot vivo do dia
- `spaces/pessoal/areas/dia/memory/inbox.md` — capturas rápidas ainda não totalmente triadas
- `spaces/pessoal/areas/dia/memory/follow-ups.md` — dependências externas e esperas ativas

Esses arquivos existem para que o AgentOS saiba "o que está rolando" mesmo quando a conversa muda, reinicia ou mistura outros assuntos.

## Fluxo Recomendado

1. Capturar antes de estruturar.
2. Organizar o material bruto em blocos simples.
3. Triar um item por vez.
4. Abrir o dia com no máximo 3 prioridades reais.
5. Registrar compromissos e blocos de foco que disputam atenção.
6. Manter follow-ups visíveis enquanto estiverem vivos.
7. Revisar no fim do dia o que foi concluído, adiado ou descartado.

## Regras Operacionais

- Priorizar clareza sobre volume.
- Preservar o material bruto antes de transformá-lo em sistema.
- Diferenciar compromisso com hora marcada de tarefa flexível.
- Tratar o Google Calendar como fonte de verdade dos compromissos fixos.
- Tratar `agora.md` como fonte de verdade do estado operacional corrente.
- Triar um item por vez quando houver muita entrada acumulada.
- Tudo que depende de outra pessoa deve continuar visível como follow-up.
- Tratar urgência como exceção, não como padrão.
- Fechar o dia com uma lista curta do próximo passo.

## Regra de Persistência

- Atualização importante do dia entrou na conversa: registrar na memória viva.
- Captura nova e ainda confusa: registrar em `inbox.md`.
- Mudança de prioridade, foco ou restrição do dia: refletir em `agora.md`.
- Dependência de terceiros, resposta pendente ou cobrança futura: registrar em `follow-ups.md`.

## Estrutura Sugerida de Check-in

```md
## Hoje

### Prioridades
- [ ] prioridade 1
- [ ] prioridade 2
- [ ] prioridade 3

### Compromissos
- 09:00 ...
- 14:30 ...

### Capturas
- ...

### Follow-ups
- aguardando:
- vence hoje:
- próximo contato:

### Encerramento
- concluído:
- movido:
- atenção amanhã:
- amanhã começa por:
```

## Integração com Google Calendar

- Reuniões e compromissos com horário marcado devem ser lidos do Google Calendar sempre que possível.
- O planejamento diário deve partir primeiro do calendário e só depois distribuir tarefas flexíveis nas janelas livres.
- Em caso de conflito entre lista manual e calendário, prevalece o evento confirmado no calendário até nova decisão explícita.
