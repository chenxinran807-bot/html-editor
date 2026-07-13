# Native run decisions

- Input is treated as a frozen, already-confirmed PRD source. No interactive clarification was requested.
- Scenario: iteration from product/design material. Complexity: **standard** (one user role, one feature domain, several branches and state changes).
- Design posture: **preserve**. The source explicitly proposes second-level tabs and detail/commerce/AI handoffs inside the existing mobile discovery shell.
- Review mode: native self-review. The experiment request requires review and audit, while this worker was not authorized to delegate.
- The primary journey is: open Outfit → switch a second-level category → open a reason-led card → read suitability/formula/avoidance → open same item or cheaper alternative → enter AI try-on.
- “Lower-cost alternative” is inferred from the explicit 平替 requirement. It is shown as a product option, not a new recommendation engine.
- AI try-on opens an entry state with the selected look carried forward. Camera capture itself is outside this cell’s fixed tasks.
- Like/dislike is represented as lightweight card feedback because it is explicitly in the source; it is not required for the fixed QA journey.
- Empty/error/retry states are included as reviewable feed states. They do not alter the core scope.

