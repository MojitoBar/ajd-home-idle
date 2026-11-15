module.exports = async (browser, H) => {
  const { open, rng, queue, done, boxTab, shot, scene, SEED, pc, sleep } = H;
  for (const w of [900, 1024, 1100]) await scene('10' + w, async () => {
    let { ctx, page } = await open(browser, pc(w, 800), { ...SEED, points: 1e9 });
    await boxTab(page); await queue(page, [0.98, 0.5, 0.99]);
    await page.locator('.box-open').click(); await done(page); await sleep(900);
    await shot(page, `10-open-one-${w}`);
    await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(500);
    await rng(page, 7);
    await page.locator('.box-ten').click(); await done(page); await sleep(4500);
    await shot(page, `10-open-ten-${w}`);
    await ctx.close();
  });
};
