# Open Design native intake — camera upload

Recorded at 2026-07-13T10:00:00Z from the frozen PRD. The experiment brief requires a clean, non-interactive run, so answers are inferred rather than collected from the user.

1. Starting point: no design system exists in this isolated cell. Infer a small product system from PRD screenshots 008–013.
2. Audience: mobile shoppers creating an AI try-on avatar, including live event participants.
3. Primary job: obtain a clear portrait without requiring a suitable existing album photo.
4. Tone: reassuring, direct, camera-native.
5. Fidelity: high-fidelity clickable mobile prototype.
6. Output: one React prototype in the native Open Design mockup structure.
7. Variations: one; the experiment evaluates task coverage, not concept breadth.
8. Variation dimensions: interactions and state transitions matter most; visual novelty is deliberately low.
9. Brand context: match the supplied product screenshots—pale lime modal, black/white camera UI, warm pink-orange primary action.
10. Solution posture: by-the-book; preserve the documented flow and familiar camera conventions.
11. Persistence: current screen, camera facing, selected photo, and review state in localStorage.
12. Review behavior: deterministic failure is available through “Use photo”; retry reopens source choices. Album selection also returns to confirmation so the album task is honest.

## Plan

- Purpose: complete avatar image capture and quality review end to end.
- Tone: calm.
- Differentiation: a live framing guide explains compliance before the shutter, avoiding preventable review failures.
- Build a compact token system, viewer/manifest, React state machine, and documented loading/error/retry paths.
- Run the fixed browser tasks, record raw assertions/errors, and capture entry, intermediate, and failure evidence.

