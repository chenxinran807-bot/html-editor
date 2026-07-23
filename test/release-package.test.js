const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const expected = [
  'html-editor/CHANGELOG.md',
  'html-editor/SKILL.md',
  'html-editor/agents/openai.yaml',
  'html-editor/assets/annotator-inject.js',
  'html-editor/assets/streamlit-annotator.js',
  'html-editor/scripts/streamlit_adapter.py',
  'html-editor/scripts/wrap_annotator.py'
];

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

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
  assert.match(fs.readFileSync(result.checksumPath, 'utf8'), /^[a-f0-9]{64}  html-editor-1\.4\.0\.zip\n$/);
});

test('release ZIP and checksum are reproducible across builds', async () => {
  const { buildRelease } = await import('../scripts/build-release.mjs');
  const first = buildRelease({
    outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'html-editor-release-first-'))
  });
  await new Promise(resolve => setTimeout(resolve, 2100));
  const second = buildRelease({
    outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'html-editor-release-second-'))
  });
  const firstZip = fs.readFileSync(first.zipPath);
  const secondZip = fs.readFileSync(second.zipPath);
  const expectedSidecar = `${sha256(firstZip)}  html-editor-1.4.0.zip\n`;

  assert.deepEqual(secondZip, firstZip);
  assert.equal(fs.readFileSync(first.checksumPath, 'utf8'), expectedSidecar);
  assert.equal(fs.readFileSync(second.checksumPath, 'utf8'), expectedSidecar);

  const committedZip = fs.readFileSync(path.join(__dirname, '..', 'dist', 'html-editor-1.4.0.zip'));
  assert.deepEqual(committedZip, firstZip);
  assert.equal(
    fs.readFileSync(path.join(__dirname, '..', 'dist', 'html-editor-1.4.0.zip.sha256'), 'utf8'),
    `${sha256(committedZip)}  html-editor-1.4.0.zip\n`
  );
});
