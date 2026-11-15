module.exports = async (browser, H) => {
  const { open, set, setUn, shot, scene, SEED, MOB, sleep } = H;
  await scene('5', async () => {
    const { ctx, page } = await open(browser, MOB, SEED);
    await setUn(page, { box: 45, damage: 0, hp: 1e9, roomDone: false });
    await set(page, { fever: { gauge: 20, activeSec: 0, cooldownSec: 0 } });
    const p = await page.evaluate(() => { const r = document.querySelector('.un-box[data-pos="0"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
    for (let i = 0; i < 6; i++) { await page.mouse.click(p.x, p.y); await sleep(150); }
    const t0 = Date.now();
    for (const ms of [1000, 2000, 3000]) { await sleep(Math.max(0, ms - (Date.now() - t0))); await shot(page, `05-fevergauge-${ms / 1000}s`); }
    await ctx.close();
  });
};
