# Boris Character Voice System

Este documento e a referencia canonica de voz para os personagens recorrentes da linha editorial do Boris dentro do projeto de audio.

Objetivo:
- garantir consistencia entre personagem, voz, preset e intencao de atuacao
- evitar troca manual de voice id sem contexto editorial
- permitir que futuros fluxos, scripts e skills usem a mesma base de decisao

## Fonte oficial de personagens

Base editorial:

- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/editorial/editorial/strategy/boris-persona-visual-system.md`

Mapa operacional de voz:

- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio/config/persona-voices.json`

Biblioteca consolidada de persona:

- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/guidelines/persona-system.md`

## Regra de uso

Sempre que um pedido mencionar um personagem editorial do Boris, assumir que:

1. o personagem deve ser identificado primeiro
2. a voz deve ser resolvida pelo mapa `config/persona-voices.json`
3. o preset padrao deve vir do proprio personagem, salvo override explicito
4. a interpretacao da locucao deve seguir a `performance_note`
5. se houver duvida entre personagem e funcao, prevalece a persona editorial oficial
6. o texto final de locucao deve sair em portugues brasileiro corretamente acentuado e pontuado
7. toda voz deve carregar emocao, intencao e curva de fala coerentes com a cena; leitura apatica ou reta deve ser tratada como erro

## Regra geral de interpretacao

Para toda peca dialogada do Boris:

- a fala da persona deve soar mais natural, espontanea e humana
- usar pausas leves, respiracao implicita e variacao de tonalidade quando o texto pedir tensao, cansaco, frustracao, duvida ou alivio
- evitar leitura reta, excessivamente limpa ou com ritmo igual do comeco ao fim
- priorizar mais intencao, mais emocao e mais curva de interpretacao; evitar locucao apatica, flat ou neutra demais
- escrever e gerar sempre com portugues brasileiro bem pontuado e acentuado, porque isso melhora a atuacao e a prosodia do TTS
- a velocidade base das personas deve ficar alinhada com a velocidade do Bóris; diferenca de energia deve vir de atuacao, pontuacao, estilo e intencao, nao de playback mais rapido
- a fala do Boris deve entrar com mais energia e presenca do que a da persona
- o Boris deve soar mais animado, responsivo e envolvido, como quem realmente esta entrando para ajudar
- evitar um Boris apatico, monotono ou burocratico
- a dupla persona + Boris deve soar como conversa, nao como dois blocos independentes de locucao
- quando houver CTA, o Boris deve soar convidativo e resolutivo, com energia de direcionamento claro para o proximo passo

## Biblioteca oficial

### Marina
- Funcao: Gestora de Comunidade
- Voz principal: Paula
- Voice ID: `xPnmQf6Ow3GGYWWURFPi`
- Voz reserva: Yasmin
- Preset recomendado: `calmo`
- Atuacao: acolhedora, organizada, presente e natural; deve soar como uma pessoa real falando da rotina, com pausas leves e respiracao crivel
- Ajuste de atuacao: manter acolhimento, mas com mais sentimento de rotina vivida; nao deixar a leitura morrer reta

### Renata
- Funcao: Customer Success
- Voz principal: Bella
- Voice ID: `hpp4J3VqNfWAUOO0d1Us`
- Voz reserva: Yasmin
- Preset recomendado: `institucional`
- Atuacao: segura, consultiva e confiavel, mas ainda humana; evitar excesso de formalidade e usar variacao natural de ritmo
- Ajuste de atuacao: trazer mais presenca e calor de acompanhamento real, sem cair em voz corporativa fria
- Observacao de casting: escolhido para evitar repeticao de voz com a Marina; ainda vale ampliar o casting feminino brasileiro consultivo para eliminar o tradeoff de accent

### Livia
- Funcao: Social Media
- Voz principal: Jenifer
- Voice ID: `GOkMqfyKMLVUcYfO2WbB`
- Voz reserva: Paula
- Preset recomendado: `energetico`
- Atuacao: agil, clara, ritmada e viva; pode variar mais a energia e o ataque das frases
- Ajuste de atuacao: sustentar brilho e urgencia editorial sem soar artificial ou radiofonica

### Daniela
- Funcao: Suporte
- Voz principal: Yasmin
- Voice ID: `lWq4KDY8znfkV0DrK8Vb`
- Voz reserva: Paula
- Preset recomendado: `padrao`
- Atuacao: estavel, calma e resolutiva, mas nunca reta demais; precisa soar como alguem pensando enquanto responde
- Ajuste de atuacao: preservar estabilidade, mas com mais implicacao humana e menos neutralidade tecnica

### Camila
- Funcao: Gestora de Alunos / Student Success
- Voz principal: Amanda Kelly
- Voice ID: `oi8rgjIfLgJRsQ6rbZh3`
- Voz reserva: Carla
- Preset recomendado: `calmo`
- Atuacao: calorosa, paciente, didatica e humana; usar pausas suaves e um leve peso emocional quando a rotina estiver puxada
- Ajuste de atuacao: subir a carga emocional quando houver desgaste, frustracao ou cuidado ferido; evitar leitura mansa demais

### Bianca
- Funcao: Infoprodutor / Operacao Comercial via WhatsApp
- Voz principal: Matilda
- Voice ID: `XrExE9yKIg1WjnnlVkGX`
- Voz reserva: Jenifer
- Preset recomendado: `energetico`
- Atuacao: comercial, direta e mais jovem; precisa soar clara, leve e viva, com confianca e urgencia boa sem cair em propaganda caricata
- Ajuste de atuacao: trazer mais urgencia, timing e vontade de resolver, sem perder leveza comercial
- Observacao de casting: escolhida para dar mais confianca e menos brilho infantil; ainda pode evoluir quando houver voz feminina brasileira mais assertiva para vendas

## Gaps atuais

- Ainda vale ampliar o casting feminino brasileiro para substituir a Renata por uma voz consultiva sem tradeoff de accent.
- Quando houver expansao do casting, atualizar primeiro `config/persona-voices.json` e depois este documento.

## Instrucoes para futuras skills e automacoes

Se uma skill, script ou fluxo precisar gerar conteudo com personagem:

- nunca escolher voz por intuicao se o personagem estiver definido
- nunca usar `ELEVENLABS_VOICE_ID` direto quando houver persona explicita
- preferir resolver por `persona -> primary_voice -> recommended_preset`
- usar a reserva apenas quando houver teste A/B, indisponibilidade ou decisao explicita
- citar o personagem pelo nome da persona oficial, nao por descricoes genericas como "mulher do social media"
