import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const cell=path.resolve(import.meta.dirname,'..');
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out=path.join(cell,'qa');
await mkdir(path.join(out,'screenshots'),{recursive:true});
await mkdir(path.join(out,'raw'),{recursive:true});
const port=9339;
const proc=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/huashu-camera-cdp-${Date.now()}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';proc.stderr.on('data',d=>stderr+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)break}catch{}await sleep(250)}

let seq=0;
async function session(file){const url='file://'+path.join(cell,'artifact/design-demos',file);const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'}).then(r=>r.json());const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});const pending=new Map(),consoleErrors=[],pageErrors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')consoleErrors.push(m.params.args.map(a=>a.value||a.description).join(' '));if(m.method==='Runtime.exceptionThrown')pageErrors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''))};const send=(method,params={})=>new Promise(resolve=>{const id=++seq;pending.set(id,resolve);ws.send(JSON.stringify({id,method,params}))});await send('Runtime.enable');await send('Page.enable');await send('Console.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});const evalJs=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description||m.result.exceptionDetails.text);return m.result?.result?.value};for(let i=0;i<50;i++){if(await evalJs('Boolean(document.querySelector(".stage"))'))break;await sleep(200)}return{send,evalJs,consoleErrors,pageErrors,close:()=>ws.close()}}
const click=(sel)=>`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw Error('missing ${sel}');e.click();return true})()`;
const results={runtime:'Chrome DevTools Protocol',startedAt:new Date().toISOString(),directions:{},environmentNoise:[]};
async function runDirection(file,key,steps){const s=await session(file);const tasks=[];try{for(const [name,selector] of steps){await s.evalJs(click(selector));await sleep(120);tasks.push({task:name,status:'PASS'})}const shot=await s.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(out,'screenshots',`direction-${key}.png`),Buffer.from(shot.result.data,'base64'));}catch(e){tasks.push({task:'runtime',status:'FAIL',error:e.message})}results.directions[key]={file,tasks,consoleErrors:s.consoleErrors,pageErrors:s.pageErrors};s.close()}
await runDirection('a-system-sheet.html','a',[
 ['open-upload-choices','[data-testid="upload"]'],['enter-camera','[data-testid="camera-choice"]'],['flip-camera','[data-testid="flip"]'],['open-album','[data-testid="album"]'],['return-camera','[data-testid="album-back"]'],['close-camera','[data-testid="close"]'],['reopen-upload','[data-testid="upload"]'],['reenter-camera','[data-testid="camera-choice"]'],['shutter','[data-testid="shutter"]'],['retake','[data-testid="retake"]'],['shutter-again','[data-testid="shutter"]'],['use-photo','[data-testid="use-photo"]'],['review-failure','[data-testid="fail"]'],['retry','[data-testid="retry"]']
]);
await runDirection('b-capture-coach.html','b',[
 ['open-source-coach','[data-testid="upload"]'],['enter-camera','[data-testid="camera-choice"]'],['flip-camera','[data-testid="flip"]'],['shutter','[data-testid="shutter"]'],['use-photo','[data-testid="use-photo"]'],['review-failure','[data-testid="fail"]'],['retry','[data-testid="retry"]']
]);
await runDirection('c-task-rail.html','c',[
 ['enter-camera','[data-testid="camera-choice"]'],['flip-camera','[data-testid="flip"]'],['open-album','[data-testid="album"]'],['return-camera','[data-testid="album-back"]'],['shutter','[data-testid="shutter"]'],['use-photo','[data-testid="use-photo"]'],['review-failure','[data-testid="fail"]'],['retry','[data-testid="retry"]']
]);
results.finishedAt=new Date().toISOString();
await writeFile(path.join(out,'raw','cdp-results.json'),JSON.stringify(results,null,2));
await writeFile(path.join(out,'raw','chrome-stderr.log'),stderr);
proc.kill('SIGTERM');
const failed=Object.values(results.directions).some(d=>d.consoleErrors.length||d.pageErrors.length||d.tasks.some(t=>t.status!=='PASS'));
console.log(JSON.stringify({failed,summary:Object.fromEntries(Object.entries(results.directions).map(([k,v])=>[k,{tasks:v.tasks.length,consoleErrors:v.consoleErrors.length,pageErrors:v.pageErrors.length}]))},null,2));
process.exitCode=failed?1:0;
