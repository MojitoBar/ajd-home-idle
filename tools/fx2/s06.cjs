module.exports = async (browser, H) => {
  const { open, set, setUn, shot, scene, rec, SEED, MOB, mob, sleep } = H;
  await scene('6up', async () => {
    const { ctx, page } = await open(browser, MOB, SEED);
    await setUn(page, { box: 89, damage: 9, hp: 10, roomDone: true });
    await set(page, { homeLv: [11, 12, 12, 12, 12, 12, 12, 12] });
    await page.evaluate(() => { window.__o = Math.random; Math.random = () => 0.99; });
    await page.waitForTimeout(600);
    const p = await page.evaluate(() => { const r = document.querySelector('.un-box[data-pos="0"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
    await rec(ctx, page, async (mark) => { mark(); await page.mouse.click(p.x, p.y); }, [[120, 'a'], [240, 'b'], [360, 'c'], [480, 'd'], [650, 'e'], [900, 'f'], [1400, 'g'], [3000, 'h']], '06-tierup-gold', 390, 844);
    await ctx.close();
  });
  await scene('6sp', async () => {
    const { ctx, page } = await open(browser, mob(390, 844, { deviceScaleFactor: 2 }), SEED);
    await setUn(page, { box: 85, damage: 0, hp: 20, roomDone: true });
    await set(page, { homeLv: Array(8).fill(192) });
    await page.waitForTimeout(1500);
    const clip = await page.evaluate(() => { const r = document.querySelector('.room').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    for (let i = 0; i < 6; i++) { await page.screenshot({ path: `${H.OUT}/06-sparkle-192-${i}.png`, clip }); console.log('sp', i, await page.evaluate(() => window.__ajd.particles())); await sleep(450); }
    await ctx.close();
  });
  await scene('6empty', async () => {
    const { ctx, page } = await open(browser, mob(390, 844, { deviceScaleFactor: 2 }), SEED);
    await setUn(page, { box: 12, damage: 0, hp: 1e9, roomDone: false });
    await page.waitForTimeout(900);
    const clip = await page.evaluate(() => { const r = document.querySelector('.room').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    await page.screenshot({ path: `${H.OUT}/06-emptyslots-box12-390.png`, clip });
    await ctx.close();
  });
};
