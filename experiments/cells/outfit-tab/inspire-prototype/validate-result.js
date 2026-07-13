const fs = require('node:fs');
const path = require('node:path');

const cell = __dirname;
const result = JSON.parse(fs.readFileSync(path.join(cell, 'result.json'), 'utf8'));
const allowedStatuses = new Set(['PENDING', 'RUNNING', 'PASS', 'PASS_WITH_CONCERNS', 'BLOCKED', 'NOT_APPLICABLE']);
const dimensions = {
  fidelity: 20,
  flowCoverage: 15,
  interaction: 20,
  visualHierarchy: 15,
  edgeStates: 10,
  stability: 10,
  handoff: 10,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(result.inputId === 'outfit-tab', 'inputId must be outfit-tab');
assert(result.skillId === 'inspire-prototype', 'skillId must be inspire-prototype');
assert(allowedStatuses.has(result.status), 'invalid status');
assert(Array.isArray(result.artifacts) && result.artifacts.every(Boolean), 'artifacts must be non-empty strings');
assert(Array.isArray(result.evidence) && result.evidence.every(Boolean), 'evidence must be non-empty strings');
assert(Array.isArray(result.deviations) && result.deviations.every(Boolean), 'deviations must be non-empty strings');
assert(/^\d{4}-\d{2}-\d{2}T/.test(result.runtime.startedAt), 'invalid startedAt');
assert(/^\d{4}-\d{2}-\d{2}T/.test(result.runtime.finishedAt), 'invalid finishedAt');
assert(result.runtime.durationMs >= 0, 'invalid durationMs');

if (result.status === 'BLOCKED' || result.status === 'NOT_APPLICABLE') {
  assert(result.scores === null && result.total === null, 'blocked results require null scores and total');
  assert(typeof result.reason === 'string' && result.reason.length >= 10, 'blocked results require a reason');
} else {
  assert(result.reason === undefined, 'non-blocked results must not contain reason');
  let total = 0;
  for (const [key, max] of Object.entries(dimensions)) {
    const value = result.scores?.[key];
    assert(typeof value === 'number' && value >= 0 && value <= max, `invalid score: ${key}`);
    total += value;
  }
  assert(total === result.total, `total ${result.total} does not equal score sum ${total}`);
}

for (const relative of result.evidence.filter((entry) => !entry.includes('://'))) {
  assert(fs.existsSync(path.join(cell, relative)), `missing evidence: ${relative}`);
}

console.log(`valid ${result.inputId}/${result.skillId}: ${result.status} (${result.total})`);
