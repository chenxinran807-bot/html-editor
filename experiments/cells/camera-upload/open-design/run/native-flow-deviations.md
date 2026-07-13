# Native-flow deviations

- Open Design requires the intake turn to end after a question form. The experiment explicitly requires completing from a frozen PRD in a clean cell, so answers were inferred from the document and recorded in `intake.md`.
- No design system was present. The normal route asks the user whether to import/create/skip. The PRD contains sufficient visual references, so a task-scoped `camera-product` design system was created and documented instead of pausing.
- `setup-opendesign`, `run-opendesign`, and verifier are specified as subagent dispatches. This assigned cell could not derive those agent contexts; setup and serving were executed locally and the verifier handoff is marked not independently derived. Browser QA is real and reproducible, but it is not represented as a clean-context verifier.
- Browser media hardware is intentionally not accessed. The prototype uses the PRD-provided camera reference as deterministic fake camera data, consistent with the interactive-prototype skill’s allowance for fake data.

