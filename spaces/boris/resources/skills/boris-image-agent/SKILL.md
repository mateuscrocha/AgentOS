---
name: boris-image-agent
description: Create and edit images of Bóris with strict visual consistency from a canonical body reference image, and generate Mateus consistently from a curated reference pack for thumbnails, campaign creatives, social assets, or co-presenter scenes where Bóris and Mateus appear together.
---

# Bóris Image Agent

## Core Rule
Always anchor recurring subjects to local canonical references before generating.
- Use `assets/boris-body-reference.png` as the canonical source of Bóris' body.
- Use `assets/mateus-reference-primary.png` as the primary source for Mateus, supported by the files in `assets/mateus-reference-pack/`.

If a required local reference is missing, request it and save it before generating.
Never finalize recurring-subject generations without the appropriate reference set.

## Approved exemplar rule

When the user provides approved final examples from the current project:

- treat those examples as visual targets, not just inspiration
- preserve the approved composition logic, background treatment, opacity behavior, and contrast strategy
- keep the canonical Bóris reference as the identity anchor and use the approved exemplar as the style/composition anchor
- if the user says an example is `definitive`, future variants in the same series should inherit that visual language unless the user explicitly changes direction

Practical meaning:

- canonical reference controls who Bóris is
- approved exemplar controls how the scene should feel
- do not revert to generic Boris editorial prompts once a definitive approved model exists
- if a result is technically valid but drifts away from the approved exemplar language, treat it as off-pattern and redo it

## Workflow
1. Identify the subject mode: `Bóris`, `Mateus`, or `Bóris + Mateus`.
2. Read `references/boris-visual-brief.md` when Bóris is present.
3. Read `references/mateus-visual-brief.md` when Mateus is present.
4. Read `references/mateus-reference-pack.md` when Mateus is present and the request depends on likeness stability, angle variety, or expression control.
5. Read `references/mateus-smile-reference-pack.md` when Mateus should appear smiling, friendly, welcoming, or more positive without losing recognizability.
6. Read `references/mateus-serious-reference-pack.md` when Mateus should appear serious, analytical, intense, skeptical, or more authoritative without losing recognizability.
7. Read `references/mateus-raised-eyebrow-reference-pack.md` when Mateus should appear curious, intrigued, skeptical in a lighter way, surprised in a controlled way, or with one eyebrow raised for thumbnail emphasis.
8. Read `references/boris-pose-variation.md` when the request benefits from a new pose, gesture, prop, or more dynamism.
9. If the request involves a screen, dashboard, panel, admin, SaaS, or interface, also read `references/boris-admin-ui-reference.md`.
10. If the request is for a recurring Boris YouTube thumbnail or the user says to keep the approved thumbnail style, also read `references/boris-youtube-thumbnail-style.md`.
11. If the request includes an official editorial persona or named recurring character, read `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio/referencias/boris-character-voice-system.md` to keep character identity aligned across image and audio systems.
12. Confirm all required reference images are attached and available locally.
13. If any required reference is missing, ask for it before generating.
14. Build a prompt spec with scene, style, framing, lighting, constraints, and avoid list.
15. Repeat invariants explicitly in every generation/edit run.
16. For edits, change only requested items and preserve subject identity.
17. Validate output against the identity checklist before final delivery.

## Approved YouTube thumbnail series rule

When the user approves a Boris YouTube thumbnail style for a recurring series:

- treat `references/boris-youtube-thumbnail-style.md` as the default composition/style anchor for subsequent thumbnails in that line
- keep Bóris as the protagonist when that file says the approved line is Boris solo
- preserve the `Central de Comando` visual language as the interface anchor instead of reverting to generic tech dashboards
- vary only the mechanism, pose, and topic emphasis from episode to episode
- if a new request in the same series drifts toward a human presenter lead or dashboard-generic aesthetic, treat that as off-pattern unless the user explicitly asks for the change

## Persona-to-voice alignment

When an image includes a recurring Boris editorial persona, do not treat the human side of the composition as a generic placeholder.

Rules:

- Resolve the official persona name first.
- Use the persona's official function and identity when describing wardrobe, mood, context, and acting intention.
- Read `/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/resources/audio/referencias/boris-character-voice-system.md` and align the image mood to the same persona that will speak in audio.
- Mention the persona name explicitly in the prompt spec whenever the scene is persona-based.
- Do not mix a masculine-coded visual with a feminine-coded voice persona, or the reverse, unless the user explicitly asks for a different casting.
- If the persona is generic and not official, mark that explicitly so the next audio step does not assume an official character voice.
- Before final delivery, verify that the named persona in the image prompt matches the named persona in the locução file.
- Do not reduce official personas to generic placeholders like "woman with phone" or "man in office"; the human side should feel like that actual editorial persona.
- When producing a batch or sequence of Cabeça Quente posts, vary the official persona across consecutive pieces unless the user explicitly wants repetition.

## Cabeça Quente visual rule

When the asset belongs to the `Cabeça Quente` series:

- Default to a premium cartoon editorial style for both Bóris and the human persona.
- Prefer comic-book / graphic-novel language over generic cartoon when it helps the scene.
- Do not generate the human persona as photorealistic unless the user explicitly asks for realism.
- Keep the human persona clearly human, but stylized into the same visual universe as Bóris.
- Avoid visual mismatch where Bóris is cartoon and the persona is realistic photography.
- Use wording like `quadrinhos editoriais premium`, `revista em quadrinhos`, `cartoon editorial premium`, `ilustração estilizada`, or `visual de animação estática sofisticada` when building the prompt.
- Preserve role cues, emotional readability, and routine signals even in cartoon form.
- If the image will be used as a video background, explicitly ask for a softer, more opaque visual treatment with controlled contrast and cleaner negative space for overlays.
- In background-use images, avoid crisp interface detail, busy foreground elements, and visual hotspots where captions or speech balloons will sit.
- When the user approves a specific background language for the series, reuse that exact background logic across subsequent frames in the same run or campaign.
- If the user approves a WhatsApp-inspired wallpaper treatment, preserve the same balance of: light base, subtle pattern, premium editorial softness, and text-safe negative space.
- Treat the approved WhatsApp-style background as the default visual system for this recurring line unless the user explicitly changes direction.
- Avoid visual boredom across the series: keep the same visual system, but vary persona, posture, acting beat, and scene emphasis from piece to piece.
- Do not freeze Bóris and the personas into one default left-right arrangement.
- Decide character placement from the theme of the piece: who is speaking, who is reacting, where the tension lives, and where overlays or balloons need breathing room.
- Vary side assignment, spacing, scale, body direction, and empty zones across the series when the theme changes.
- In conversation scenes, define intentionally who occupies each side instead of reusing a fixed template.
- If the asset is meant for message overlays, treat negative space as part of the composition logic and adapt the subjects around it.
- If the asset is meant for message overlays, do not pre-render chat balloons, chat bubbles, message cards, WhatsApp UI cards, or fake conversation snippets into the base image unless the user explicitly asks for that.
- Default rule for Boris campaign backgrounds: generate the clean background plate only, and assume overlays/messages will be added later in the editing tool.
- In Boris conversation pieces, the base image should show only the characters, background language, and breathing room for later composition. The little message balloons are not part of the generated art by default.

## Mandatory Prompt Constraints
- Use `assets/boris-body-reference.png` in every run.
- Keep silhouette, proportions, face structure, and palette fixed.
- Keep thick dark outline and mascot/chibi proportions.
- Keep the canonical body language friendly and readable, but do not force the same default pose in every image.
- Explicitly preserve that Bóris has no tail in every generation and edit.
- Add tail, cauda, or rabo to the avoid list unless the user explicitly asks for a different character design.
- Vary pose, gesture, object interaction, and body angle when the request would otherwise look repetitive.
- Use a pose that matches the use case: explaining, greeting, reading, holding objects, walking, typing, celebrating, observing, presenting, or reacting.
- Vary composition as well as pose: side placement, crop, distance between subjects, and central empty area should respond to the theme instead of repeating one locked layout.
- Add an `Avoid:` line to prevent drift, random text, watermark, and anatomy artifacts.
- Iterate with one targeted change per run.
- If the same persona has just been used in the immediately previous post of the same batch, prefer another official persona before generating a new frame unless the user explicitly wants repetition.

## Language and text constraints
- Unless the user explicitly requests another language, write prompts and on-image text instructions in Brazilian Portuguese.
- If the image should not contain readable text, say that explicitly in the prompt and in the avoid list.
- Do not allow English placeholder text, fake English UI, or mixed-language copy in Boris assets unless the user explicitly asks for that.
- When readable text is intentionally part of the image, specify the exact Portuguese text with correct accents.
- For phones, websites, dashboards, and screens, prefer abstract or unreadable interface structure unless legible text is an explicit requirement.

## Mateus Prompt Constraints
- Use `assets/mateus-reference-primary.png` for any generation or edit where Mateus is a recurring on-camera subject.
- Add supporting files from `assets/mateus-reference-pack/` when a prompt benefits from frontal likeness lock plus side-angle stability.
- Preserve Mateus as bald, with a short dark beard with subtle gray, medium-light warm skin tone, dark eyebrows, and expressive but clean editorial facial rendering.
- Keep Mateus recognizable first; stylization is allowed only after likeness, age impression, and facial structure remain stable.
- Prefer premium presenter styling for technical thumbnails: clear face visibility, calm confidence, direct communication energy, and non-generic wardrobe.
- Default wardrobe for Mateus: always a black shirt. Do not rotate outfits unless the user explicitly asks for a change.
- Prefer Mateus at a slight side angle by default: three-quarter left or three-quarter right, rather than fully frontal, unless the user explicitly asks for straight-on framing.
- Keep visible arm hair nearly absent or extremely subtle and avoid exaggerating body-hair detail.
- Keep hands proportionate and slightly refined; avoid oversized, bulky, or overly thick fingers and palms.
- When a smiling expression is requested, anchor it to the dedicated smile references rather than improvising a generic stock-photo smile.
- When a serious or analytical expression is requested, anchor it to the dedicated serious references rather than improvising a generic stern face.
- When a raised-eyebrow expression is requested, anchor it to the dedicated raised-eyebrow references rather than faking curiosity or skepticism with distorted brows.
- Prefer a slight smile or confident positive expression by default, unless the topic clearly benefits from a more analytical or serious look.
- Vary pose, hand position, torso angle, and body framing across different assets so Mateus does not feel frozen into one repeated presenter pose.
- When Mateus and Bóris appear together, define visual hierarchy explicitly. Default hierarchy for technical thumbnails: Mateus as authority lead, Bóris as branded support.
- Avoid age drift, hair reappearance, exaggerated jaw changes, beard redesign, over-retouching, stock-photo smile, or cinematic effects that reduce recognizability.

## Bóris Composition Constraints
- Default to a single Bóris in the composition.
- Only duplicate or multiply Bóris when the concept explicitly depends on repetition, cloning, scale, or multiple simultaneous actions.
- Vary Bóris pose, arm position, body angle, and gesture across different assets so the mascot does not repeat the same wave or pointing stance.
- When Bóris shares the frame with a persona, do not assume Bóris always stays on the same side.
- Place Bóris where the storytelling works best for that specific piece: response side, support side, contrast side, or quieter side.
- Keep composition decisions theme-driven, not template-driven.

## Subject Modes
- `Bóris`: use only the Bóris reference and preserve mascot identity.
- `Mateus`: use the Mateus primary reference plus auxiliaries as needed.
- `Bóris + Mateus`: use both reference systems and define who leads the composition, where each appears, and how branding hierarchy should work.

## Screen And Admin Requests
- Treat the uploaded admin screenshots as the source of truth for interface language when the request is about Bóris screens.
- Preserve the product look: warm neutral background, soft orange accents, rounded cards, airy spacing, left navigation, and a calm analytics/admin tone.
- Prefer recreating structure and hierarchy over copying literal text from screenshots.
- If Bóris appears inside the UI, keep the character visually secondary to the interface unless the user asks for a mascot-led composition.
- When no specific screen is named, default to the "Central de Comando" style captured in `references/boris-admin-ui-reference.md`.

## Execution
Use the local image generation flow from the `imagegen` skill.
- Run `scripts/image_gen.py` for generation or edits.
- Include all relevant local reference images as image input.
- Require `OPENAI_API_KEY` for live calls.
- Store intermediates in `tmp/imagegen/` and finals in `output/imagegen/boris/`.

## Deliverables
Return:
1. Final prompt used.
2. Output path(s).
3. Identity checklist result (pass/fail per item).
4. Persona or subject mode used when applicable.
