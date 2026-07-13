# PRD → Prototype Skills Native Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run twelve isolated native-flow experiments from two fixed Lark PRD inputs across six prototype capabilities, verify every real artifact, score results, and publish an interactive comparison dashboard.

**Architecture:** A reproducible experiment harness freezes source documents into versioned fixtures, creates one isolated cell per input/skill pair, and stores native artifacts without normalizing their technology. A shared QA layer validates browser behavior and emits normalized `result.json` records; a static dashboard reads only those records and evidence files.

**Tech Stack:** Lark CLI, shell scripts, Node.js, HTML/CSS/JavaScript, Playwright-compatible browser QA, native Skill CLIs/MCPs, local Git.

---

## File map

- `experiments/manifest.json`: canonical list of inputs, skills, cells and status values.
- `experiments/inputs/<input-id>/source.md`: immutable fetched document body.
- `experiments/inputs/<input-id>/metadata.json`: URL, document ID, revision, fetch time and SHA-256.
- `experiments/cells/<input-id>/<skill-id>/`: isolated `input/`, `run/`, `artifact/`, `qa/` and `result.json`.
- `experiments/contracts/result.schema.json`: normalized result contract.
- `experiments/contracts/tasks.json`: fixed browser tasks for each input.
- `scripts/experiment/init-cells.mjs`: validates inputs and creates cell skeletons.
- `scripts/experiment/validate-result.mjs`: validates one or all result records.
- `scripts/experiment/build-dashboard.mjs`: converts validated records into dashboard data.
- `qa/native-experiment.mjs`: browser QA runner for local and remote preview URLs.
- `comparison/native-experiment/index.html`: interactive visual dashboard.
- `comparison/native-experiment/data.json`: generated dashboard model.
- `comparison/native-experiment/report.md`: evidence-backed conclusions and rankings.

### Task 1: Freeze both Lark inputs

**Files:**
- Create: `experiments/inputs/outfit-tab/source.md`
- Create: `experiments/inputs/outfit-tab/metadata.json`
- Create: `experiments/inputs/camera-upload/source.md`
- Create: `experiments/inputs/camera-upload/metadata.json`
- Create: `experiments/manifest.json`

- [ ] **Step 1: Fetch the exact latest revisions**

Run:

```bash
lark-cli docs +fetch --as user --doc 'https://bytedance.larkoffice.com/wiki/HxxGwwkxAiLf9BkiSWgcWXcanbA' --doc-format markdown
lark-cli docs +fetch --as user --doc 'https://bytedance.larkoffice.com/docx/G2S7dXD5Boj5FSxOQYJcuCxJnDd' --doc-format markdown
```

Expected: both responses have `ok: true`, a non-empty `content`, `document_id`, and `revision_id`.

- [ ] **Step 2: Save content without rewriting it**

Store only the returned `content` values as `source.md`. Store URL, document ID, revision ID, ISO fetch time, and the output of `shasum -a 256 source.md` in `metadata.json`.

- [ ] **Step 3: Create the canonical manifest**

Use this status enum in `experiments/manifest.json`:

```json
{
  "statusValues": ["PENDING", "RUNNING", "PASS", "PASS_WITH_CONCERNS", "BLOCKED", "NOT_APPLICABLE"],
  "inputs": ["outfit-tab", "camera-upload"],
  "skills": ["open-design", "huashu-design", "prd-generator", "pm-kakaxi", "vne-prototype", "inspire-prototype"]
}
```

- [ ] **Step 4: Verify fixtures**

Run:

```bash
test -s experiments/inputs/outfit-tab/source.md
test -s experiments/inputs/camera-upload/source.md
shasum -a 256 experiments/inputs/*/source.md
```

Expected: two hashes, each matching its metadata record.

- [ ] **Step 5: Commit**

```bash
git add experiments/inputs experiments/manifest.json
git commit -m "test: freeze prototype experiment inputs"
```

### Task 2: Build isolation and result contracts

**Files:**
- Create: `experiments/contracts/result.schema.json`
- Create: `experiments/contracts/tasks.json`
- Create: `scripts/experiment/init-cells.mjs`
- Create: `scripts/experiment/validate-result.mjs`
- Test: `qa/result-contract.test.mjs`

- [ ] **Step 1: Write a failing contract test**

The test must assert that a valid result contains `inputId`, `skillId`, `status`, seven scoring dimensions, `total`, `artifacts`, `evidence`, `deviations`, and `runtime`; it must reject totals not equal to the seven dimension values.

- [ ] **Step 2: Run the contract test**

Run: `node --test qa/result-contract.test.mjs`

Expected: FAIL because the schema and validator do not exist.

- [ ] **Step 3: Implement the schema and validator**

Use scoring keys and maxima exactly as follows:

```json
{
  "fidelity": 20,
  "flowCoverage": 15,
  "interaction": 20,
  "visualHierarchy": 15,
  "edgeStates": 10,
  "stability": 10,
  "handoff": 10
}
```

For `BLOCKED` and `NOT_APPLICABLE`, require `scores: null`, a non-empty `deviations` array, and a concrete recovery or exclusion reason.

- [ ] **Step 4: Define fixed browser tasks**

`outfit-tab` tasks must cover category switching, opening a reason card, reading suitability/formula/avoidance guidance, opening a product or alternative, and entering AI styling or try-on. `camera-upload` tasks must cover opening upload choices, entering camera, flip, album, close, shutter, retake, use photo, review failure, and retry.

- [ ] **Step 5: Implement cell initialization**

`init-cells.mjs` must create all twelve paths and copy only the matching `source.md` and `metadata.json` into each cell's `input/`. It must fail if a destination cell already contains an artifact, preventing accidental overwrites.

- [ ] **Step 6: Run tests and initialize cells**

Run:

```bash
node --test qa/result-contract.test.mjs
node scripts/experiment/init-cells.mjs
find experiments/cells -name source.md | wc -l
```

Expected: tests PASS and the final count is `12`.

- [ ] **Step 7: Commit**

```bash
git add experiments/contracts experiments/cells scripts/experiment qa/result-contract.test.mjs
git commit -m "test: add isolated native experiment harness"
```

### Task 3: Run Open Design native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/open-design/run/*`
- Create/modify: `experiments/cells/<input-id>/open-design/artifact/*`
- Create/modify: `experiments/cells/<input-id>/open-design/result.json`

- [ ] **Step 1: Read the complete Open Design native skills**

Read `vendor/opendesign/skills/opendesign/SKILL.md`, `interactive-prototype/SKILL.md`, and every directly routed setup/run/design-system reference before generating.

- [ ] **Step 2: Execute `outfit-tab` in its isolated cell**

Use only that cell's `input/` plus Open Design resources. Preserve intake questions, design-system decisions, native `mockups/` structure, manifest and viewer behavior in the run log.

- [ ] **Step 3: Execute `camera-upload` from a clean cell**

Do not inspect the first Open Design artifact. Record every native question, answer inferred from the document, and deviation.

- [ ] **Step 4: Verify native outputs**

Start the native preview on loopback, execute the fixed task set, capture at least entry/intermediate/result-or-failure screenshots, and record page/console errors.

- [ ] **Step 5: Score and validate both records**

Run: `node scripts/experiment/validate-result.mjs experiments/cells/*/open-design/result.json`

Expected: both records valid and have explicit terminal states.

- [ ] **Step 6: Commit**

```bash
git add experiments/cells/*/open-design
git commit -m "test: run Open Design native experiments"
```

### Task 4: Run Huashu Design native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/huashu-design/run/*`
- Create/modify: `experiments/cells/<input-id>/huashu-design/artifact/*`
- Create/modify: `experiments/cells/<input-id>/huashu-design/result.json`

- [ ] **Step 1: Read complete routed Huashu instructions**

Read `vendor/huashu-design/SKILL.md`, `references/app-prototype.md`, workflow, verification, design-context and any branch selected by the native fallback process.

- [ ] **Step 2: Run each input independently**

Allow native reference gathering, three visible design directions when triggered, App/iOS interaction rules and real asset gates. Never reuse the other cell's selected direction.

- [ ] **Step 3: Run native verification**

Execute the required click tests, assert zero page errors, capture all direction-selection evidence plus final-flow evidence, and document any weak-runtime deviation.

- [ ] **Step 4: Score, validate and commit**

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/huashu-design/result.json
git add experiments/cells/*/huashu-design
git commit -m "test: run Huashu Design native experiments"
```

### Task 5: Run PRD Generator native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/prd-generator/run/*`
- Create/modify: `experiments/cells/<input-id>/prd-generator/artifact/*`
- Create/modify: `experiments/cells/<input-id>/prd-generator/result.json`

- [ ] **Step 1: Read the complete PRD Generator skill and routed references**

Include state management, canvas companion, high-fidelity pages, design-system detection, finalization and reviewer instructions selected by the native flow.

- [ ] **Step 2: Run native discovery and companion canvas for each input**

Treat the existing document as the source PRD. Preserve native complexity judgment, journey review, PRD package, `prd.yaml`, companion canvas and review gates. Answers inferred from the document must be written in the run log.

- [ ] **Step 3: Audit and visually verify**

Run the native prototype audit, render every key state, execute the fixed browser tasks, and preserve screenshots and audit output.

- [ ] **Step 4: Score, validate and commit**

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/prd-generator/result.json
git add experiments/cells/*/prd-generator
git commit -m "test: run PRD Generator native experiments"
```

### Task 6: Run PM Kakaxi native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/pm-kakaxi/run/*`
- Create/modify: `experiments/cells/<input-id>/pm-kakaxi/artifact/*`
- Create/modify: `experiments/cells/<input-id>/pm-kakaxi/result.json`

- [ ] **Step 1: Read the complete PM Kakaxi skill and routed references**

Record input-completeness scoring, chosen mode, `demo-context`, hard/soft gates and prohibited-inference decisions.

- [ ] **Step 2: Run each document independently**

Let the native input score determine express, high-fidelity or review mode. Download or mark missing referenced assets according to the skill instead of silently inventing them.

- [ ] **Step 3: Verify, score and commit**

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/pm-kakaxi/result.json
git add experiments/cells/*/pm-kakaxi
git commit -m "test: run PM Kakaxi native experiments"
```

### Task 7: Run VNE Prototype native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/vne-prototype/run/*`
- Create/modify: `experiments/cells/<input-id>/vne-prototype/artifact/*`
- Create/modify: `experiments/cells/<input-id>/vne-prototype/result.json`

- [ ] **Step 1: Read the VNE creation workflow and selected input path**

Run environment gates first. Use PRD-only Path C unless an input image, URL or registered codebase validly activates another documented path.

- [ ] **Step 2: Generate native specifications and projects**

Require UI spec, manifest, scaffold-derived React project, Cloud Materials compliance and single-file build output for each cell.

- [ ] **Step 3: Build and verify**

Use the native build script, run the quality criteria, execute fixed browser tasks, and record bundle size, errors and path deviations.

- [ ] **Step 4: Score, validate and commit**

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/vne-prototype/result.json
git add experiments/cells/*/vne-prototype
git commit -m "test: run VNE Prototype native experiments"
```

### Task 8: Run Inspire Prototype native experiments

**Files:**
- Create/modify: `experiments/cells/<input-id>/inspire-prototype/run/*`
- Create/modify: `experiments/cells/<input-id>/inspire-prototype/artifact/*`
- Create/modify: `experiments/cells/<input-id>/inspire-prototype/result.json`

- [ ] **Step 1: Check identity, schema and visible skills**

Run `inspire-prototype whoami --json`, inspect the current prototype-generation schema, and query `skills visible --json`. Preserve outputs without exposing credentials.

- [ ] **Step 2: Generate one native platform prototype per input**

Use the exact frozen PRD body as the prompt input, select a visible business skill only when the native routing finds a high-confidence match, add `--fail-on-generation-error --wait`, and never reuse one input's asset as the other's reference.

- [ ] **Step 3: Preserve and verify platform outputs**

Record asset ID, inbox link, preview URL, status and captures. Open the preview, execute applicable fixed tasks and record platform limitations.

- [ ] **Step 4: Score, validate and commit**

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/inspire-prototype/result.json
git add experiments/cells/*/inspire-prototype
git commit -m "test: run Inspire Prototype native experiments"
```

### Task 9: Record adjacent-skill applicability

**Files:**
- Create: `experiments/applicability/figma-flow-to-html-demo.json`
- Create: `experiments/applicability/sites-building.json`

- [ ] **Step 1: Evaluate both inputs against Figma-flow gates**

Record whether each source supplies a confirmed flow chain, corresponding cut assets and coordinate source. If any hard gate is missing, set `NOT_APPLICABLE` and name the missing items.

- [ ] **Step 2: Evaluate Sites scope**

Record that Sites can build a web artifact from a requirements document but lacks a dedicated PRD-to-prototype evaluation workflow, so it remains outside the ranked set.

- [ ] **Step 3: Commit**

```bash
git add experiments/applicability
git commit -m "docs: record adjacent prototype skill applicability"
```

### Task 10: Build shared browser QA

**Files:**
- Create: `qa/native-experiment.mjs`
- Create: `qa/native-experiment.test.mjs`
- Create: `qa/fixtures/passing-prototype.html`
- Create: `qa/fixtures/dead-control-prototype.html`

- [ ] **Step 1: Write failing QA tests**

Tests must prove the runner captures screenshots and reports zero errors for the passing fixture, then detects an unhandled page error or dead required control in the failing fixture.

- [ ] **Step 2: Run tests to confirm failure**

Run: `node --test qa/native-experiment.test.mjs`

Expected: FAIL because the runner is missing.

- [ ] **Step 3: Implement the QA runner**

The runner accepts `--url`, `--tasks`, `--output`, and `--viewport`; emits `qa.json`; captures every named task checkpoint; records console errors, page errors, failed steps and elapsed time; never edits the artifact.

- [ ] **Step 4: Run tests and all successful cells**

Run:

```bash
node --test qa/native-experiment.test.mjs
node qa/native-experiment.mjs --help
```

Expected: tests PASS and help lists all four required flags.

- [ ] **Step 5: Commit**

```bash
git add qa
git commit -m "test: add shared browser QA for prototype experiments"
```

### Task 11: Generate rankings and visual dashboard

**Files:**
- Create: `scripts/experiment/build-dashboard.mjs`
- Create: `comparison/native-experiment/index.html`
- Generate: `comparison/native-experiment/data.json`
- Create: `comparison/native-experiment/report.md`
- Test: `qa/dashboard.test.mjs`

- [ ] **Step 1: Write failing dashboard tests**

Assert that all twelve cells appear, each input has a separate ordered ranking, blocked cells are not assigned invented totals, artifact links resolve, and applicability records appear outside rankings.

- [ ] **Step 2: Implement dashboard data generation**

Validate every `result.json` before aggregation. Sort successful cells by total descending, then fidelity, interaction and stability. Compute per-skill cross-input score difference only when both totals exist.

- [ ] **Step 3: Implement the visual dashboard**

Provide overview, two rankings, score breakdowns, evidence gallery, artifact links, native-flow deviations, cross-input comparison and applicability sections. Use relative paths so the dashboard works from a loopback static server.

- [ ] **Step 4: Write the evidence-backed report**

Every recommendation must cite a cell result and evidence path. Include best use, main weakness, recommended scenario and avoid scenario for all six skills.

- [ ] **Step 5: Build and test**

Run:

```bash
node scripts/experiment/build-dashboard.mjs
node --test qa/dashboard.test.mjs
```

Expected: dashboard tests PASS and `data.json` contains twelve cells.

- [ ] **Step 6: Commit**

```bash
git add scripts/experiment/build-dashboard.mjs comparison/native-experiment qa/dashboard.test.mjs
git commit -m "feat: publish native prototype skill comparison"
```

### Task 12: Final verification and handoff

**Files:**
- Modify: `comparison/native-experiment/report.md`
- Create: `experiments/final-verification.json`

- [ ] **Step 1: Validate all terminal states**

Run:

```bash
node scripts/experiment/validate-result.mjs experiments/cells/*/*/result.json
find experiments/cells -name result.json | wc -l
```

Expected: validation PASS and count `12`.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
node --test qa/result-contract.test.mjs qa/native-experiment.test.mjs qa/dashboard.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 3: Serve and inspect the dashboard**

Run a loopback static server, open `comparison/native-experiment/`, verify every local artifact/evidence link and record the dashboard URL in `final-verification.json`.

- [ ] **Step 4: Check repository hygiene**

Run:

```bash
git status -sb
git log --oneline --decorate -12
```

Expected: no uncommitted experiment changes; commits correspond to the tasks above. Pre-existing untracked files may remain and must not be added accidentally.

- [ ] **Step 5: Commit final verification**

```bash
git add experiments/final-verification.json comparison/native-experiment/report.md
git commit -m "test: finalize native prototype experiment evidence"
```

