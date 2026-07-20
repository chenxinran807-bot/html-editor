const test = require('node:test');
const assert = require('node:assert/strict');
const { createLarkCliAdapter } = require('../uploader/lark-cli');

test('adapter prepends bundled cli entry and electron node mode', async () => {
  const calls = [];
  const adapter = createLarkCliAdapter({
    binary: '/App/MacOS/Figma Capture Helper',
    prefixArgs: ['/App/Resources/lark-cli/scripts/run.js'],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    execFile: async (binary, args, options) => {
      calls.push({ binary, args, options });
      return {
        stdout: JSON.stringify({
          identities: { user: { available: true, openId: 'ou_test', userName: 'Test' } }
        })
      };
    }
  });

  assert.deepEqual(await adapter.currentUser(), { openId: 'ou_test', name: 'Test' });
  assert.equal(calls[0].binary, '/App/MacOS/Figma Capture Helper');
  assert.equal(calls[0].args[0], '/App/Resources/lark-cli/scripts/run.js');
  assert.equal(calls[0].options.env.ELECTRON_RUN_AS_NODE, '1');
});

test('adapter keeps notifier suppression when custom env is provided', async () => {
  const calls = [];
  const adapter = createLarkCliAdapter({
    env: { CUSTOM_VALUE: 'yes' },
    execFile: async (binary, args, options) => {
      calls.push({ binary, args, options });
      return { stdout: JSON.stringify({ identities: { user: { available: true, openId: 'ou_1', userName: 'User' } } }) };
    }
  });
  await adapter.currentUser();
  assert.equal(calls[0].options.env.CUSTOM_VALUE, 'yes');
  assert.equal(calls[0].options.env.LARKSUITE_CLI_NO_UPDATE_NOTIFIER, '1');
  assert.equal(calls[0].options.env.LARKSUITE_CLI_NO_SKILLS_NOTIFIER, '1');
});
