const {test,expect}=require('./runtime/node_modules/@playwright/test');
const fs=require('fs');
const path=require('path');
const OUT=__dirname;
const URL='http://127.0.0.1:8291/index.html';
test.use({viewport:{width:1440,height:980},launchOptions:{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}});

test('camera contract and review failure recovery',async({page})=>{
  const started=new Date(); const consoleErrors=[]; const pageErrors=[]; const assertions=[];
  const mark=(id,detail)=>assertions.push({id,pass:true,detail,at:new Date().toISOString()});
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(URL);
  await expect(page.getByTestId('scenario-bar')).toBeVisible();
  await page.getByTestId('upload-card').click();
  await expect(page.getByTestId('source-sheet')).toContainText('拍照');
  await expect(page.getByTestId('source-sheet')).toContainText('从相册选择'); mark('open-upload-choices','both choices visible');
  await page.screenshot({path:path.join(OUT,'screenshots/01-upload-choices.png')});
  await page.getByTestId('choose-camera').click(); await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen','camera'); mark('enter-camera','camera visible');
  await page.getByTestId('flip-camera').click(); await expect(page.locator('[data-facing]')).toHaveAttribute('data-facing','rear'); mark('flip-camera','facing rear');
  await page.screenshot({path:path.join(OUT,'screenshots/02-camera-flipped.png')});
  await page.getByTestId('open-album').click(); await expect(page.getByTestId('album-panel')).toBeVisible(); mark('open-album','album visible');
  await page.screenshot({path:path.join(OUT,'screenshots/03-album.png')});
  await page.getByTestId('album-cancel').click(); await page.getByTestId('close-camera').click(); await expect(page.getByTestId('source-sheet')).toBeVisible(); mark('close-camera','source sheet restored');
  await page.getByTestId('choose-camera').click(); await page.getByTestId('shutter').click(); await expect(page.getByTestId('confirm-photo')).toBeVisible(); mark('shutter','confirm visible');
  await page.screenshot({path:path.join(OUT,'screenshots/04-confirm.png')});
  await page.getByTestId('retake').click(); await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen','camera'); await expect(page.locator('[data-facing]')).toHaveAttribute('data-facing','rear'); mark('retake','camera restored and facing retained');
  await page.getByTestId('shutter').click(); await page.getByTestId('use-photo').click(); await expect(page.getByTestId('review-loading')).toBeVisible(); mark('use-photo','review loading visible');
  await page.screenshot({path:path.join(OUT,'screenshots/05-loading.png')});
  await expect(page.getByTestId('review-failure')).toBeVisible({timeout:3000}); mark('review-failure','failure reason and guidance visible');
  await page.screenshot({path:path.join(OUT,'screenshots/06-review-failure.png')});
  await page.getByTestId('retry').click(); await expect(page.getByTestId('source-sheet')).toBeVisible(); mark('retry','capture can restart');
  const finished=new Date();
  const raw={url:URL,browserVersion:await page.context().browser().version(),viewport:{width:1440,height:980},startedAt:started.toISOString(),finishedAt:finished.toISOString(),durationMs:finished-started,assertions,consoleErrors,pageErrors};
  fs.writeFileSync(path.join(OUT,'browser-qa-raw.json'),JSON.stringify(raw,null,2));
  expect(assertions).toHaveLength(10); expect(consoleErrors).toEqual([]); expect(pageErrors).toEqual([]);
});

test('inferred edge scenarios remain recoverable',async({page})=>{
  await page.goto(URL);
  await page.getByRole('button',{name:'权限拒绝'}).click(); await expect(page.getByTestId('permission-error')).toBeVisible();
  await page.getByTestId('permission-retry').click(); await expect(page.getByTestId('source-sheet')).toBeVisible();
  await page.getByRole('button',{name:'空相册'}).click(); await expect(page.getByTestId('empty-album')).toBeVisible();
  await page.getByTestId('empty-camera').click(); await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen','camera');
  await page.getByRole('button',{name:'审核超时'}).click(); await expect(page.getByTestId('timeout-error')).toBeVisible();
  await page.screenshot({path:path.join(OUT,'screenshots/07-edge-timeout.png')});
});

