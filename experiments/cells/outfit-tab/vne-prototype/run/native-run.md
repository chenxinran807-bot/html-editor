# Native VNE run

- Environment gate: PASS (`bytedcli 0.100.0`, authenticated)
- Route: Path A. Images 9–13 are product visual drafts; images 1–8 are competitor/current-state references. The readonly iframe in market research was not treated as a reproduction URL. No application name matched or activated Path E.
- Shell: standard (mobile content prototype; not a ga/iga/dcdn cloud console)
- Scaffold: created with the official `init_project.sh`.
- Cloud Materials: source and package manifest use `@cloud-materials/common`; no direct Arco dependency/import.
- Build attempt 1: official build script could not resolve the default public registry DNS.
- Official fallback attempt: public npm returned 404 for private `@cloud-materials/common`.
- Official registry retry request (2026-07-13): requested approval to launch the native `scripts/build_demo.sh` against `https://bnpm.byted.org`, with common npm credential environment variables removed. The approval gate rejected the request **before process launch** because credentials might still be sourced from default npm configuration. This is a credential-flow authorization constraint, not a claim about the Skill's official bnpm registry.
- No build subprocess was created. Therefore no subprocess exit code, stdout, or stderr exists. This repository contains only this factual summary; it does not claim to contain the approval system's original response.
- Terminal state: BLOCKED. Per experiment rules, no alternate stack or fabricated `dist/index.html` was used.

## Recovery

1. Connect to the company network/VPN.
2. Have the user explicitly authorize the official bnpm registry credential flow for this experiment.
3. From the worktree root run exactly:

```bash
NPM_CONFIG_REGISTRY=https://bnpm.byted.org /Users/bytedance/.codex/skills/vne-prototype/scripts/build_demo.sh /Users/bytedance/Documents/prd-demo/.worktrees/native-skill-experiment/experiments/cells/outfit-tab/vne-prototype/artifact/outfit-tab-prototype
```

4. After build success, start the native preview with the Skill's actual parameter form:

```bash
/Users/bytedance/.codex/skills/vne-prototype/scripts/dev_demo.sh /Users/bytedance/Documents/prd-demo/.worktrees/native-skill-experiment/experiments/cells/outfit-tab/vne-prototype/artifact/outfit-tab-prototype --background
```

5. No automatic browser runner is available in this cell. Manually run the five fixed tasks against `http://localhost:5173`:
   - `switch-category`: open entry → switch second-level category → confirm Feed changes.
   - `open-reason-card`: choose a reason-led card → open its detail.
   - `read-guidance`: inspect suitability → outfit formula → avoidance guidance.
   - `open-product-or-alternative`: open a recommended product or lower-cost alternative → confirm product information.
   - `enter-ai-styling-or-try-on`: activate AI styling or AI try-on → confirm its entry state.
6. Write the manual task results and console/pageerror observations to `experiments/cells/outfit-tab/vne-prototype/qa/fixed-tasks.md`. Save screenshots as:
   - `experiments/cells/outfit-tab/vne-prototype/qa/01-entry.png`
   - `experiments/cells/outfit-tab/vne-prototype/qa/02-category-feed.png`
   - `experiments/cells/outfit-tab/vne-prototype/qa/03-detail-guidance.png`
   - `experiments/cells/outfit-tab/vne-prototype/qa/04-product.png`
   - `experiments/cells/outfit-tab/vne-prototype/qa/05-ai-entry.png`
7. Update `qa/quality-report.md` and replace the `BLOCKED` null result only after the build and manual QA evidence actually exist.

## Image consumption

| Images | Classification | Consumption |
|---|---|---|
| 1–2 | Taobao competitor | Product bundle and buy-through reference |
| 3–4 | Xiaohongshu competitor | Note/card content organization reference |
| 5–6 | Dewu competitor | Authentic-user endorsement reference |
| 7–8 | Existing independent experience | Current try-on and merchandising gap baseline |
| 9–12 | Product visual drafts | Detail, guidance, product, alternative, AI continuation |
| 13 | Product visual draft | Three second-level categories and reason-led feed |
