const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthService } = require('../desktop-app/auth');

function fakeRunner(responses) {
  const calls = [];
  const runner = async (args, options = {}) => {
    calls.push({ args, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  runner.calls = calls;
  return runner;
}

test('status recognizes an existing user login', async () => {
  const runner = fakeRunner([{ identities: { user: { available: true, openId: 'ou_1', userName: 'Chen' } } }]);
  const auth = createAuthService({ runner, qrPath: '/tmp/figma-helper/qr.png', ensureDirectory: async () => {} });
  assert.deepEqual(await auth.status(), { phase: 'ready', user: { openId: 'ou_1', name: 'Chen' } });
});

test('beginLogin returns a QR image generated from verification URL', async () => {
  const runner = fakeRunner([
    { verification_url: 'https://accounts.feishu.cn/oauth/v1/device/verify?flow_id=ABCD&user_code=EFGH', device_code: 'device-1' },
    { ok: true }
  ]);
  const auth = createAuthService({ runner, qrPath: '/tmp/figma-helper/qr.png', ensureDirectory: async () => {} });
  const result = await auth.beginLogin();
  assert.equal(result.deviceCode, 'device-1');
  assert.equal(result.qrPath, '/tmp/figma-helper/qr.png');
  assert.deepEqual(runner.calls[1], {
    args: ['auth', 'qrcode', 'https://accounts.feishu.cn/oauth/v1/device/verify?flow_id=ABCD&user_code=EFGH', '--output', 'qr.png'],
    options: { cwd: '/tmp/figma-helper' }
  });
});

test('finishLogin returns authorized user', async () => {
  const runner = fakeRunner([
    { ok: true },
    { identities: { user: { available: true, openId: 'ou_2', userName: 'Designer' } } }
  ]);
  const auth = createAuthService({ runner, qrPath: '/tmp/figma-helper/qr.png', ensureDirectory: async () => {} });
  const result = await auth.finishLogin('device-2');
  assert.deepEqual(runner.calls[0].args, ['auth', 'login', '--device-code', 'device-2', '--json']);
  assert.deepEqual(result, { phase: 'ready', user: { openId: 'ou_2', name: 'Designer' } });
});

test('status reports auth-required when user identity is unavailable', async () => {
  const runner = fakeRunner([{ identities: { user: { available: false } } }]);
  const auth = createAuthService({ runner, qrPath: '/tmp/figma-helper/qr.png', ensureDirectory: async () => {} });
  assert.deepEqual(await auth.status(), { phase: 'auth-required' });
});
