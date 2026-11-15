const { chromium } = require('playwright');
const H = require('./shots-fx2.cjs');
const { open, set, setUn, tab, queue, rng, done, boxTab, shot, scene, rec, DOTS, SEED, MOB, PC, mob, pc, hpOf, sleep, run, problems } = H;
const fs = require('fs'); const path = require('path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const scenes = fs.readdirSync(path.join(__dirname, 'fx2')).filter((f) => /^s\d+.*\.cjs$/.test(f)).sort();
    for (const f of scenes) { const n = f.match(/^s(\d+)/)[1]; if (!run(Number(n))) continue; await require('./fx2/' + f)(browser, H); }
  } finally { await browser.close(); console.log('문제', problems.join('\n') || '없음'); }
})();
