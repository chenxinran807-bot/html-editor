# Prototype audit

- Reproducible command from repository root: `node experiments/cells/outfit-tab/prd-generator/qa/audit-prototype.cjs experiments/cells/outfit-tab/prd-generator/artifact/docs/prd/outfit-tab/canvas`
- Auditor: locked copy at `qa/audit-prototype.cjs`
- Pages: 1 (`01-outfit`)
- Entry: `01-outfit`
- Hard failures: 0
- Result: entry reaches all states; no broken links, island pages, or dead-end entry.
- Heuristic warning: 17 controls were flagged. Some use JavaScript/event delegation, while the calibrated review retains concerns for shallow or fake affordances such as menu/search, purchase and continue-styling.
