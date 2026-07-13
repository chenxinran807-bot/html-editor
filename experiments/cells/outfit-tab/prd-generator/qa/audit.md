# Prototype audit

- Command: `audit-prototype.cjs artifact`
- Pages: 1 (`01-outfit`)
- Entry: `01-outfit`
- Hard failures: 0
- Result: entry reaches all states; no broken links, island pages, or dead-end entry.
- Heuristic warning: 17 controls were flagged because handlers are attached through JavaScript/event delegation. Manual browser rendering confirmed category, card, product, back, AI, feedback, retry, and state-preview handlers. Menu/search/global shell labels are decorative shell controls and do not advertise an in-scope destination.

