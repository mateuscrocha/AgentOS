---
name: boris-audio-agent
description: Use as the primary Boris audio execution skill for casting, persona resolution, ElevenLabs generation, campaign narration, and voice consistency across the editorial system. Prefer this skill for any Boris-related audio request that depends on official personas, character voice mapping, or editorial acting direction. Use `speech` only for generic TTS when Boris-specific voice logic is not needed.
---

# Boris Audio Agent

Use this skill for Boris audio work: voice casting, persona selection, ElevenLabs generation, campaign narration, and consistency between editorial character and voice.

## Positioning

Esta skill e a porta principal para audio Boris.

Use como primeira escolha quando o pedido envolver:

- locucao Boris
- persona oficial
- casting
- consistencia entre personagem e voz
- geracao final em ElevenLabs

Nao use como primeira escolha quando:

- o pedido for TTS generico sem logica Boris
- o trabalho for apenas transcricao

## When To Use
Use this skill when the user asks to:
- generate audio for Boris or an editorial persona
- choose or revise a voice in ElevenLabs
- create campaign, batch, or single-line narration
- map scripts to Marina, Rafael, Livia, Diego, Camila, or Bruno
- keep Boris character audio consistent across projects

## Workflow
1. Work from the audio project at `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio`.
2. Read `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio/referencias/boris-character-voice-system.md` when the request involves a named persona, recurring character, or casting decision.
3. Read `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio/config/persona-voices.json` only when exact ids, presets, backups, or acting notes are needed.
4. If the task is about generating audio, use the existing ElevenLabs scripts instead of reinventing the flow.
5. Resolve persona first, then voice, then preset, then copy style.
6. When a persona is explicit, never rely on `ELEVENLABS_VOICE_ID` alone; use the persona mapping.
7. If the user wants a new casting recommendation, stay within Brazilian voices when possible and keep it aligned with the editorial persona library.
8. If the user wants a new voice for the account, explain which gap it fills in the current cast.
9. For `Cabeça Quente`, prepend 1.5 seconds of silence to every final exported audio unless the user explicitly asks otherwise.

## Acting direction defaults

Unless the user explicitly asks for a flatter delivery, use these defaults:

- The persona line should sound natural, lived-in, and conversational.
- Add subtle pauses, shifts in breath, and tonal variation so the line feels like a real person speaking after a real routine event.
- Do not make the persona sound robotic, over-even, or like a neutral read of copy.
- The persona may sound tired, frustrated, confused, relieved, or pressured depending on the scene, but should still feel believable and human.
- The Bóris line should have more energy and presence than the persona line.
- Bóris should sound engaged, responsive, and slightly more animated, while still staying intelligent and in control.
- Avoid a dull or overly flat Bóris delivery; he should feel like he is actively replying, not just narrating.
- Do not let Bóris sound rushed; if the read feels slightly accelerated, prefer slowing it down a bit rather than keeping extra speed.
- When generating a pair of lines, think in contrast: persona brings the lived pain, Bóris brings animated clarity.
- Intelligibility matters more than dramatic weight. If a voice sounds too grave, muddy, or hard to understand in context, prefer a clearer rendering.

## Clarity over rigidity

When an official persona voice is technically correct but harms comprehension:

- prioritize clarity and understandability over strict attachment to the default voice
- prefer another Brazilian voice that still feels coherent with the persona's role and editorial function
- treat this as an override, not a new permanent persona mapping unless the user explicitly approves that broader change
- record the override in the piece-level locução file so the exception is visible later

## Cabeça Quente persona opening rule

When the audio belongs to the `Cabeça Quente` editorial series:

- the persona opening should sound like a real desabafo directed to Bóris himself
- the persona should address Bóris by name naturally in the line
- `Bóris` should appear as part of a human request for help, not as brand repetition
- the line should feel conversational, lived-in, and emotionally believable
- avoid openings that sound like detached narration or generic category description
- every final exported audio should begin with 1.5 seconds of silence so the Canva timeline has breathing room by default

Preferred pattern:

- persona speaks in first person
- persona names the immediate pain from routine
- persona says `Bóris` naturally
- Bóris replies as if entering that exact conversation

Good direction example:

- `Bóris, tem uma coisa me pegando aqui...`
- `Bóris, eu preciso te falar uma coisa...`
- `Bóris, tem um ponto nessa rotina que está me preocupando...`

Avoid:

- slogan-like mentions of the name
- stiff or over-scripted brand mentions
- persona lines that never acknowledge Bóris even though he replies right after

## Official Persona Rules
- Marina -> Paula -> `calmo`
- Rafael -> Flavio Francisco -> `institucional`
- Livia -> Jenifer -> `energetico`
- Diego -> Joel -> `padrao`
- Camila -> Amanda Kelly -> `calmo`
- Bruno -> Boris -> `anuncio`

Use backup voices only for explicit A/B tests, temporary substitutions, or account limitations.
Also allow temporary overrides when the official voice is too grave, unclear, or otherwise hurts intelligibility for the specific piece.

## Commands
Run commands from `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio`.

- List voices: `npm run eleven:list-voices`
- Single audio: `npm run eleven:tts -- "Texto" arquivo.mp3 preset persona`
- Batch audio: `npm run eleven:batch -- roteiro.txt preset persona`
- Campaign audio: `npm run eleven:campaign -- nome-da-campanha preset persona`
- Guided flow: `npm run eleven:studio`

## Output Expectations
When answering, prefer to make these explicit when relevant:
- persona selected
- primary voice selected
- preset selected
- short acting direction
- command used or file generated
- whether the 1.5 second intro silence was applied

## Avoid
- inventing unofficial personas when an official one already fits
- changing voice by intuition when the persona is already defined
- mixing character role and voice role loosely
- using non-Brazilian voices for core Boris editorial characters unless the user explicitly asks
