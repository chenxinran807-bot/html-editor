const $ = id => document.getElementById(id);
const csv = value => value.split(',').map(v => v.trim()).filter(Boolean);
function status(text, kind='') { $('status').textContent = text; $('status').className = `status ${kind}`; }

async function load() {
  const cfg = await chrome.storage.local.get({ enabled:false, role:'page-reference', fidelity:'strict', editableRegions:['content-area'], lastCapture:null, lastError:'' });
  $('enabled').checked = cfg.enabled; $('role').value = cfg.role; $('fidelity').value = cfg.fidelity; $('editable').value = cfg.editableRegions.join(', ');
  if (cfg.lastError) status(cfg.lastError, 'error');
  else if (cfg.lastCapture) status(`最近采集：${cfg.lastCapture.file}\n${cfg.lastCapture.width}×${cfg.lastCapture.height}`, 'ok');
}
async function save() { await chrome.storage.local.set({ enabled:$('enabled').checked, role:$('role').value, fidelity:$('fidelity').value, editableRegions:csv($('editable').value), lastError:'' }); }
$('enabled').onchange=save; $('role').onchange=save; $('fidelity').onchange=save; $('editable').onchange=save;
$('reset').onclick=async()=>{await chrome.storage.local.set({lastKey:'',lastError:''});status('已允许重新采集当前 Frame。')};
$('capture').onclick=async()=>{await save();const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab){status('找不到当前标签页','error');return}const result=await chrome.runtime.sendMessage({type:'schedule-capture',tabId:tab.id});if(result?.lastError){status(result.lastError,'error');return}window.close()};
load();
