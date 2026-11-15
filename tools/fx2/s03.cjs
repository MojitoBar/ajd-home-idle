module.exports = async (browser, H) => {
  const { open, shot, scene, rec, SEED, MOB, PC, sleep } = H;
  for (const [tag, o, W, Hh] of [['390', MOB, 390, 844], ['1440', PC, 1440, 900]]) {
    await scene('3' + tag, async () => {
      const { ctx, page } = await open(browser, o, { ...SEED, points: 8e7, earned: 8e7 });
      await page.locator('.move-btn').click(); await page.waitForTimeout(500);
      await rec(ctx, page, async (mark) => { mark(); await page.locator('.modal .btn.primary').click(); }, [[1350, 'truck'], [2150, 'arrive-a'], [2500, 'arrive-b'], [3100, 'result-before'], [3330, 'mult-pop-a'], [3420, 'mult-pop-b'], [4600, 'result-after']], '03-move-' + tag, W, Hh);
      await ctx.close();
    });
  }
  await scene('3enter', async () => {
    const { ctx, page } = await open(browser, MOB, { ...SEED, points: 8e7, earned: 8e7 });
    await page.locator('.move-btn').click(); await page.waitForTimeout(500);
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.sc-result.on', { timeout: 8000 }); await page.waitForTimeout(800);
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.className);
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const left = await page.locator('.move-scene').count();
    console.log('3enter: focus=', focus, 'move-scene 남음=', left);
    await ctx.close();
  });
};
