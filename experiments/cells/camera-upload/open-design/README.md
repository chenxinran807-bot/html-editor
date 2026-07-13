# Camera upload × Open Design

## Outcome

The artifact is a local React prototype covering all ten contracted camera-upload tasks. Its final experiment status is `PASS_WITH_CONCERNS`, scored 85/100 after independent review.

## Evidence boundaries

- Real Chrome QA passed the ten contracted failure-path tasks at 390×844 with zero console and page errors. A 430×900 smoke test also passed.
- The replay script expects an Open Design HTTP server to already be available on port 8289; it does not start or stop that server itself.
- Structured raw evidence contains browser/timing data and per-task assertions for the ten contracted tasks. The later successful album-review branch and second viewport are visible in screenshots and stdout, but are not represented as structured per-task raw entries.
- Some screenshots landed within the 240ms entry animation and show partially transparent intermediate frames rather than settled UI.

## Known product limitations

- The PRD-provided toy-camera image is used as deterministic camera content. A complete supplied UI screenshot is reused as the nominal successful portrait, creating visible nested-interface or “UI inside UI” artifacts.
- The agreement circle is static rather than toggleable. Album thumbnails do not expose a selected state.
- A successful review enables “完成”, but completion only produces a toast; it does not route to a durable avatar or try-on destination.
- Permission denial, empty album, network failure and review timeout are not modeled.

## Native-flow limitations

The intake was inferred from the frozen PRD. Independent `setup-opendesign`, `run-opendesign`, and clean-context verifier agents could not be derived, so local setup, serving and browser QA were used and disclosed instead. The dependency-boundary correction and final pinned-file hashes are recorded in `run/native-flow-deviations.md`.

## Final score

| Dimension | Score |
|---|---:|
| Fidelity | 16/20 |
| Flow coverage | 15/15 |
| Interaction | 18/20 |
| Visual hierarchy | 12/15 |
| Edge states | 8/10 |
| Stability | 9/10 |
| Handoff | 7/10 |
| Total | 85/100 |

