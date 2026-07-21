const elements = Object.fromEntries(['dot','title','message','qr','technical','task','login','completeLogin','plugin','retry','drive','quit'].map(id => [id, document.getElementById(id)]));
let state = { phase: 'starting' };

const copy = {
  starting: ['正在启动', '正在检查飞书登录状态。'],
  'auth-required': ['需要登录飞书', '首次使用请扫码授权个人飞书云空间。'],
  authorizing: ['正在生成二维码', '请稍候。'],
  'awaiting-scan': ['扫码登录飞书', '使用飞书扫描二维码，确认授权后点击下方按钮。'],
  ready: ['已连接飞书', '正在启动下载目录监听。'],
  idle: ['等待采集', '在 Figma 中多选页面并运行批量采集插件，任务会自动上传。'],
  uploading: ['正在上传', '任务已通过本地校验，正在上传飞书。'],
  success: ['采集完成', '页面已安全上传。现在回到 Agent，说“根据当前 PRD 和刚采集的设计生成 Demo”。'],
  error: ['上传失败', '本地任务仍然保留，请检查网络或重新登录后重试。']
};

function render(next) {
  state = next;
  const [title, message] = copy[state.phase] || copy.starting;
  elements.title.textContent = title;
  if (state.phase === 'success' && state.message) {
    const count = state.message.match(/^已上传 (\d+) 个页面/);
    elements.message.textContent = count
      ? `${count[1]} 个页面已安全上传。现在回到 Agent，说“根据当前 PRD 和刚采集的设计生成 Demo”。`
      : message;
  } else {
    elements.message.textContent = state.message ? `${message} ${state.message}` : message;
  }
  elements.dot.className = `dot ${state.phase}`;
  elements.login.hidden = state.phase !== 'auth-required' && !state.canRetryAuth;
  elements.completeLogin.hidden = state.phase !== 'awaiting-scan';
  elements.retry.hidden = state.phase !== 'error' || state.canRetryAuth;
  elements.qr.hidden = state.phase !== 'awaiting-scan' || !state.qrData;
  if (!elements.qr.hidden) elements.qr.src = state.qrData;
  elements.task.hidden = !state.taskId;
  elements.technical.hidden = !state.taskId;
  elements.task.textContent = state.taskId ? `任务 ID：${state.taskId}` : '';
}

elements.login.addEventListener('click', async () => render(await window.captureHelper.beginLogin()));
elements.completeLogin.addEventListener('click', async () => render(await window.captureHelper.finishLogin()));
elements.plugin.addEventListener('click', () => window.captureHelper.openPluginFolder());
elements.retry.addEventListener('click', () => window.captureHelper.retry());
elements.drive.addEventListener('click', () => window.captureHelper.openTaskFolder());
elements.quit.addEventListener('click', () => window.captureHelper.quit());
window.captureHelper.onState(render);
window.captureHelper.getState().then(render);
