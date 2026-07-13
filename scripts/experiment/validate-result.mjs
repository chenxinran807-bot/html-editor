#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SCORE_MAXIMA = Object.freeze({
  fidelity: 20,
  flowCoverage: 15,
  interaction: 20,
  visualHierarchy: 15,
  edgeStates: 10,
  stability: 10,
  handoff: 10,
});

const statuses = new Set(['PENDING', 'RUNNING', 'PASS', 'PASS_WITH_CONCERNS', 'BLOCKED', 'NOT_APPLICABLE']);
const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const baseKeys = new Set(['inputId', 'skillId', 'status', 'scores', 'total', 'artifacts', 'evidence', 'deviations', 'runtime']);
const runtimeKeys = new Set(['startedAt', 'finishedAt', 'durationMs']);
const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validateResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, errors: ['result must be an object'] };
  const allowed = new Set(baseKeys);
  if (value.status === 'BLOCKED' || value.status === 'NOT_APPLICABLE') allowed.add('reason');
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`unknown result field: ${key}`);
  for (const key of ['inputId', 'skillId']) if (typeof value[key] !== 'string' || !safeSlug.test(value[key])) errors.push(`${key} must be a safe slug`);
  if (!statuses.has(value.status)) errors.push('status is invalid');
  for (const key of ['artifacts', 'evidence', 'deviations']) if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${key} must be an array of non-empty strings`);
  if (!value.runtime || typeof value.runtime !== 'object' || Array.isArray(value.runtime)) errors.push('runtime must be an object');
  else {
    for (const key of Object.keys(value.runtime)) if (!runtimeKeys.has(key)) errors.push(`unknown runtime field: ${key}`);
    if (!isoDate.test(value.runtime.startedAt ?? '') || !isoDate.test(value.runtime.finishedAt ?? '')) errors.push('runtime timestamps must be ISO UTC strings');
    if (!Number.isFinite(value.runtime.durationMs) || value.runtime.durationMs < 0) errors.push('runtime durationMs must be a non-negative number');
  }

  if (value.status === 'BLOCKED' || value.status === 'NOT_APPLICABLE') {
    if (value.scores !== null) errors.push(`${value.status} scores must be null`);
    if (value.total !== null) errors.push(`${value.status} total must be null`);
    if (!Array.isArray(value.deviations) || value.deviations.length === 0 || value.deviations.some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${value.status} requires non-empty deviations`);
    if (typeof value.reason !== 'string' || value.reason.trim().length < 10) errors.push(`${value.status} requires a concrete recovery or exclusion reason`);
  } else {
    if (!value.scores || typeof value.scores !== 'object' || Array.isArray(value.scores)) {
      errors.push('scores must contain seven dimensions');
    } else {
      const actual = Object.keys(value.scores);
      const expected = Object.keys(SCORE_MAXIMA);
      if (actual.length !== expected.length || expected.some((key) => !actual.includes(key))) errors.push('scores must contain exactly seven scoring dimensions');
      for (const [key, maximum] of Object.entries(SCORE_MAXIMA)) {
        const score = value.scores[key];
        if (!Number.isFinite(score) || score < 0 || score > maximum) errors.push(`${key} score must be between 0 and ${maximum}`);
      }
      const sum = expected.reduce((total, key) => total + (Number.isFinite(value.scores[key]) ? value.scores[key] : 0), 0);
      if (!Number.isFinite(value.total) || value.total !== sum) errors.push(`total must equal the seven score values (${sum})`);
    }
  }
  return { valid: errors.length === 0, errors };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: validate-result.mjs <result.json>');
  const result = validateResult(JSON.parse(await readFile(file, 'utf8')));
  if (!result.valid) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
