const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { measureRendering, ensureRendering } = require('../src/render-health.cjs');
(async () => {
  const env = { ...process.env, QIUZHAO_TEST: '1', QIUZHAO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'render-health-')) }; delete env.ELECTRON_RUN_AS_NODE;
  const bootstrap = path.join(env.QIUZHAO_USER_DATA, 'bootstrap.cjs');
  fs.writeFileSync(bootstrap, "const {app}=require('electron');for(const flag of ['disable-background-timer-throttling','disable-backgrounding-occluded-windows','disable-renderer-backgrounding'])app.commandLine.removeSwitch(flag);require(" + JSON.stringify(path.resolve(__dirname, '../src/main.cjs')) + ");");
  const app = await _electron.launch({ executablePath: require('electron'), args: [bootstrap], env });
  try {
    await app.firstWindow(); let page;
    for (let i = 0; i < 50; i++) { page = app.context().pages().find(p => p.url().includes('/fixtures/demo.html')); if (page) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(page);
    const originalBounds=await app.evaluate(({BrowserWindow})=>{const view=BrowserWindow.getAllWindows()[0].contentView.children[0],bounds=view.getBounds();view.setBounds({...bounds,width:1,height:1});return bounds;});
    const collapsed=await measureRendering(page);
    assert.equal(collapsed.healthy,false,'animation frames alone must not validate a collapsed native viewport');
    assert.equal(collapsed.reason,'viewport-collapsed');
    const recoveredViewport=await ensureRendering(page,()=>app.evaluate(({BrowserWindow},bounds)=>BrowserWindow.getAllWindows()[0].contentView.children[0].setBounds(bounds),originalBounds));
    assert.equal(recoveredViewport.healthy,true);
    await page.setContent('<button id="fixture">fixture click</button><script>window.clicks=0;document.getElementById("fixture").onclick=()=>window.clicks++;</script>');
    await app.evaluate(({ BrowserWindow }) => {const w=BrowserWindow.getAllWindows()[0];globalThis.__renderHealthDetachedView=w.contentView.children[0];w.contentView.removeChildView(globalThis.__renderHealthDetachedView);w.minimize();});
    await new Promise(resolve => setTimeout(resolve, 400));
    const background = await measureRendering(page);
    assert.equal(background.healthy, false, 'detached background pages should not continuously render');
    const throttling = await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(contents => ['window', 'browserView'].includes(contents.getType())).map(contents => contents.getBackgroundThrottling()));
    assert.ok(throttling.length >= 2); assert.ok(throttling.every(value => value === true), 'all contents allow background throttling');
    let restored = false;
    const health = await ensureRendering(page, async () => { restored = true;await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.contentView.addChildView(globalThis.__renderHealthDetachedView);delete globalThis.__renderHealthDetachedView;w.restore();w.show();w.focus();}); });
    assert.equal(restored, true); assert.equal(health.healthy, true); assert.equal(health.recovered, true);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.restore(); window.show(); window.focus(); });
    await page.locator('#fixture').click({ timeout: 1500 });
    assert.equal(await page.evaluate(() => window.clicks), 1, 'regular Playwright click works after real frame recovery');
    console.log(JSON.stringify({ passed: true, detachedPagePausesRendering: true, backgroundThrottlingEnabled: true, fillingRestoresWindow: true, normalClickWithoutForce: true }));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
