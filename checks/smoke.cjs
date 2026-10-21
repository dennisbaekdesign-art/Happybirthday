const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, ['server.cjs'], { cwd: root, env: { ...process.env, PORT: '4173' }, stdio: 'pipe' });
const failures = [], contexts = new Set(); let passed = 0, browser;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.stack}`); }
  finally { await Promise.allSettled([...contexts].map(context => context.close())); }
}
async function open(viewport = { width: 390, height: 844 }, extra = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, ...extra });
  contexts.add(context); context.on('close',()=>contexts.delete(context));
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.clock.install();
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => typeof S.pose === 'number');
  return { context, page, errors, requests };
}
async function step(page, ms) { await page.clock.runFor(ms); }
async function letterFrames(page, times) {
  return page.evaluate(times => {
    Letter.start(0);
    return times.map(time => {
      Letter.draw(time);
      const cv = document.getElementById('letter'), c = cv.getContext('2d');
      const data = c.getImageData(0,0,cv.width,cv.height).data, ratio = cv.width / cv.clientWidth;
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1, pink = 0, pinkY0 = cv.height, pinkY1 = -1;
      for(let y=0;y<cv.height;y+=2) for(let x=0;x<cv.width;x+=2) {
        const i=(y*cv.width+x)*4;
        if(data[i+3]<200) continue;
        x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
        if(data[i]===238 && data[i+1]===100 && data[i+2]===147) {pink++;pinkY0=Math.min(pinkY0,y);pinkY1=Math.max(pinkY1,y);}
      }
      return {time,visible:x1>=0,left:x0/ratio,top:y0/ratio,right:x1/ratio,bottom:y1/ratio,pink,pinkHeight:(pinkY1-pinkY0)/ratio,width:cv.clientWidth,height:cv.clientHeight};
    });
  },times);
}
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
      let count=0; for(let i=0;i<data.length;i+=4) if(data[i]===238 && data[i+1]===100 && data[i+2]===147 && data[i+3]>200) count++; return count;
    });
    assert(ink > 6000, 'the original handwriting must render in #EE6493 on the paper');
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
  await check('envelope enters from below and paper emerges without frame jumps',async()=>{
    const {page,context,errors}=await open();
    const times=Array.from({length:193},(_,i)=>i/60);
    const frames=await letterFrames(page,times);
    assert.equal(frames[0].visible,false,'stationery begins fully outside the viewport');
    const first=frames.find(f=>f.visible);
    assert(first.top>first.height*.75,'envelope must enter at the bottom');
    assert(frames.filter(f=>f.time<1).every(f=>f.pink===0),'no floating text before the paper emerges');
    for(let i=1;i<frames.length;i++) {
      const a=frames[i-1],b=frames[i];
      if(a.visible && b.visible) assert(Math.abs(b.top-a.top)<35,`position jump at ${b.time}s`);
    }
    assert(frames.at(-1).top<first.top-300,'paper is fully extracted');
    const [foldBefore,foldAfter]=await letterFrames(page,[1.049,1.051]);
    assert(Math.abs(foldAfter.top-foldBefore.top)<3,'the flap changes depth continuously');
    const [a,b]=await letterFrames(page,[3.2,3.216]);
    assert(Math.abs(a.top-b.top)<1 && Math.abs(a.bottom-b.bottom)<1,'paper and envelope settle without a reset');
    assert.deepEqual(errors,[]);await context.close();
  });
  await check('pink message and stationery fit portrait, landscape, and desktop',async()=>{
    const {page,context,errors}=await open();
    for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]) {
      await page.setViewportSize({width,height});await step(page,60);
      const [f]=await letterFrames(page,[30]);
      assert(f.visible && f.left>=3 && f.right<=width-3 && f.top>=18,`stationery is clipped at ${width}×${height}`);
      assert(f.bottom<height-Math.min(150,height*.2),`stationery covers replay area at ${width}×${height}`);
      assert(f.pink>300,`pink lettering missing at ${width}×${height}`);
      assert(f.pinkHeight>Math.min(width*.45,height*.3),`last lines remain inside the envelope at ${width}×${height}`);
    }
    assert.deepEqual(errors,[]);await context.close();
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
    const before=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return now();});
    await step(page,20000);
    assert.equal(await page.evaluate(()=>now()),before);
    assert.equal(await page.evaluate(()=>S.phase),'hello');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await step(page,1000);
    assert(await page.evaluate(()=>now()) < before+1.1);
    assert.equal(await page.evaluate(()=>S.phase),'hello');
    await context.close();
  });
  await check('mobile greeting and wish stay above artwork with clear footer space',async()=>{
    const {page,context,errors}=await open();
    // Keep the existing full-story check for timing; inspect both settled headings
    // directly here so every compact viewport does not replay the whole sequence.
    await page.evaluate(()=>{
      Clock.tasks.length=0; S.outT=-1; S.gust=-1;
      S.t0=now()-CONFIG.intro.lightEnd; UI.dock('hint');
    });
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#hello .ln')].map(el=>el.textContent.trim()).join(' ')),'그대, 초를 부시죠~.');
    for(const [width,height] of [[280,360],[320,480],[320,568],[375,667],[390,844],[430,740],[568,320],[844,390]]) {
      await page.setViewportSize({width,height});await step(page,60);
      for(const phase of ['hello','wish']) {
        await page.evaluate(phase=>{
          S.phase=phase;
          for(const id of ['hello','wish']) UI.say(id,id===phase);
          document.querySelectorAll('#'+phase+' .ln').forEach(el=>el.classList.add('on'));
        },phase);
        await step(page,phase==='wish'?1600:1100);
        const bounds=await page.evaluate(phase=>{
          const data=octx.getImageData(0,0,off.width,off.height).data;
          const rowHasInk=y=>{
            for(let x=0;x<off.width;x+=2) if(data[(y*off.width+x)*4+3]>200) return true;
            return false;
          };
          let first=0,last=off.height-1;
          while(first<off.height&&!rowHasInk(first))first++;
          while(last>=0&&!rowHasInk(last))last--;
          const heading=document.querySelector('#'+phase+' .wrap').getBoundingClientRect();
          const hint=document.getElementById('hintItem').getBoundingClientRect();
          return {
            artTop:first/DPR,artBottom:last/DPR,
            heading:{top:heading.top,bottom:heading.bottom,left:heading.left,right:heading.right},
            hintTop:hint.top,topInset:safeInsets[0],overflow:document.documentElement.scrollWidth>innerWidth,
          };
        },phase);
        const label=`${phase} at ${width}×${height}`;
        assert(bounds.artTop<bounds.artBottom,`drawing was not rendered: ${label}`);
        assert(bounds.heading.bottom+12<=bounds.artTop,`heading overlaps drawing: ${label} ${JSON.stringify(bounds)}`);
        assert(bounds.artBottom+8<=bounds.hintTop,`footer hint overlaps cake stand: ${label} ${JSON.stringify(bounds)}`);
        assert(bounds.heading.top>=bounds.topInset+8 && bounds.heading.left>=8 && bounds.heading.right<=width-8,`heading is clipped: ${label}`);
        assert(!bounds.overflow,`horizontal overflow: ${label}`);
      }
    }
    assert.deepEqual(errors,[]);await context.close();
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
