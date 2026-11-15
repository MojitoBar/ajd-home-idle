module.exports = async (browser, H) => {
  const { open, set, setUn, shot, scene, SEED, MOB, sleep, hpOf, done } = H;
  await scene('8', async () => {
    const { ctx, page } = await open(browser, MOB, SEED);
    await setUn(page, { box: 79, damage: hpOf(79) - 1, hp: hpOf(79), roomDone: false });
    await set(page, { homeLv: [5, 5, 5, 5, 5, 5, 5, 2] });
    await page.evaluate(() => { window.__o = Math.random; Math.random = () => 0.99; });
    await page.waitForTimeout(600);
    const p = await page.evaluate(() => { const r = document.querySelector('.un-box[data-pos="0"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
    const t0 = Date.now(); await page.mouse.click(p.x, p.y);
    const at = async (ms, name) => { await sleep(Math.max(0, ms - (Date.now() - t0))); await shot(page, name); };
    await at(1500, '08-gifts-2-wait-1.5s');
    await at(2400, '08-gifts-2-banner-2.4s');
    await at(3900, '08-gifts-2-first-3.9s');
    await done(page); await sleep(300);
    await page.locator('.bs-actions .btn.primary').click();
    await at(6500, '08-gifts-2-after-first-6.5s');
    await sleep(Math.max(0, 9700 - (Date.now() - t0)));
    await page.waitForSelector('.bs-actions', { timeout: 8000 }).catch(() => {});
    await at(11000, '08-gifts-2-second-11s');
    await ctx.close();
  });
};
