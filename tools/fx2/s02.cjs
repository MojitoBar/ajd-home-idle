module.exports = async (browser, H) => {
  const { open, queue, boxTab, shot, scene, rec, SEED, MOB, sleep } = H;
  const go = async (tag, q, times) => scene('2' + tag, async () => {
    const { ctx, page } = await open(browser, MOB, { ...SEED, points: 1e9 });
    await boxTab(page); await queue(page, q);
    await rec(ctx, page, async () => { await page.locator('.box-open').click(); }, times, '02-' + tag);
    await ctx.close();
  });
  await go('myth', [0.9995, 0.5, 0.5], [[1900, 'charge'], [2010, 'flash-a'], [2080, 'flash-b'], [2450, 'reveal-a'], [2650, 'reveal-b'], [3050, 'edge-c'], [7000, 'after']]);
  await go('legend', [0.98, 0.5, 0.5], [[1500, 'charge'], [1590, 'flash-a'], [1660, 'flash-b'], [2000, 'reveal-a'], [7000, 'after']]);
};
