# Native Prototype Skill Comparison

Generated from 12 validated cell results. Rankings exclude scoreless statuses; cross-input deltas require scores on both inputs.

## open-design

- **Best use:** When a team needs the strongest balanced clickable flow and reproducible browser evidence across both inputs.
- **Weakness:** Nested source screenshots and shallow or incomplete recovery behavior reduce visual and interaction credibility.
- **Recommended:** Recommended for general-purpose prototype reviews where flow coverage matters most.
- **Avoid:** Avoid when pixel-clean source reconstruction or fully terminal AI recovery states are mandatory.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/open-design/result.json) · [camera-upload result](../../experiments/cells/camera-upload/open-design/result.json) · [evidence](../../experiments/cells/camera-upload/open-design/qa/browser-qa-raw.json)

## huashu-design

- **Best use:** When exploring several visual directions before committing to one implementation.
- **Weakness:** Directions share substantial structure, and browser assertions do not deeply verify every variant or state.
- **Recommended:** Recommended for early design divergence with a later consolidation pass.
- **Avoid:** Avoid when a compact, production-like artifact and exhaustive interaction proof are required.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/huashu-design/result.json) · [camera-upload result](../../experiments/cells/camera-upload/huashu-design/result.json) · [evidence](../../experiments/cells/camera-upload/huashu-design/qa/screenshots/direction-a.png)

## prd-generator

- **Best use:** When the prototype must ship with structured PRD, canvas, review, and handoff records.
- **Weakness:** Runtime fidelity and token wiring lag the documentation, and some controls remain shallow.
- **Recommended:** Recommended for documentation-heavy handoff and traceability workflows.
- **Avoid:** Avoid when the only priority is the most polished, native-feeling interaction demo.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/prd-generator/result.json) · [camera-upload result](../../experiments/cells/camera-upload/prd-generator/result.json) · [evidence](../../experiments/cells/camera-upload/prd-generator/qa/browser-qa.spec.js)

## pm-kakaxi

- **Best use:** When rapid high-fidelity delivery and strong fixed-task interaction coverage are the priority.
- **Weakness:** Inferred product content and review controls can leak into the visible experience or conflict semantically.
- **Recommended:** Recommended for camera-upload style demos with a disciplined inference review.
- **Avoid:** Avoid when every visible datum must be source-grounded and all peripheral controls must work.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/pm-kakaxi/result.json) · [camera-upload result](../../experiments/cells/camera-upload/pm-kakaxi/result.json) · [evidence](../../experiments/cells/camera-upload/pm-kakaxi/qa/browser-qa-raw.json)

## vne-prototype

- **Best use:** When a cloud-materials React scaffold, build gate, manifest, and formal UI specification are required.
- **Weakness:** Private dependencies reduce portability; one input is blocked and the mobile case clashes with the console shell.
- **Recommended:** Recommended for internal console-oriented prototypes with registry access and build approvals.
- **Avoid:** Avoid for portable/offline evaluation or mobile-first work without a compatible VNE shell.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/vne-prototype/result.json) · [evidence](../../experiments/cells/outfit-tab/vne-prototype/run/native-run.md) · [camera-upload result](../../experiments/cells/camera-upload/vne-prototype/result.json) · [evidence](../../experiments/cells/camera-upload/vne-prototype/run/native-run.md)

## inspire-prototype

- **Best use:** When a hosted prototype URL must be generated quickly with minimal local setup.
- **Weakness:** Interaction reliability and source-image relevance vary sharply, especially on outfit-tab.
- **Recommended:** Recommended for fast hosted concept previews followed by mandatory live-browser review.
- **Avoid:** Avoid when deterministic local artifacts, deep interaction coverage, or strict source fidelity are required.
- **Evidence:** [outfit-tab result](../../experiments/cells/outfit-tab/inspire-prototype/result.json) · [evidence](../../experiments/cells/outfit-tab/inspire-prototype/run/native.ndjson) · [camera-upload result](../../experiments/cells/camera-upload/inspire-prototype/result.json) · [evidence](../../experiments/cells/camera-upload/inspire-prototype/run/generation.sanitized.json)

## Ranking snapshots

### outfit-tab

1. **pm-kakaxi** — prototype effect 92/100 · audited total 76/100 ([result](../../experiments/cells/outfit-tab/pm-kakaxi/result.json))
2. **inspire-prototype** — prototype effect 86/100 · audited total 44/100 ([result](../../experiments/cells/outfit-tab/inspire-prototype/result.json))
3. **open-design** — prototype effect 65/100 · audited total 83/100 ([result](../../experiments/cells/outfit-tab/open-design/result.json))
4. **huashu-design** — prototype effect 62/100 · audited total 81/100 ([result](../../experiments/cells/outfit-tab/huashu-design/result.json))
5. **prd-generator** — prototype effect 58/100 · audited total 76/100 ([result](../../experiments/cells/outfit-tab/prd-generator/result.json))

### camera-upload

1. **inspire-prototype** — prototype effect 92/100 · audited total 74/100 ([result](../../experiments/cells/camera-upload/inspire-prototype/result.json))
2. **pm-kakaxi** — prototype effect 84/100 · audited total 86/100 ([result](../../experiments/cells/camera-upload/pm-kakaxi/result.json))
3. **prd-generator** — prototype effect 80/100 · audited total 81/100 ([result](../../experiments/cells/camera-upload/prd-generator/result.json))
4. **vne-prototype** — prototype effect 76/100 · audited total 78/100 ([result](../../experiments/cells/camera-upload/vne-prototype/result.json))
5. **open-design** — prototype effect 68/100 · audited total 85/100 ([result](../../experiments/cells/camera-upload/open-design/result.json))
6. **huashu-design** — prototype effect 65/100 · audited total 81/100 ([result](../../experiments/cells/camera-upload/huashu-design/result.json))

## Applicability exclusions

- **vne-prototype / outfit-tab:** BLOCKED — Native VNE build remains blocked until the user explicitly authorizes the official bnpm registry credential flow and the exact build and manual browser QA recovery steps in run/native-run.md complete successfully.
