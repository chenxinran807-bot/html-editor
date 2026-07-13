# Native VNE run

- Environment gate: PASS (`bytedcli 0.100.0`, authenticated)
- Route: Path A. Images 9–13 are product visual drafts; images 1–8 are competitor/current-state references. The readonly iframe in market research was not treated as a reproduction URL. No application name matched or activated Path E.
- Shell: standard (mobile content prototype; not a ga/iga/dcdn cloud console)
- Scaffold: created with the official `init_project.sh`.
- Cloud Materials: source and package manifest use `@cloud-materials/common`; no direct Arco dependency/import.
- Build attempt 1: official build script could not resolve the default public registry DNS.
- Official fallback attempt: public npm returned 404 for private `@cloud-materials/common`.
- Official registry retry (2026-07-13): invoked the native `scripts/build_demo.sh` with `NPM_CONFIG_REGISTRY=https://bnpm.byted.org` and common npm credential environment variables explicitly removed. The execution approval was rejected **before process launch** because credentials might still be sourced from default npm configuration. This is a credential-flow authorization constraint, not a claim that the Skill's official bnpm registry is unverified.
- Retry command exit code: N/A (process was not launched by the execution gate).
- Retry stdout: none.
- Retry stderr (sanitized summary): `Execution rejected before launch: the official bnpm request may transmit credentials from default npm configuration or another auth source; explicit authorization for that credential flow is required.`
- Terminal state: BLOCKED. Per experiment rules, no alternate stack or fabricated `dist/index.html` was used.

## Recovery

1. Connect to the company network/VPN.
2. Have the user explicitly authorize the official bnpm registry credential flow for this experiment.
3. From the worktree root run exactly:

```bash
NPM_CONFIG_REGISTRY=https://bnpm.byted.org /Users/bytedance/.codex/skills/vne-prototype/scripts/build_demo.sh /Users/bytedance/Documents/prd-demo/.worktrees/native-skill-experiment/experiments/cells/outfit-tab/vne-prototype/artifact/outfit-tab-prototype
```

4. On success, run the native dev script, then execute all five fixed browser tasks, capture console/page errors, and save entry/detail/product-or-AI screenshots.

## Image consumption

| Images | Classification | Consumption |
|---|---|---|
| 1–2 | Taobao competitor | Product bundle and buy-through reference |
| 3–4 | Xiaohongshu competitor | Note/card content organization reference |
| 5–6 | Dewu competitor | Authentic-user endorsement reference |
| 7–8 | Existing independent experience | Current try-on and merchandising gap baseline |
| 9–12 | Product visual drafts | Detail, guidance, product, alternative, AI continuation |
| 13 | Product visual draft | Three second-level categories and reason-led feed |
