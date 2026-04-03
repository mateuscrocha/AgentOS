# Bóris Visual Brief

Use this file as the source of truth for character consistency. If a field is unknown, keep it as `TBD` and request only that field.

## Canonical Body Reference
- Source of truth: `assets/boris-body-reference.png`.
- Mandatory rule: preserve this body silhouette and proportions in every output.
- If this file is missing, ask the user to attach the reference again and save it at this same path.
- Never replace this reference with a text-only approximation.

## Identity Core
- Name: Bóris
- Archetype: friendly, intelligent mascot/character
- Apparent age: TBD
- Body type/silhouette: short mascot body, flame/drop-shaped head and torso merged in one rounded silhouette
- Face landmarks: simple cute face with small curved smile and minimal nose/mouth line
- Hair/fur style: no hair; top forms a flame tip
- Eyes: large black circular eyes with small white highlight
- Signature expression: friendly slight smile
- Pose system: flexible pose library; do not lock the character to a single default stance

## Styling Core
- Primary palette: bright orange body with yellow/orange gradients
- Secondary palette: dark navy/black outline, light neutral shadow under feet
- Materials/textures: clean, modern, slightly premium
- Outfit/base costume: no clothing
- Signature accessory: friendly readable hand language; raised-hand wave is only one allowed option, not a mandatory default in every image
- Tail status: no tail, no cauda, no rabo in any variation

## Photography/Illustration Direction
- Preferred style: TBD (photorealistic, 3D stylized, flat illustration, etc.)
- Composition defaults: center subject, medium shot for portrait, full-body for action
- Lighting defaults: soft key light + subtle rim light
- Background defaults: simple gradient or contextual scene with low clutter

## Interface Mode
- When the request is for a Boris UI, admin panel, dashboard, or screen mockup, preserve Bóris identity but let the interface structure lead the composition.
- Use `references/boris-admin-ui-reference.md` for layout language, card style, spacing, and palette behavior.
- If Bóris is present inside the screen, avoid oversizing the mascot to the point that it breaks the product/admin feel.
- Use `references/boris-pose-variation.md` whenever the mascot should feel more dynamic, specific, or less repetitive.

## Non-Negotiable Invariants
- Keep facial structure and key accessory stable across all variants.
- Preserve silhouette and color palette unless explicitly requested.
- Never add a tail, cauda, rabo, or tail-like appendage.
- Avoid random logo/text/watermark artifacts.
- Avoid exaggerated caricature unless requested.
- Keep thick dark outline and chibi-like proportions from the reference.
- Vary pose and gesture according to the use case instead of repeating one frozen stance.

## Validation Checklist
- Reference image included in the run input.
- Flame/drop silhouette preserved.
- Large black eyes with white highlights preserved.
- Friendly smile and simple facial geometry preserved.
- Orange/yellow gradient palette preserved.
- Thick dark outline preserved.
- Hand language stays friendly and readable.
- No tail/cauda/rabo present.
- Pose matches the scene and is not a thoughtless repeat of the default wave unless requested.

## Prompt Snippet Template
Use case: <slug>
Asset type: <where it will be used>
Primary request: <user request>
Subject: Bóris, <stable traits>, no tail
Style/medium: <style>
Composition/framing: <framing>
Lighting/mood: <lighting>
Color palette: <palette>
Constraints: keep Bóris identity unchanged; preserve the canonical silhouette; no tail/cauda/rabo; <other constraints>
Avoid: watermark, random text, extra fingers, anatomy distortions, off-brand palette, tail, cauda, rabo, tail-like appendages
