# PRD Fidelity Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `prd-to-editable-demo` so it preserves PRD information without putting background material into the UI, blocks on consequential ambiguity, executes a frozen page-and-flow baseline, binds each reference image to explicit visual properties, and verifies the core journey in the user's actual final deliverable.

**Architecture:** Keep one public Skill and CLI, but add five focused internal modules: lossless requirements validation, progressive clarification, baseline compilation, visual-reference binding, and fidelity verification. Existing renderers and Inspire routing consume the frozen baseline instead of independently interpreting the PRD; deterministic checks produce machine-readable evidence and block delivery when requirements are unresolved or core paths are not reachable.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON artifacts, existing HTML renderer, Playwright for browser-path verification.

---

## File structure

- Create `src/requirements-ir-v2.mjs`: validate and normalize lossless source units, typed requirements, hierarchy, pages, regions, actions, and flows.
- Create `src/clarification.mjs`: derive a short ordered queue and apply user answers without exposing the whole IR.
- Create `src/execution-baseline.mjs`: compile confirmed IR and image bindings into immutable page-level execution slices.
- Create `src/visual-references.mjs`: validate per-image scope, property, fidelity, exclusion, and conflict rules.
- Create `src/fidelity-verifier.mjs`: verify traceability, hierarchy, copy, reachability, functional actions, visual bindings, and unexplained additions.
- Create `schemas/requirements-ir-v2.schema.json`: document the persisted IR contract.
- Create `schemas/visual-reference-manifest.schema.json`: document the persisted image-reference contract.
- Create `references/clarification.md`, `references/execution-contract.md`, `references/visual-reference.md`, `references/fidelity-verification.md`: focused model protocols read by the public Skill.
- Modify `bin/prd-to-editable-demo.mjs`: accept v2 artifacts, emit blockers, and route only after the baseline is ready.
- Modify `src/semantic-to-model.mjs`: render page regions and actions from the baseline instead of flattening arrays.
- Modify `src/write-output.mjs`: persist source map, IR, baseline, traceability, and fidelity reports.
- Modify `src/verify-demo.mjs`: delegate product-fidelity checks to the new verifier.
- Modify `scripts/browser-e2e.mjs`: execute declared core journeys in the final local artifact or, when online delivery is requested, the final URL.
- Modify `SKILL.md`, `references/requirements-ir.md`, and `references/quality-gates.md`: make the four contracts and progressive interaction mandatory.
- Add focused tests under `test/` for every module and CLI gate.

### Task 1: Lossless, typed requirements IR

**Files:**
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/requirements-ir-v2.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/schemas/requirements-ir-v2.schema.json`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/requirements-ir-v2.test.mjs`

- [ ] **Step 1: Write failing tests for lossless coverage, information purpose, and hierarchy**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequirementsIrV2 } from '../src/requirements-ir-v2.mjs';

const source = '# Discover\nMarket grows 20%.\nUsers choose a category, then a subtype, then open an item detail.';
const valid = {
  schemaVersion: 2,
  sourceUnits: [
    { id: 'S1', quote: 'Market grows 20%.', purpose: 'business_context' },
    { id: 'S2', quote: 'Users choose a category, then a subtype, then open an item detail.', purpose: 'product_requirement' }
  ],
  requirements: [
    { id: 'R1', statement: 'Choose category', sourceIds: ['S2'], certainty: 'explicit', priority: 'P0', uiEligible: true },
    { id: 'R2', statement: 'Market grows 20%', sourceIds: ['S1'], certainty: 'explicit', priority: 'P2', uiEligible: false }
  ],
  taxonomy: [{ id: 'T1', label: 'Category', parentId: null }, { id: 'T2', label: 'Subtype', parentId: 'T1' }],
  pages: [{ id: 'P1', name: 'Feed', regions: [{ id: 'RG1', role: 'category-nav', order: 1 }] }, { id: 'P2', name: 'Detail', regions: [] }],
  actions: [{ id: 'A1', label: 'Open detail', trigger: 'tap', from: 'P1', to: 'P2', sourceIds: ['S2'] }],
  coreJourneys: [{ id: 'J1', start: 'P1', steps: ['A1'], expectedEnd: 'P2' }],
  blockers: []
};

test('accepts complete typed IR without flattening hierarchy', () => {
  const result = validateRequirementsIrV2(valid, source);
  assert.equal(result.taxonomy.find(node => node.id === 'T2').parentId, 'T1');
  assert.equal(result.sourceUnits.find(unit => unit.id === 'S1').purpose, 'business_context');
});

test('rejects source text that is not mapped', () => {
  assert.throws(() => validateRequirementsIrV2({ ...valid, sourceUnits: valid.sourceUnits.slice(1) }, source), /unmapped source content/i);
});

test('rejects background information marked for UI rendering', () => {
  const requirements = valid.requirements.map(item => item.id === 'R2' ? { ...item, uiEligible: true } : item);
  assert.throws(() => validateRequirementsIrV2({ ...valid, requirements }, source), /background information cannot be UI eligible/i);
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/requirements-ir-v2.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/requirements-ir-v2.mjs`.

- [ ] **Step 3: Implement the validator and persisted schema**

```js
const PURPOSES = new Set(['product_requirement', 'acceptance_criterion', 'design_constraint', 'business_context', 'research_evidence', 'delivery_metadata']);
const CERTAINTY = new Set(['explicit', 'derived', 'confirmed', 'assumed', 'missing', 'conflicting']);

export function validateRequirementsIrV2(input, source) {
  if (input?.schemaVersion !== 2) throw new Error('requirements IR schemaVersion must be 2');
  for (const field of ['sourceUnits', 'requirements', 'taxonomy', 'pages', 'actions', 'coreJourneys', 'blockers']) {
    if (!Array.isArray(input[field])) throw new Error(`${field} must be an array`);
  }
  const sourceIds = new Set(input.sourceUnits.map(unit => unit.id));
  for (const unit of input.sourceUnits) {
    if (!PURPOSES.has(unit.purpose)) throw new Error(`invalid source purpose: ${unit.purpose}`);
    if (!source.includes(unit.quote)) throw new Error(`source quote not found: ${unit.quote}`);
  }
  const compact = value => value.replace(/\s+/g, ' ').trim();
  const uncovered = compact(source.replace(/^#.*$/gm, '')).split(/(?<=[.!?。！？])\s*/).filter(Boolean)
    .filter(fragment => !input.sourceUnits.some(unit => compact(unit.quote).includes(fragment) || fragment.includes(compact(unit.quote))));
  if (uncovered.length) throw new Error(`unmapped source content: ${uncovered[0]}`);
  for (const requirement of input.requirements) {
    if (!CERTAINTY.has(requirement.certainty)) throw new Error(`invalid certainty: ${requirement.certainty}`);
    if (requirement.sourceIds.some(id => !sourceIds.has(id))) throw new Error(`unknown source id in ${requirement.id}`);
    const purposes = requirement.sourceIds.map(id => input.sourceUnits.find(unit => unit.id === id).purpose);
    if (requirement.uiEligible && purposes.every(purpose => purpose !== 'product_requirement')) {
      throw new Error('background information cannot be UI eligible');
    }
  }
  const taxonomyIds = new Set(input.taxonomy.map(node => node.id));
  for (const node of input.taxonomy) if (node.parentId && !taxonomyIds.has(node.parentId)) throw new Error(`unknown taxonomy parent: ${node.parentId}`);
  return structuredClone(input);
}
```

Persist the contract with this schema skeleton; expand each referenced `$defs` object with the exact properties accepted by the validator and keep `additionalProperties: false`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schemaVersion", "sourceUnits", "requirements", "taxonomy", "pages", "actions", "coreJourneys", "blockers"],
  "properties": {
    "schemaVersion": { "const": 2 },
    "sourceUnits": { "type": "array", "items": { "$ref": "#/$defs/sourceUnit" } },
    "requirements": { "type": "array", "items": { "$ref": "#/$defs/requirement" } },
    "taxonomy": { "type": "array", "items": { "$ref": "#/$defs/taxonomyNode" } },
    "pages": { "type": "array", "items": { "$ref": "#/$defs/page" } },
    "actions": { "type": "array", "items": { "$ref": "#/$defs/action" } },
    "coreJourneys": { "type": "array", "items": { "$ref": "#/$defs/journey" } },
    "blockers": { "type": "array", "items": { "$ref": "#/$defs/blocker" } }
  },
  "additionalProperties": false
}
```

- [ ] **Step 4: Run the test and full suite**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/requirements-ir-v2.test.mjs && npm test`

Expected: focused tests PASS; existing suite PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/src/requirements-ir-v2.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/schemas/requirements-ir-v2.schema.json work/prd-to-editable-demo-repo/prd-to-editable-demo/test/requirements-ir-v2.test.mjs
git commit -m "feat: add lossless requirements IR"
```

### Task 2: Progressive clarification and blocking rules

**Files:**
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/clarification.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/clarification.test.mjs`

- [ ] **Step 1: Write failing tests for short, ordered confirmation turns**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClarificationTurn, applyClarifications } from '../src/clarification.mjs';

test('returns one theme and at most three related decisions', () => {
  const blockers = [
    { id: 'B1', theme: 'home-layout', priority: 'P0', question: 'Which hero position?', options: ['Top', 'Below tabs'] },
    { id: 'B2', theme: 'home-layout', priority: 'P0', question: 'Which tab style?', options: ['Text', 'Image'] },
    { id: 'B3', theme: 'home-layout', priority: 'P1', question: 'Sticky tabs?', options: ['Yes', 'No'] },
    { id: 'B4', theme: 'detail-flow', priority: 'P0', question: 'Page or sheet?', options: ['Page', 'Sheet'] }
  ];
  const turn = buildClarificationTurn(blockers);
  assert.equal(turn.theme, 'home-layout');
  assert.equal(turn.questions.length, 3);
  assert.ok(turn.questions.every(item => item.theme === turn.theme));
});

test('records answers as confirmed and leaves unrelated blockers unresolved', () => {
  const ir = { requirements: [{ id: 'R1', certainty: 'missing' }], blockers: [{ id: 'B1', requirementId: 'R1' }, { id: 'B2', requirementId: 'R2' }] };
  const result = applyClarifications(ir, [{ blockerId: 'B1', answer: 'Top', answeredAt: '2026-07-15T00:00:00Z' }]);
  assert.equal(result.requirements[0].certainty, 'confirmed');
  assert.deepEqual(result.blockers.map(item => item.id), ['B2']);
  assert.equal(result.confirmations[0].answer, 'Top');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/clarification.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement priority ordering, one-theme turns, and immutable answer application**

```js
const rank = { P0: 0, P1: 1, P2: 2 };

export function buildClarificationTurn(blockers) {
  const ordered = [...blockers].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  if (!ordered.length) return null;
  const theme = ordered[0].theme;
  return { theme, questions: ordered.filter(item => item.theme === theme).slice(0, 3) };
}

export function applyClarifications(ir, answers) {
  const byBlocker = new Map(answers.map(answer => [answer.blockerId, answer]));
  const resolvedRequirementIds = new Set(ir.blockers.filter(item => byBlocker.has(item.id)).map(item => item.requirementId));
  return {
    ...structuredClone(ir),
    requirements: ir.requirements.map(item => resolvedRequirementIds.has(item.id) ? { ...item, certainty: 'confirmed' } : item),
    blockers: ir.blockers.filter(item => !byBlocker.has(item.id)),
    confirmations: [...(ir.confirmations ?? []), ...answers]
  };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/clarification.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/src/clarification.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/test/clarification.test.mjs
git commit -m "feat: add progressive clarification queue"
```

### Task 3: Per-image visual reference contracts

**Files:**
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/visual-references.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/schemas/visual-reference-manifest.schema.json`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/visual-references.test.mjs`

- [ ] **Step 1: Write failing tests for explicit scopes and conflicts**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVisualReferences } from '../src/visual-references.mjs';

test('keeps color-only and structure-only references separate', () => {
  const result = validateVisualReferences([
    { id: 'REF1', asset: 'a.png', scope: { pageId: 'P1' }, bindings: [{ property: 'color', fidelity: 'exact' }], exclude: ['layout'] },
    { id: 'REF2', asset: 'b.png', scope: { pageId: 'P1', regionId: 'RG1' }, bindings: [{ property: 'layout', fidelity: 'exact' }], exclude: ['color'] }
  ]);
  assert.deepEqual(result[0].bindings.map(item => item.property), ['color']);
  assert.deepEqual(result[1].bindings.map(item => item.property), ['layout']);
});

test('rejects competing exact bindings for the same scope and property', () => {
  assert.throws(() => validateVisualReferences([
    { id: 'REF1', asset: 'a.png', scope: { pageId: 'P1' }, bindings: [{ property: 'color', fidelity: 'exact' }], exclude: [] },
    { id: 'REF2', asset: 'b.png', scope: { pageId: 'P1' }, bindings: [{ property: 'color', fidelity: 'exact' }], exclude: [] }
  ]), /visual reference conflict/i);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/visual-references.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement validation and conflict detection**

```js
const PROPERTIES = new Set(['layout', 'relative-position', 'proportion', 'spacing', 'color', 'typography', 'iconography', 'imagery', 'crop', 'component', 'copy-style', 'interaction-feedback']);
const FIDELITY = new Set(['exact', 'high', 'local', 'inspiration']);

export function validateVisualReferences(references) {
  const claims = new Map();
  for (const reference of references) {
    if (!reference.id || !reference.asset || !reference.scope?.pageId) throw new Error('visual reference requires id, asset, and page scope');
    for (const binding of reference.bindings ?? []) {
      if (!PROPERTIES.has(binding.property) || !FIDELITY.has(binding.fidelity)) throw new Error(`invalid visual binding in ${reference.id}`);
      const key = `${reference.scope.pageId}:${reference.scope.regionId ?? '*'}:${binding.property}`;
      if (binding.fidelity === 'exact' && claims.has(key)) throw new Error(`visual reference conflict: ${key}`);
      if (binding.fidelity === 'exact') claims.set(key, reference.id);
      if ((reference.exclude ?? []).includes(binding.property)) throw new Error(`binding is also excluded: ${binding.property}`);
    }
  }
  return structuredClone(references);
}
```

Use this top-level visual-reference schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "asset", "scope", "bindings", "exclude"],
    "properties": {
      "id": { "type": "string", "minLength": 1 },
      "asset": { "type": "string", "minLength": 1 },
      "scope": { "type": "object", "required": ["pageId"], "properties": { "pageId": { "type": "string" }, "regionId": { "type": "string" } }, "additionalProperties": false },
      "bindings": { "type": "array", "items": { "type": "object", "required": ["property", "fidelity"], "properties": { "property": { "enum": ["layout", "relative-position", "proportion", "spacing", "color", "typography", "iconography", "imagery", "crop", "component", "copy-style", "interaction-feedback"] }, "fidelity": { "enum": ["exact", "high", "local", "inspiration"] } }, "additionalProperties": false } },
      "exclude": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
    },
    "additionalProperties": false
  }
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/visual-references.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/src/visual-references.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/schemas/visual-reference-manifest.schema.json work/prd-to-editable-demo-repo/prd-to-editable-demo/test/visual-references.test.mjs
git commit -m "feat: bind visual references explicitly"
```

### Task 4: Compile the frozen execution baseline

**Files:**
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/execution-baseline.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/execution-baseline.test.mjs`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/semantic-to-model.mjs`

- [ ] **Step 1: Write failing tests for blockers, page slices, and hierarchy preservation**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExecutionBaseline } from '../src/execution-baseline.mjs';

const ir = {
  schemaVersion: 2, blockers: [], requirements: [
    { id: 'R1', statement: 'Show exact title', exactCopy: 'Discover', uiEligible: true, certainty: 'explicit', targetIds: ['RG1'] }
  ],
  taxonomy: [{ id: 'T1', label: 'Category', parentId: null }, { id: 'T2', label: 'Subtype', parentId: 'T1' }],
  pages: [{ id: 'P1', name: 'Feed', regions: [{ id: 'RG1', role: 'hero', order: 1 }] }],
  actions: [], coreJourneys: []
};

test('compiles page slices with exact copy and taxonomy', () => {
  const baseline = compileExecutionBaseline(ir, []);
  assert.equal(baseline.version, 1);
  assert.equal(baseline.pages[0].requirements[0].exactCopy, 'Discover');
  assert.equal(baseline.taxonomy[1].parentId, 'T1');
});

test('refuses to compile unresolved consequential blockers', () => {
  assert.throws(() => compileExecutionBaseline({ ...ir, blockers: [{ id: 'B1', priority: 'P0' }] }, []), /unresolved blockers/i);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/execution-baseline.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement compilation and update model conversion to consume page slices**

```js
export function compileExecutionBaseline(ir, visualReferences, previous = null) {
  if (ir.blockers.some(item => item.priority === 'P0' || item.priority === 'P1')) throw new Error('unresolved blockers prevent baseline compilation');
  return {
    schemaVersion: 1,
    version: (previous?.version ?? 0) + 1,
    taxonomy: structuredClone(ir.taxonomy),
    journeys: structuredClone(ir.coreJourneys),
    pages: ir.pages.map(page => ({
      ...structuredClone(page),
      requirements: ir.requirements.filter(item => item.uiEligible && (item.targetIds ?? []).some(id => id === page.id || page.regions.some(region => region.id === id))),
      actions: ir.actions.filter(action => action.from === page.id),
      visualReferences: visualReferences.filter(reference => reference.scope.pageId === page.id)
    }))
  };
}
```

In `semantic-to-model.mjs`, add `executionBaselineToModel(baseline, product)` that sorts regions by `order`, creates exact-copy elements from the page slice, and creates navigation actions only from `page.actions`. Preserve taxonomy as `model.taxonomy` and journeys as `model.coreJourneys`; do not place non-UI requirements in `elements`.

- [ ] **Step 4: Run focused and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/execution-baseline.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/src/execution-baseline.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/src/semantic-to-model.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/test/execution-baseline.test.mjs
git commit -m "feat: compile frozen execution baseline"
```

### Task 5: Fidelity and functional reachability verification

**Files:**
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/fidelity-verifier.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/fidelity-verifier.test.mjs`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/verify-demo.mjs`

- [ ] **Step 1: Write failing tests for copy, hierarchy, reachability, and static placeholders**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFidelity } from '../src/fidelity-verifier.mjs';

const baseline = {
  taxonomy: [{ id: 'T1', parentId: null }, { id: 'T2', parentId: 'T1' }],
  pages: [
    { id: 'P1', requirements: [{ id: 'R1', exactCopy: 'Discover' }], actions: [{ id: 'A1', from: 'P1', to: 'P2' }] },
    { id: 'P2', requirements: [], actions: [{ id: 'A2', from: 'P2', to: 'P1' }] }
  ],
  journeys: [{ id: 'J1', start: 'P1', steps: ['A1', 'A2'], expectedEnd: 'P1' }]
};

test('rejects exact copy changes', () => {
  const model = { taxonomy: baseline.taxonomy, pages: [{ id: 'P1', elements: [{ text: 'Explore' }] }, { id: 'P2', elements: [] }] };
  assert.throws(() => verifyFidelity({ baseline, model }), /exact copy/i);
});

test('rejects a declared action that has no functional target', () => {
  const model = { taxonomy: baseline.taxonomy, pages: [{ id: 'P1', elements: [{ text: 'Discover' }, { actionId: 'A1', action: { type: 'notice' } }] }, { id: 'P2', elements: [] }] };
  assert.throws(() => verifyFidelity({ baseline, model }), /not reachable and functional/i);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/fidelity-verifier.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic fidelity checks and wire them into `verifyDemo`**

```js
export function verifyFidelity({ baseline, model }) {
  const pages = new Map(model.pages.map(page => [page.id, page]));
  for (const expected of baseline.pages) {
    const actual = pages.get(expected.id);
    if (!actual) throw new Error(`missing required page: ${expected.id}`);
    const copy = (actual.elements ?? []).map(item => item.text).filter(Boolean);
    for (const requirement of expected.requirements) {
      if (requirement.exactCopy && !copy.includes(requirement.exactCopy)) throw new Error(`exact copy mismatch: ${requirement.id}`);
    }
    for (const action of expected.actions) {
      const element = (actual.elements ?? []).find(item => item.actionId === action.id);
      if (!element || element.action?.type !== 'navigate' || element.action.target !== action.to) {
        throw new Error(`action is not reachable and functional: ${action.id}`);
      }
    }
  }
  if (JSON.stringify(model.taxonomy) !== JSON.stringify(baseline.taxonomy)) throw new Error('information hierarchy mismatch');
  return { status: 'passed', checks: ['pages', 'exact-copy', 'hierarchy', 'functional-actions'] };
}
```

Update `verifyDemo({ html, manifest })` to call `verifyFidelity({ baseline: manifest.executionBaseline, model: manifest })` when `executionBaseline` exists, and include its returned checks in the report.

- [ ] **Step 4: Run focused and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/fidelity-verifier.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/src/fidelity-verifier.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/src/verify-demo.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/test/fidelity-verifier.test.mjs
git commit -m "feat: verify PRD fidelity and reachability"
```

### Task 6: CLI gates and traceable output artifacts

**Files:**
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/bin/prd-to-editable-demo.mjs`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/src/write-output.mjs`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/cli.test.mjs`

- [ ] **Step 1: Add failing CLI tests for unresolved blockers and complete artifacts**

```js
test('stops before rendering when the confirmed baseline is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'fidelity-blocker-'));
  const prd = join(root, 'prd.md'); const ir = join(root, 'ir.json'); const out = join(root, 'out');
  writeFileSync(prd, '# Feed\nUsers open an item.');
  writeFileSync(ir, JSON.stringify({ schemaVersion: 2, sourceUnits: [], requirements: [], taxonomy: [], pages: [], actions: [], coreJourneys: [], blockers: [{ id: 'B1', theme: 'flow', priority: 'P0', question: 'Where does the item open?', options: ['Page', 'Sheet'] }] }));
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', ir, '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 5);
  const blocker = JSON.parse(readFileSync(join(out, 'clarification-required.json'), 'utf8'));
  assert.ok(blocker.turn.questions.length <= 3);
});

test('writes fidelity artifacts when the frozen baseline passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'fidelity-output-'));
  const prd = join(root, 'prd.md'); const ir = join(root, 'ir.json'); const confirmations = join(root, 'confirmations.json'); const references = join(root, 'references.json'); const out = join(root, 'out');
  writeFileSync(prd, '# Feed\nUsers open an item.');
  writeFileSync(ir, JSON.stringify(validIrFixture));
  writeFileSync(confirmations, '[]'); writeFileSync(references, '[]');
  const result = spawnSync(process.execPath, ['bin/prd-to-editable-demo.mjs', '--prd', prd, '--requirements-v2', ir, '--confirmations', confirmations, '--visual-references', references, '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['prd-source-map.json', 'requirements-ir.json', 'page-flow-graph.json', 'visual-reference-manifest.json', 'confirmation-record.json', 'requirements-baseline.json', 'traceability-matrix.json', 'fidelity-report.md']) assert.ok(readFileSync(join(out, name), 'utf8').length > 0);
});
```

- [ ] **Step 2: Run the CLI tests and verify argument/artifact failures**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/cli.test.mjs`

Expected: FAIL because the new arguments and files do not exist.

- [ ] **Step 3: Implement CLI parsing and gate order**

Add `--requirements-v2`, `--confirmations`, and `--visual-references` to `parseArgs`. In `main`, validate the v2 IR, apply confirmations, emit `clarification-required.json` and return `5` when `buildClarificationTurn` returns a turn, validate image bindings, compile the baseline, then select the rendering route. Pass `{ ir, baseline, visualReferences, confirmations }` to `writeOutput`.

Extend `writeOutput` with:

```js
const fidelityFiles = context ? {
  'prd-source-map.json': JSON.stringify(context.ir.sourceUnits, null, 2),
  'requirements-ir.json': JSON.stringify(context.ir, null, 2),
  'page-flow-graph.json': JSON.stringify({ actions: context.ir.actions, journeys: context.ir.coreJourneys }, null, 2),
  'visual-reference-manifest.json': JSON.stringify(context.visualReferences, null, 2),
  'confirmation-record.json': JSON.stringify(context.confirmations, null, 2),
  'requirements-baseline.json': JSON.stringify(context.baseline, null, 2),
  'traceability-matrix.json': JSON.stringify(context.ir.requirements.map(item => ({ requirementId: item.id, sourceIds: item.sourceIds, targetIds: item.targetIds })), null, 2),
  'fidelity-report.md': '# Fidelity report\n\n- Status: passed\n- Unresolved blockers: 0\n'
} : {};
```

Merge `fidelityFiles` into the existing `files` object without changing legacy output names.

- [ ] **Step 4: Run CLI and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/cli.test.mjs && npm test`

Expected: all tests PASS; legacy CLI remains compatible.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/bin/prd-to-editable-demo.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/src/write-output.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/test/cli.test.mjs
git commit -m "feat: gate generation on confirmed requirements"
```

### Task 7: Final-deliverable core-journey verification

**Files:**
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/scripts/browser-e2e.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/final-deliverable-journey.test.mjs`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/package.json`

- [ ] **Step 1: Write a failing browser test that walks declared journeys**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPublishedJourneys } from '../scripts/browser-e2e.mjs';

test('fails when a final-artifact core action is only a notice', async () => {
  const fixtureUrl = `data:text/html,${encodeURIComponent('<main data-page-id="P1"><button data-action-id="A1" onclick="alert(1)">Open</button></main>')}`;
  await assert.rejects(() => verifyPublishedJourneys({
    url: fixtureUrl,
    journeys: [{ id: 'J1', start: 'P1', steps: [{ actionId: 'A1', expectedPage: 'P2' }] }]
  }), /final deliverable journey failed: J1.*A1/);
});
```

- [ ] **Step 2: Run the browser test and verify the missing export failure**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/final-deliverable-journey.test.mjs`

Expected: FAIL because `verifyPublishedJourneys` is not exported.

- [ ] **Step 3: Implement journey walking against a real URL**

```js
export async function verifyPublishedJourneys({ url, journeys }) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const journey of journeys) {
      for (const step of journey.steps) {
        await page.locator(`[data-action-id="${step.actionId}"]`).click();
        const visible = await page.locator(`[data-page-id="${step.expectedPage}"]:not([hidden])`).count();
        if (visible !== 1) throw new Error(`final deliverable journey failed: ${journey.id} ${step.actionId}`);
      }
    }
    return { status: 'passed', journeys: journeys.map(item => item.id) };
  } finally {
    await browser.close();
  }
}
```

Ensure `render-demo.mjs` emits `data-action-id` from each element's `actionId`. Add `"verify:delivery": "node scripts/browser-e2e.mjs"` to `package.json`. The verifier must serve the generated local output directory by default; only when `DELIVERY_URL` is explicitly supplied should it verify an online final URL.

- [ ] **Step 4: Run browser, smoke, and full tests**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && npm run test:browser && npm run smoke && npm test`

Expected: browser journeys PASS, smoke PASS, full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/scripts/browser-e2e.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/src/render-demo.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/test/final-deliverable-journey.test.mjs work/prd-to-editable-demo-repo/prd-to-editable-demo/package.json
git commit -m "test: verify final-deliverable core journeys"
```

### Task 8: Skill protocols, behavioral fixtures, and release gate

**Files:**
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/SKILL.md`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/requirements-ir.md`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/quality-gates.md`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/clarification.md`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/execution-contract.md`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/visual-reference.md`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/references/fidelity-verification.md`
- Modify: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/skill.test.mjs`
- Create: `work/prd-to-editable-demo-repo/prd-to-editable-demo/test/fidelity-behavior.test.mjs`

- [ ] **Step 1: Write failing protocol and behavioral tests**

```js
test('Skill orders fidelity contracts before delivery routing', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  const understanding = source.indexOf('理解契约');
  const routing = source.indexOf('专业交付到 Inspire');
  assert.ok(understanding >= 0 && routing > understanding);
  for (const file of ['clarification.md', 'execution-contract.md', 'visual-reference.md', 'fidelity-verification.md']) assert.match(source, new RegExp(file));
});

test('background material never becomes visible product copy', () => {
  const baseline = { taxonomy: [], journeys: [], pages: [{ id: 'P1', name: 'Feed', regions: [{ id: 'RG1', role: 'hero', order: 1 }], requirements: [{ id: 'R1', statement: 'Show products', exactCopy: 'Products', uiEligible: true, targetIds: ['RG1'] }], actions: [], visualReferences: [] }] };
  const model = executionBaselineToModel(baseline, { name: 'Discovery', goal: 'Open a product' });
  const visible = model.pages.flatMap(page => page.elements.map(item => item.text ?? '')).join(' ');
  assert.doesNotMatch(visible, /market growth|competitor|P0/i);
});
```

- [ ] **Step 2: Run the tests and verify missing protocol failures**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && node --test test/skill.test.mjs test/fidelity-behavior.test.mjs`

Expected: FAIL because the protocol files and required ordering are absent.

- [ ] **Step 3: Update the public Skill and add focused protocols**

In `SKILL.md`, keep the trigger and single public entry. Replace the current top-level execution order with:

```markdown
## Mandatory order

1. Read `references/requirements-ir.md` and produce lossless v2 IR.
2. If clarification is required, read `references/clarification.md`; ask one theme with at most three decisions, then stop.
3. Read `references/visual-reference.md` for every supplied image and obtain confirmation for consequential bindings or conflicts.
4. Read `references/execution-contract.md`; freeze the baseline before selecting HTML or Inspire.
5. Generate from page slices; do not reinterpret the PRD.
6. Read `references/fidelity-verification.md` and `references/quality-gates.md`; verify the final local artifact, and verify an online URL only when online delivery is requested.
7. Select and complete the delivery container only after fidelity gates pass.
```

Each new reference file must contain its input, output, blocking conditions, prohibited shortcuts, and one domain-neutral JSON example matching the implemented types. State explicitly that research, metrics, prioritization, and delivery metadata remain traceable but are not UI content.

- [ ] **Step 4: Run every release gate**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && npm test && npm run benchmark && npm run smoke && npm run test:browser && npm run package`

Expected: tests PASS, benchmark PASS, smoke PASS, browser PASS, and `dist/prd-to-editable-demo-skill.zip` is rebuilt successfully.

- [ ] **Step 5: Inspect the package and confirm required protocols ship**

Run: `cd work/prd-to-editable-demo-repo/prd-to-editable-demo && unzip -l dist/prd-to-editable-demo-skill.zip | rg 'SKILL.md|requirements-ir.md|clarification.md|execution-contract.md|visual-reference.md|fidelity-verification.md|requirements-ir-v2.schema.json|visual-reference-manifest.schema.json'`

Expected: every named file appears exactly once.

- [ ] **Step 6: Commit**

```bash
git add work/prd-to-editable-demo-repo/prd-to-editable-demo/SKILL.md work/prd-to-editable-demo-repo/prd-to-editable-demo/references work/prd-to-editable-demo-repo/prd-to-editable-demo/test work/prd-to-editable-demo-repo/prd-to-editable-demo/dist/prd-to-editable-demo-skill.zip
git commit -m "feat: enforce PRD fidelity workflow"
```

## Final acceptance

- [ ] A clear PRD proceeds without redundant questions.
- [ ] A consequential gap or conflict stops generation and shows no more than three related decisions.
- [ ] Background and research information remain traceable but never render as product UI without explicit evidence.
- [ ] Parent-child information architecture survives IR, baseline, model, and rendered output.
- [ ] Exact copy, required regions, core actions, state changes, and return paths are traceable and verified.
- [ ] Each image reference affects only its confirmed scope and properties.
- [ ] Static notices, unreachable pages, and code-only declarations do not pass as completed interactions.
- [ ] Every core journey passes against the actual final deliverable: local HTML by default, final URL only when online delivery is requested.
- [ ] Visual polish cannot override a failed structure, hierarchy, reachability, or journey gate.
