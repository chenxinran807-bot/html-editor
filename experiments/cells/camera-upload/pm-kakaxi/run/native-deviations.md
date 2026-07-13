# Native deviations and mock boundaries

- Device camera input is simulated with the PRD-provided local camera screenshot. No hardware permission is requested.
- Photo quality review is deterministic and local; no network or production review service is called.
- Permission denial, empty album and review timeout are required completeness states inferred for review. They are labeled “评审推断态” in the prototype because no corresponding design screenshots were supplied.
- Album thumbnails reuse supplied fixture screenshots as evaluation placeholders. They should not be interpreted as production album content or pixel-accurate selected states.
- The required ScenarioBar is an external review control, not part of the consumer product UI.
- Usage tracking was not sent because it is optional and would mutate an external Base outside this isolated experiment.
- The prototype intentionally stops at retry after review failure; successful avatar creation and deletion are outside the ten fixed tasks and were not expanded.

