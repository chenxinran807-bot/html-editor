const { buildTaskArchive } = require('../../shared/task-archive');

let current = [];

function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function setStatus(text, error = false) {
  const status = document.getElementById('status');
  status.textContent = text;
  status.className = error ? 'status error' : 'status';
}

function render(items) {
  current = items;
  const count = document.getElementById('count');
  const list = document.getElementById('selection');
  const button = document.getElementById('export');
  count.textContent = items.length ? `已选中 ${items.length} 个页面` : '尚未选中页面';
  list.innerHTML = '';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'frame';
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector('strong').textContent = item.name;
    row.querySelector('span').textContent = `${item.type} · ${item.width}×${item.height}`;
    list.appendChild(row);
  }
  button.disabled = !items.length;
}

function download(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

document.getElementById('refresh').onclick = () => parent.postMessage({ pluginMessage: { type: 'refresh' } }, '*');
document.getElementById('export').onclick = () => {
  document.getElementById('export').disabled = true;
  setStatus(`正在采集 ${current.length} 个页面…`);
  parent.postMessage({ pluginMessage: { type: 'export-task', scale: Number(document.getElementById('scale').value) } }, '*');
};

window.onmessage = async event => {
  const message = event.data.pluginMessage;
  if (!message) return;
  if (message.type === 'selection') return render(message.items);
  if (message.type === 'progress') return setStatus(`正在导出 ${message.current}/${message.total}：${message.name}`);
  if (message.type === 'error') {
    render(current);
    return setStatus(message.message, true);
  }
  if (message.type === 'export-ready') {
    try {
      const payload = message.payload;
      const archive = await buildTaskArchive({
        ...payload,
        files: payload.files.map(file => ({ ...file, bytes: bytesFromBase64(file.b64) }))
      });
      download(archive.bytes, archive.filename);
      setStatus(`采集完成：${payload.manifest.pages.length} 个页面已绑定为一个任务。`);
    } catch (error) {
      setStatus(`任务打包失败：${String(error?.message || error)}`, true);
    } finally {
      render(current);
    }
  }
};

