const elements = Object.fromEntries(['dot','title','message','qr','task','login','completeLogin','plugin','retry','drive','quit'].map(id => [id, document.getElementById(id)]));
let state = { phase: 'starting' };

const copy = {
  starting: ['正在启动', '正在检查飞书登录状态。'],
  'auth-required': ['需要登录飞书', '首次使用请扫码授权个人飞书云空间。'],
  authorizing: ['正在生成二维码', '请稍候。'],
  'awaiting-scan': ['扫码登录飞书', '使用飞书扫描二维码，确认授权后点击下方按钮。'],
  ready: ['已连接飞书', '正在启动下载目录监听。'],
  idle: ['等待采集', '在 Figma 中多选页面并运行批量采集插件，任务会自动上传。'],
  uploading: ['正在上传', '任务已通过本地校验，正在上传飞书。'],
  success: ['上传完成', '刚采集的页面已经可以由 Aime 使用。'],
  error: ['上传失败', '本地任务仍然保留，请检查网络或重新登录后重试。']
};

function render(next) {
  state = next;
  const [title, message] = copy[state.phase] || copy.starting;
  elements.title.textContent = title;
  elements.message.textContent = state.message ? `${message} ${state.message}` : message;
  elements.dot.className = `dot ${state.phase}`;
  elements.login.hidden = state.phase !== 'auth-required';
  elements.completeLogin.hidden = state.phase !== 'awaiting-scan';
  elements.retry.hidden = state.phase !== 'error';
  elements.qr.hidden = state.phase !== 'awaiting-scan' || !state.qrPath;
  if (!elements.qr.hidden) elements.qr.src = `file://${state.qrPath}?t=${Date.now()}`;
  elements.task.hidden = !state.taskId;
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
