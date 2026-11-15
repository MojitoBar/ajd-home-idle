module.exports = async (browser, H) => {
  const { open, rng, done, boxTab, shot, scene, rec, DOTS, SEED, MOB, sleep } = H;
  await scene('1', async () => {
    const { ctx, page } = await open(browser, MOB, { ...SEED, points: 1e9 });
    await boxTab(page); await rng(page, 7);
    await page.locator('.box-ten').click(); await done(page);
    for (let i = 0; i < 6; i++) { console.log('after done', i * 250, 'ms particles', await page.evaluate(() => window.__ajd.particles())); await sleep(250); }
    for (const [ms, l] of [[500, '0.5s'], [1500, '2s'], [2000, '4s']]) { await sleep(ms); console.log('t+', ms); await shot(page, `01-open-ten-${l}`); console.log(l, 'particles', await page.evaluate(() => window.__ajd.particles())); }
    await ctx.close();
  });
};
