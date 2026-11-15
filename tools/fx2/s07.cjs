module.exports = async (browser, H) => {
  const { open, set, shot, scene, rec, SEED, MOB, sleep } = H;
  await scene('7', async () => {
    const { ctx, page } = await open(browser, MOB, { ...SEED, services: [20, 12, 11, 9, 0, 0, 0, 0] });
    await page.waitForTimeout(500);
    await rec(ctx, page, async (mark) => { mark(); await set(page, { services: [20, 12, 11, 10, 0, 0, 0, 0] }); }, [[150, 'a'], [450, 'b'], [900, 'c'], [1500, 'd'], [4500, 'dot']], '07-bundle-done', 390, 844);
    await shot(page, '07-bundle-after-dot');
    await page.locator('.bundle-toggle').click(); await page.waitForTimeout(500);
    await shot(page, '07-bundle-opened');
    await ctx.close();
  });
};
