module.exports = async (browser, H) => {
  const { open, queue, done, boxTab, shot, scene, SEED, mob, sleep } = H;
  const R = mob(390, 844, { reducedMotion: 'reduce' });
  await scene('12main', async () => {
    const { ctx, page } = await open(browser, R, SEED);
    await shot(page, '12-reduced-main-390');
    await ctx.close();
  });
  await scene('12box', async () => {
    const { ctx, page } = await open(browser, R, { ...SEED, points: 1e9 });
    await boxTab(page); await queue(page, [0.9995, 0.5, 0.5]);
    await page.locator('.box-open').click(); await done(page); await sleep(900);
    await shot(page, '12-reduced-open-one-myth-390');
    await ctx.close();
  });
  await scene('12move', async () => {
    const { ctx, page } = await open(browser, R, { ...SEED, points: 8e7, earned: 8e7 });
    await page.locator('.move-btn').click(); await page.waitForTimeout(500);
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.sc-result.on', { timeout: 8000 }); await sleep(1000);
    await shot(page, '12-reduced-move-result-390');
    await ctx.close();
  });
};
