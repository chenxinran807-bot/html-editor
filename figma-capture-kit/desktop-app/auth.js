const { mkdir } = require('node:fs/promises');
const { dirname, basename } = require('node:path');

function userFromStatus(result) {
  const user = result?.identities?.user || result?.data?.identities?.user;
  if (!user?.available || !user.openId) return null;
  return { openId: user.openId, name: user.userName || user.name || '飞书用户' };
}

function deviceFlowFromResult(result) {
  const data = result?.data || result || {};
  const verificationUrl = data.verification_url || data.verification_uri_complete || data.verification_uri || data.verificationUrl;
  const deviceCode = data.device_code || data.deviceCode;
  if (!verificationUrl || !deviceCode) throw new Error('飞书登录未返回二维码地址或设备码');
  return { verificationUrl, deviceCode };
}

function createAuthService(options) {
  const { runner, qrPath } = options;
  const ensureDirectory = options.ensureDirectory || (path => mkdir(path, { recursive: true }));

  async function status() {
    try {
      const result = await runner(['auth', 'status', '--json']);
      const user = userFromStatus(result);
      return user ? { phase: 'ready', user } : { phase: 'auth-required' };
    } catch {
      return { phase: 'auth-required' };
    }
  }

  async function beginLogin() {
    const started = await runner(['auth', 'login', '--domain', 'drive', '--no-wait', '--json']);
    const { verificationUrl, deviceCode } = deviceFlowFromResult(started);
    const qrDirectory = dirname(qrPath);
    await ensureDirectory(qrDirectory);
    await runner(['auth', 'qrcode', verificationUrl, '--output', basename(qrPath)], { cwd: qrDirectory });
    return { phase: 'awaiting-scan', deviceCode, verificationUrl, qrPath };
  }

  async function finishLogin(deviceCode) {
    if (!deviceCode) throw new Error('缺少飞书设备码');
    await runner(['auth', 'login', '--device-code', deviceCode, '--json']);
    const current = await status();
    if (current.phase !== 'ready') throw new Error('扫码已完成，但飞书用户身份仍不可用');
    return current;
  }

  return { status, beginLogin, finishLogin };
}

module.exports = { createAuthService, userFromStatus, deviceFlowFromResult };
