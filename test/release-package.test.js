const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const expected = [
  'html-editor/CHANGELOG.md',
  'html-editor/SKILL.md',
  'html-editor/agents/openai.yaml',
  'html-editor/assets/annotator-inject.js',
  'html-editor/scripts/wrap_annotator.py'
];

test('release ZIP contains only Skill runtime and documentation files', async () => {
  const { buildRelease } = await import('../scripts/build-release.mjs');
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'html-editor-release-test-'));
  const result = buildRelease({ outputDirectory });
  const entries = execFileSync('/usr/bin/unzip', ['-Z1', result.zipPath], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(entry => !entry.endsWith('/'))
    .sort();
  assert.deepEqual(entries, expected);
  assert.match(fs.readFileSync(result.checksumPath, 'utf8'), /^[a-f0-9]{64}  html-editor-1\.3\.3\.zip\n$/);
});
