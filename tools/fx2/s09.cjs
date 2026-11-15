module.exports = async (browser, H) => {
  const { open, tab, shot, scene, SEED, MOB, PC } = H;
  const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum'];
  const some = {}; IDS.forEach((id, i) => { some[id] = { base: 1 + (i % 4), shiny: i % 3 === 0 ? 2 : 0, gold: i === 2 ? 1 : 0, rainbow: 0 }; });
  for (const [tag, o] of [['390', MOB], ['1440', PC]]) await scene('9' + tag, async () => {
    const { ctx, page } = await open(browser, o, { ...SEED, points: 1e6, collection: some });
    await tab(page, '도감');
    await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
    await page.locator('.dex-cell.got').nth(1).click(); await page.waitForTimeout(700);
    await shot(page, `09-dex-detail-missing-${tag}`);
    await ctx.close();
  });
};
