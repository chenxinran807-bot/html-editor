# VNE quality report

| Check | Result | Evidence |
|---|---|---|
| Environment gate | PASS | `run/native-run.md` |
| Native scaffold | PASS_WITH_RECOVERY | Official init created scaffold; internal registry and pnpm build approvals were required |
| cloud-materials compliance | PASS | Package dependencies, root imports, index.css + legacy.css |
| Proto Edit | PASS | Spec §7, both manifests, Provider, and four runtime bindings align |
| Official dev preview | PASS | `dev_demo.sh --background`, exit 0 |
| Official build | PASS_WITH_CONCERNS | 1,458,241-byte HTML plus two referenced files in `dist/assets/`; not strictly single-file |
| Fixed-task browser QA | PASS | 10/10 tasks, 0 console errors, 0 page errors |
| Responsive behavior | PASS_WITH_CONCERNS | Browser QA uses 1280×900 desktop viewport; no mobile viewport evidence |
| Edge states | PASS_WITH_CONCERNS | Failure exists; success, device-unavailable, and review-service failures are absent or non-executable |
| Clean checkout | NOT_RUN | No fresh checkout reinstall/rebuild was performed |
| Spec/code alignment | PASS_WITH_CONCERNS | Spec describes five pages and broader empty/error coverage; code implements one stateful page with partial branches |

## Score rationale

- Fidelity 14/20: requirements are recognizable, but the console-framed mobile simulation and cropped source imagery create dual UI systems.
- Flow coverage 15/15: all ten contracted tasks pass continuously.
- Interaction 18/20: controls update asserted state and preserve camera facing across retake.
- Visual hierarchy 10/15: hierarchy is readable, but black/cropped imagery and generated controls over full-screen screenshots visibly conflict.
- Edge states 6/10: loading, failure, retry, and a permission example exist; success and executable device/service errors do not.
- Stability 9/10: official build and final Chrome run pass, but no clean-checkout rebuild validates the internal dependency path.
- Handoff 6/10: core files exist, but the output is not strictly single-file, QA hard-codes macOS Chrome, telemetry is not auditable, and spec/code drift remains.

Total: 78/100, `PASS_WITH_CONCERNS`.
