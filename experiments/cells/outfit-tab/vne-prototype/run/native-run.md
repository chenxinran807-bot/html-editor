# Native VNE run

- Environment gate: PASS (`bytedcli 0.100.0`, authenticated)
- Route: Path A. Images 9–13 are product visual drafts; images 1–8 are competitor/current-state references. The readonly iframe in market research was not treated as a reproduction URL. No application name matched or activated Path E.
- Shell: standard (mobile content prototype; not a ga/iga/dcdn cloud console)
- Scaffold: created with the official `init_project.sh`.
- Cloud Materials: source and package manifest use `@cloud-materials/common`; no direct Arco dependency/import.
- Build attempt 1: official build script could not resolve public registry DNS.
- Official fallback attempt: public npm returned 404 for private `@cloud-materials/common`.
- Official internal registry attempt: blocked by execution policy because the environment had an npm Bearer token and approval did not explicitly authorize disclosure to the registry. HTTPS retry was also rejected for the same credential-disclosure risk.
- Terminal state: BLOCKED. Per experiment rules, no alternate stack or fabricated `dist/index.html` was used.

## Image consumption

| Images | Classification | Consumption |
|---|---|---|
| 1–2 | Taobao competitor | Product bundle and buy-through reference |
| 3–4 | Xiaohongshu competitor | Note/card content organization reference |
| 5–6 | Dewu competitor | Authentic-user endorsement reference |
| 7–8 | Existing independent experience | Current try-on and merchandising gap baseline |
| 9–12 | Product visual drafts | Detail, guidance, product, alternative, AI continuation |
| 13 | Product visual draft | Three second-level categories and reason-led feed |

