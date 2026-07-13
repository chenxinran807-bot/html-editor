# Open Design intake — outfit-tab

- Starting point: no existing cell-local design system; use the PRD screenshots as the explicit visual reference and choose the skill's one-off/default route. Do not create a reusable design system for this experiment.
- Audience: young women browsing outfit inspiration who need fast answers to what to wear, whether it suits them, and how to buy it.
- Primary scenario: mobile discovery feed inside a Douyin-commerce-like product surface.
- Tone: concise, confident, practical, editorial rather than playful.
- Fidelity: high-fidelity clickable prototype, because the PRD includes detailed reference screens and the fixed tasks require end-to-end state verification.
- Output format: mobile web prototype in a native Open Design viewer/manifest package.
- Variation count: one coherent direction. The experiment scores task completion, so multiple visual variants would dilute the core flow.
- Visual context: match the supplied references — white and pale-gray surfaces, ink-black controls, lime-green suitability highlights, dense commerce content, modest radii, no gradients.
- Interaction scope: category switching, reason-led card detail, suitability/formula/avoidance reading, product and lower-cost alternative overlays, like/dislike feedback, AI styling and AI try-on entry states.
- Variation dimensions: prioritize interaction and content-state variation; keep layout and visual language consistent with the reference.
- Novelty: by-the-book product iteration, with only small interaction refinements (state feedback and bottom sheets) where the PRD leaves behavior open.
- Data/content: realistic Chinese outfit, price, sizing, material, and suitability copy derived from the PRD; no backend or real commerce calls.
- Persistence: remember the active category and last screen in localStorage, as required by the interactive-prototype skill.
- Edge states: include dislike removal/empty recovery, loading transitions, product availability/alternative messaging, and disabled AI action during generation.
- Core-scope context gaps: none. The PRD explicitly specifies audience needs, modules, P0–P2 progression, acceptance coverage, and reference visuals; no NEEDS_CONTEXT request is necessary.

## Plan

1. Package a cell-local Open Design viewer, manifest, and one mobile mockup.
2. Implement the fixed outfit-tab path as real state transitions with realistic data and no dead visible controls.
3. Serve locally, run every fixed task in a real browser, save entry/intermediate/result screenshots and evidence.
4. Validate the result contract and commit only this cell.
