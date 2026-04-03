# Boris Character Voice System

Este documento e a referencia canonica de voz para os personagens recorrentes da linha editorial do Boris dentro do projeto de audio.

Objetivo:
- garantir consistencia entre personagem, voz, preset e intencao de atuacao
- evitar troca manual de voice id sem contexto editorial
- permitir que futuros fluxos, scripts e skills usem a mesma base de decisao

## Fonte oficial de personagens

Base editorial:

- `/Users/eu.rochamateus/Documents/Codex/Bóris - Linha Editorial/editorial/strategy/boris-persona-visual-system.md`

Mapa operacional de voz:

- `/Users/eu.rochamateus/Documents/Codex/Bóris - Áudios/config/persona-voices.json`

## Regra de uso

Sempre que um pedido mencionar um personagem editorial do Boris, assumir que:

1. o personagem deve ser identificado primeiro
2. a voz deve ser resolvida pelo mapa `config/persona-voices.json`
3. o preset padrao deve vir do proprio personagem, salvo override explicito
4. a interpretacao da locucao deve seguir a `performance_note`
5. se houver duvida entre personagem e funcao, prevalece a persona editorial oficial

## Regra geral de interpretacao

Para toda peca dialogada do Boris:

- a fala da persona deve soar mais natural, espontanea e humana
- usar pausas leves, respiracao implicita e variacao de tonalidade quando o texto pedir tensao, cansaco, frustracao, duvida ou alivio
- evitar leitura reta, excessivamente limpa ou com ritmo igual do comeco ao fim
- a fala do Boris deve entrar com mais energia e presenca do que a da persona
- o Boris deve soar mais animado, responsivo e envolvido, como quem realmente esta entrando para ajudar
- evitar um Boris apatico, monotono ou burocratico
- a dupla persona + Boris deve soar como conversa, nao como dois blocos independentes de locucao

## Biblioteca oficial

### Marina
- Funcao: Gestora de Comunidade
- Voz principal: Paula
- Voice ID: `xPnmQf6Ow3GGYWWURFPi`
- Voz reserva: Yasmin
- Preset recomendado: `calmo`
- Atuacao: acolhedora, organizada, presente e natural; deve soar como uma pessoa real falando da rotina, com pausas leves e respiracao crivel

### Rafael
- Funcao: Customer Success
- Voz principal: Flavio Francisco
- Voice ID: `x6uRgOliu4lpcrqMH3s1`
- Voz reserva: Boris
- Preset recomendado: `institucional`
- Atuacao: segura, consultiva e confiavel, mas ainda humana; evitar excesso de formalidade e usar variacao natural de ritmo

### Livia
- Funcao: Social Media
- Voz principal: Jenifer
- Voice ID: `GOkMqfyKMLVUcYfO2WbB`
- Voz reserva: Paula
- Preset recomendado: `energetico`
- Atuacao: agil, clara, ritmada e viva; pode variar mais a energia e o ataque das frases

### Diego
- Funcao: Suporte
- Voz principal: Joel
- Voice ID: `uOjV7aFQoCQBSZxYyOds`
- Voz reserva: Flavio Francisco
- Preset recomendado: `padrao`
- Atuacao: estavel, calma e resolutiva, mas nunca reta demais; precisa soar como alguem pensando enquanto responde

### Camila
- Funcao: Gestora de Alunos / Student Success
- Voz principal: Amanda Kelly
- Voice ID: `oi8rgjIfLgJRsQ6rbZh3`
- Voz reserva: Carla
- Preset recomendado: `calmo`
- Atuacao: calorosa, paciente, didatica e humana; usar pausas suaves e um leve peso emocional quando a rotina estiver puxada

### Bruno
- Funcao: Infoprodutor / Operacao Comercial via WhatsApp
- Voz principal: Joel
- Voice ID: `uOjV7aFQoCQBSZxYyOds`
- Voz reserva: Flavio Francisco
- Preset recomendado: `padrao`
- Atuacao: comercial, direta e mais jovem; precisa soar clara, leve e viva, sem confundir com a voz do proprio Boris nem cair num grave pesado demais

## Gaps atuais

- Ainda faltam vozes masculinas brasileiras mais diferenciadas para separar melhor Rafael, Diego e Bruno.
- Quando houver expansao do casting, atualizar primeiro `config/persona-voices.json` e depois este documento.

## Instrucoes para futuras skills e automacoes

Se uma skill, script ou fluxo precisar gerar conteudo com personagem:

- nunca escolher voz por intuicao se o personagem estiver definido
- nunca usar `ELEVENLABS_VOICE_ID` direto quando houver persona explicita
- preferir resolver por `persona -> primary_voice -> recommended_preset`
- usar a reserva apenas quando houver teste A/B, indisponibilidade ou decisao explicita
- citar o personagem pelo nome da persona oficial, nao por descricoes genericas como "mulher do social media"
