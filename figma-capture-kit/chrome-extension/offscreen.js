chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'read-png') return;
  (async () => {
    const blob = await new Promise((resolve, reject) => {
      const target = document.getElementById('paste-target');
      const onPaste = event => {
        event.preventDefault();
        const item = [...(event.clipboardData?.items || [])].find(entry => entry.type === 'image/png');
        const file = item?.getAsFile();
        if (file) resolve(file);
        else reject(new Error('Figma 没有把 PNG 写入剪贴板'));
      };
      document.addEventListener('paste', onPaste, { once: true });
      target.replaceChildren();
      target.focus();
      if (!document.execCommand('paste')) {
        document.removeEventListener('paste', onPaste);
        reject(new Error('Chrome 拒绝读取剪贴板 PNG'));
      }
    });
    const bitmap = await createImageBitmap(blob);
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    return { dataUrl, width: bitmap.width, height: bitmap.height };
  })().then(sendResponse).catch(error => sendResponse({ error: error.message }));
  return true;
});
