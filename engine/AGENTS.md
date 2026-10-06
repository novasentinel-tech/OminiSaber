# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- Keep both authoring modes available: Mesa de Montagem and Mapa da Experiência must edit the same work model.
- Keep the parallax effect concentrated on the mode chooser, with keyboard control and reduced-motion support.
- Use Phosphor icons for interface actions; do not use emojis as UI icons.
- Accept only validated public Flourish URLs and require an accessible text summary.
- Let the teacher collapse the OmniStudio sidebar completely on desktop; keep a persistent top-bar control to restore it and remember the preference locally.
- Keep the Mesa de Montagem focused on sequencing: add blocks through pedagogical recipes or categorized individual blocks, and configure each block on a dedicated full-page screen rather than a narrow side inspector.
- Update `Docs/` when the work schema, block semantics, publishing boundary, or major product decisions change.
- Prioritize easy guided creation, interactive student responses, and a connected teacher-to-student cycle. Simple table sequences connect automatically; preserve explicit branches in the map.
- The teacher preview and the published student activity use the same renderer. Ordering and matching are real interactions with touch and keyboard controls; private answers are shuffled and stripped in published snapshots.
- The Copilot creates editable drafts in the Studio. Applying a suggestion requires teacher review; publishing remains a separate explicit action.
- Mathematical formulas must have real visual notation and accessible MathML, with easy fraction/root/power buttons throughout block authoring and student writing. Keep rendering local, bounded and untrusted.
- Share one safe mathematical parser for calculation steps, equation solving and Cartesian graphs. Support ordinary notation such as 2x, ax², decimal commas and common LaTeX; never execute authored JavaScript.
- Graphs must support zoom, readable axes, exact selected points, adjustable parameters, comparison and an accessible values table. Respect undefined domains and avoid drawing through asymptotes.
- Public worked examples are explicit teaching support; numeric answer-key calculations remain private and are never copied into the student's scratchpad automatically.
- Each production build identifies itself and publishes release.json. Check for newer builds on focus, visibility and every three minutes using no-store requests; offer a dismissible update notice. Never reload automatically, and respect existing pending-answer guards before a user-requested refresh.
