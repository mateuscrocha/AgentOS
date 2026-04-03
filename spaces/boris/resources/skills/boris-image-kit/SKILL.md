---
name: boris-image-kit
description: Reusable toolkit for accelerating Boris image production with ready-made prompt templates, launcher scripts, and format-specific workflows for YouTube thumbnails, Instagram Stories, and transparent assets. Use when the workflow is already known and the goal is speed, reuse, or template consistency. Prefer `boris-image-agent` as the main entry point for new Boris image requests that need judgment, art direction, or identity control.
---

# Bóris Image Kit

Use this skill together with `boris-image-agent` when the user wants reusable prompt files, a faster generation workflow, or standardized Bóris assets across projects.

## When To Use
- The user wants a global prompt template for Bóris.
- The user wants a reusable launcher/command for Bóris generations.
- The user wants one of the standard Bóris formats: YouTube thumbnail with guest, technical YouTube thumbnail with Bóris solo, Instagram Story, or transparent character asset.
- The user wants to create prompt files quickly instead of rewriting structure every time.

## Workflow
1. Also use `boris-image-agent` for canonical character rules.
2. Start from one of the templates in `assets/prompts/`.
3. Save the filled prompt into the current workspace, usually under `tmp/imagegen/prompts/`.
4. Run `scripts/run_boris_template.zsh` with the prompt file and output path.
5. For transparent assets, pass `transparent` as the optional fifth argument.
6. Add a pose/action clause when the asset should feel specific or dynamic.
7. Validate that Bóris keeps the canonical silhouette, thick outline, palette, clean sides with no appendages, and a pose suited to the scene instead of a repeated generic stance.

## Template Selection
- `assets/prompts/boris-prompt-base-template.txt`: generic starting point
- `assets/prompts/boris-template-thumbnail-youtube.txt`: YouTube thumbnail with guest or secondary character
- `assets/prompts/boris-template-thumbnail-youtube-tecnico.txt`: YouTube thumbnail with Bóris solo for technical themes such as automations, AI, workflows, and product explanations
- `assets/prompts/boris-template-story-instagram.txt`: Instagram Story
- `assets/prompts/boris-template-personagem-transparente.txt`: transparent isolated character

## Technical Thumbnail Notes
- For technical YouTube thumbnails, prefer one concrete concept or mechanism per image instead of a generic "technology" backdrop.
- Translate the topic into a strong visual metaphor: flow blocks, decision trees, agent handoffs, feedback loops, dashboards with a single highlighted signal, or one dominant system element.
- Keep the scene editorial and immediate: one main idea, few large elements, and obvious hierarchy at thumbnail size.
- Avoid filling the frame with random icons, too many micro-panels, or interchangeable AI visuals that weaken specificity.
- When text is used, keep it short and secondary to the visual concept.
- Default to one Bóris per thumbnail unless the concept explicitly requires more than one.
- Vary the pose and body angle of both Bóris and the human presenter across thumbnails so recurring assets do not feel templated.

## Execution
- Script: `scripts/run_boris_template.zsh`
- Required image reference: `../boris-image-agent/assets/boris-body-reference.png`
- Prompt file: create in the active workspace
- Output file: write into the active workspace, usually under `output/imagegen/boris/`

## Defaults
- Mode: `edit`
- Input fidelity: `high`
- Output format: `png`
- Background: default API background unless `transparent` is passed

## Guardrails
- Do not replace the canonical Bóris reference.
- Keep the prompt lines about clean sides and no appendages.
- Do not let Bóris default to the same exact wave pose for every unrelated asset.
- For transparent assets, require a truly transparent background, not a dark rendered backdrop.
- Use the launcher instead of rewriting the whole command unless the task needs a custom CLI call.
