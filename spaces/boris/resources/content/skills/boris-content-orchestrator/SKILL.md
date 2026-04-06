---
name: boris-content-orchestrator
description: Use when the user wants this agent to act as a content orchestrator for Boris, organizing production by post, campaign, or material, creating a single production folder per deliverable, and routing execution only through other existing skills for text, image, audio, video, docs, or repurposing.
---

# Boris Content Orchestrator

This skill turns Codex into the content orchestration layer for this workspace.

It does not replace specialist skills. It coordinates them.

## Mission

When a new content request arrives, do four things in order:

1. Classify the request as `post`, `campaign`, or `material`.
2. Create or update one production folder in `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao`.
3. Route the work only through existing skills that match the asset type.
4. Return outputs that are ready to use and easy to find later.

## Non-negotiable rule

This orchestrator must use other skills for execution whenever a relevant skill exists.

Preferred routing:

- Content strategy or thesis: `boris-product-context` and `ckm:brand`
- Editorial sequencing: `boris-editorial-strategy`
- Boris character images: `boris-image-agent`
- Reusable Boris image flows: `boris-image-kit`
- Final image generation or editing: `imagegen`
- Voice or narration generation: `speech`
- Transcription or reuse from source media: `transcribe`
- Deliverable docs: `doc`
- Slide-based deliverables: `slides`

If more than one skill applies, use the smallest set that cleanly covers the request.

## Workspace structure

Always keep production organized under these roots:

- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao/posts`
- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao/campanhas`
- `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/producao/materiais`

Folder naming convention:

- `YYYY-MM-DD-slug-curto`

Examples:

- `producao/posts/2026-03-25-cabeca-quente`
- `producao/campanhas/2026-03-25-aquecimento-comunidades`
- `producao/materiais/2026-03-25-guia-demo-whatsapp`

## Folder policy

Every request should map to a single "source of truth" folder.

That folder should contain:

- the brief
- the thesis
- the scripts or copy
- prompts for image or video assets when needed
- narration text when needed
- a checklist of final assets

Do not scatter related files across random directories.

If a request evolves, update the same folder instead of creating duplicates unless the user clearly asks for a separate pack.

## Required files by type

### Post

Create the folder from `producao/_templates/post` and keep these files when relevant:

- `README.md`
- `00-brief.md`
- `01-roteiro.md`
- `02-copy.md`
- `03-prompts-imagem.md`
- `04-locucao.md`
- `05-plano-video.md`
- `06-assets-checklist.md`

### Campaign

Create the folder from `producao/_templates/campaign`.

Keep a root `README.md` with:

- campaign thesis
- narrative progression
- day-by-day map
- list of dependent assets

Then create day folders only when needed, using:

- `01-dia-slug`
- `02-dia-slug`
- `03-dia-slug`

Each day folder should follow the post structure when that day becomes a real production item.

### Material

Create the folder from `producao/_templates/material`.

Use this for standalone support assets such as:

- one-pagers
- decks
- docs
- content kits
- reference packs
- repurposing packs

## Operating workflow

For every request:

1. Read the editorial rules in `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/agente-boris-conteudo.md`.
2. Read the operational rules in `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/content/manual-operacao-editorial-boris.md`.
3. Decide whether this is `post`, `campaign`, or `material`.
4. Create or reuse the correct production folder.
5. Select the specialist skills.
6. Produce only the files needed for this request.
7. Keep naming clear and chronological.

## Output standard

Every delivered folder should make the next action obvious.

That means:

- a human can open the folder and understand what it is
- the latest approved text is easy to identify
- prompts are separated from narration
- asset dependencies are listed
- the folder can be reopened later without reconstructing context from memory

## Decision rules

Choose `post` when:

- the user wants one content piece
- the user wants one scene, one script, one short, one thumbnail, or one pack for a single post

Choose `campaign` when:

- the user wants a sequence
- the user mentions multiple days, progression, launch, aquecimento, editorial arc, or recurring narrative

Choose `material` when:

- the user wants a support asset that is not a single post
- the deliverable is a document, deck, media kit, repurposing pack, script bank, or operating asset

## Special rule for "cabeca quente"

If the user asks for a recurring scene or recurring editorial format such as `cabeca quente`, treat it as a `post` unless they explicitly request a sequence.

When the requested format is `cabeca quente`, use this default editorial structure unless the user explicitly overrides it:

1. a real person brings a concrete operational pain in audio
2. Boris responds directly to that pain
3. the piece closes with a CTA
4. the final delivery includes a dedicated closing visual for the CTA, preferably a Boris image prepared for the last seconds of the video

Guardrails:

- the pain should feel specific and lived in routine
- the pain voice should be first-person and tied to something that happened in the person's routine today, yesterday, or very recently
- the pain voice should describe the concrete event, not summarize the pain in generic copy
- the Boris response should react to the pain as Boris, not sound like a generic lecture
- the CTA belongs at the end
- the CTA closing visual is part of the default asset checklist for `cabeca quente`
- when the CTA points to the site, prefer a final Boris-led image showing or presenting the site with clean space for end-card text in editing
- if there is no concrete pain, it should not be treated as `cabeca quente`

Use a dedicated slug so all related files live together inside one folder, for example:

- `producao/posts/2026-03-25-cabeca-quente-gestor-cego`

## What success looks like

The user should be able to ask for a new content item and receive:

- the right folder
- the right files
- the right specialist skills behind the scenes
- minimal retrabalho
