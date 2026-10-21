const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, ['server.cjs'], { cwd: root, env: { ...process.env, PORT: '4173' }, stdio: 'pipe' });
const failures = []; let passed = 0, browser;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.stack}`); }
}
async function open(viewport = { width: 390, height: 844 }, extra = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, ...extra });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.clock.install();
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => typeof S.pose === 'number');
  return { context, page, errors, requests };
}
async function step(page, ms) { await page.clock.runFor(ms); }
(async () => {
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited: ${code}`))); });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  await check('full mobile story: ignition, tap, stagger, smoke, letter, replay', async () => {
    const {page, context, errors, requests} = await open();
    await page.mouse.click(195, 500);
    assert.equal(await page.evaluate(() => S.gust), -1, 'early tap must not skip intro');
    await step(page, 5100);
    assert.equal(await page.evaluate(() => S.phase), 'hello');
    assert.equal(await page.evaluate(() => document.fonts.check('700 24px Gaegu')), true);
    await page.screenshot({ path: path.join(root, 'artifacts/mobile-hello.png') });
    await step(page, 3200);
    assert.equal(await page.evaluate(() => S.phase), 'wish');
    await page.screenshot({ path: path.join(root, 'artifacts/mobile-wish.png') });
    await page.mouse.click(195, 520);
    await step(page, 650);
    const intermediate = await page.evaluate(() => ({ phase:S.phase, lit:S.lit, pose:S.pose, kiss:S.kiss }));
    assert.equal(intermediate.phase, 'out');
    assert(intermediate.lit.includes(0) && intermediate.lit.includes(1), 'candles go out in staggered order');
    assert(intermediate.pose > .8 && intermediate.kiss > .65);
    await page.screenshot({ path: path.join(root, 'artifacts/mobile-blowing.png') });
    await step(page, 1250);
    assert.deepEqual(await page.evaluate(() => S.lit), [0,0,0,0,0]);
    assert(await page.evaluate(() => S.joy > .8));
    await page.screenshot({ path: path.join(root, 'artifacts/mobile-happy.png') });
    await step(page, 2900);
    assert.equal(await page.evaluate(() => S.phase), 'letter');
    assert.equal(await page.locator('#again').isEnabled(), false);
    await step(page, 19000);
    assert.equal(await page.locator('#again').isEnabled(), true);
    const ink = await page.evaluate(() => {
      const cv = document.getElementById('letter'), data = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      let count=0; for(let i=3;i<data.length;i+=4) if(data[i]>128) count++; return count;
    });
    assert(ink > 15000, 'actual handwritten ink must have rendered');
    await page.screenshot({ path: path.join(root, 'artifacts/mobile-letter.png') });
    const run = await page.evaluate(() => S.run);
    await page.locator('#again').click();
    await step(page, 400);
    assert.equal(await page.evaluate(() => S.phase), 'replay');
    assert.equal(await page.locator('#again').isEnabled(), false);
    await step(page, 800);
    assert.equal(await page.evaluate(() => S.phase), 'intro');
    assert.equal(await page.evaluate(() => S.run), run + 2);
    await step(page, 5200);
    assert.equal(await page.evaluate(() => S.phase), 'hello');
    assert.deepEqual(await page.evaluate(() => S.lit), [1,1,1,1,1]);
    assert.equal(await page.evaluate(() => document.getElementById('night').classList.contains('on')), false);
    assert.deepEqual(errors, []);
    assert(requests.every(url => url.startsWith('http://127.0.0.1:4173') || url.startsWith('data:')), 'no external font or asset requests');
    await context.close();
  });
  await check('intro vignette reaches daylight without a final brightness jump', async () => {
    const {page,context}=await open();
    await step(page,4050);
    const before=await page.evaluate(()=>[...ctx.getImageData(5,5,1,1).data]);
    await step(page,120);
    const after=await page.evaluate(()=>[...ctx.getImageData(5,5,1,1).data]);
    assert(before.slice(0,3).every((v,i)=>Math.abs(v-after[i])<=3), `brightness discontinuity: ${before} to ${after}`);
    await context.close();
  });
  await check('keyboard, denied tilt permission, and duplicate input', async () => {
    const {page, context, errors} = await open();
    await page.evaluate(() => { window.DeviceOrientationEvent = { requestPermission: () => Promise.reject(new Error('denied')) }; });
    await step(page, 5300);
    await page.keyboard.press('Enter');
    const gust = await page.evaluate(() => S.gust);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => S.gust), gust);
    await step(page, 2000);
    assert.deepEqual(await page.evaluate(() => S.lit), [0,0,0,0,0]);
    assert.deepEqual(errors, []); await context.close();
  });
  await check('device tilt eases rather than jumping', async () => {
    const {page,context}=await open();
    await page.evaluate(() => {
      Tilt.listen(); const e = new Event('deviceorientation'); Object.assign(e,{beta:60,gamma:35}); window.dispatchEvent(e);
    });
    const target = await page.evaluate(() => Tilt.target);
    assert(target > .1);
    await step(page, 32);
    const initial = await page.evaluate(() => Tilt.roll);
    assert(initial > 0 && initial < target);
    await step(page,1000);
    assert(Math.abs(await page.evaluate(() => Tilt.roll) - target) < .01);
    await context.close();
  });
  await check('hidden tab pauses story, particles, and timers together', async () => {
    const {page,context}=await open();
    await step(page,5200);
    const before=await page.evaluate(()=>now());
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await step(page,20000);
    assert.equal(await page.evaluate(()=>now()),before);
    assert.equal(await page.evaluate(()=>S.phase),'hello');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await step(page,1000);
    assert(await page.evaluate(()=>now()) < before+1.1);
    assert.equal(await page.evaluate(()=>S.phase),'hello');
    await context.close();
  });
  for (const [width,height] of [[320,568],[390,844],[430,932],[844,390],[1440,900]]) {
    await check(`responsive composition ${width}×${height}`,async()=>{
      const {page,context,errors}=await open({width,height});
      await step(page,5200);
      const bounds=await page.evaluate(()=>({
        scale:L.s, left:L.ox+BOX.x0*L.s,right:L.ox+BOX.x1*L.s,bottom:L.oy+BOX.y1*L.s,
        width:W,height:H,overflow:document.documentElement.scrollWidth>innerWidth,
        text:[...document.querySelectorAll('#hello .ln')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})
      }));
      assert(bounds.scale>0); assert(bounds.left>=0 && bounds.right<=width && bounds.bottom<=height);
      assert(!bounds.overflow);
      assert(bounds.text.every(r=>r.left>=0 && r.right<=width && r.top>=0 && r.bottom<=height));
      await page.screenshot({path:path.join(root,`artifacts/layout-${width}x${height}.png`)});
      await page.setViewportSize({width:height,height:width}); await step(page,300);
      assert.equal(await page.evaluate(()=>S.phase),'hello','rotation must not reset story');
      assert.deepEqual(errors,[]);await context.close();
    });
  }
  await check('reduced motion retains complete interaction',async()=>{
    const {page,context,errors}=await open(undefined,{reducedMotion:'reduce'});
    await step(page,5300);await page.mouse.click(195,520);await step(page,15000);
    assert.equal(await page.evaluate(()=>S.phase),'letter');
    assert.equal(await page.locator('#again').isEnabled(),true);
    assert.deepEqual(errors,[]);await context.close();
  });
  console.log(`${passed} passed; ${failures.length} failed`);
  process.exitCode = failures.length ? 1 : 0;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser) await browser.close();server.kill();});
