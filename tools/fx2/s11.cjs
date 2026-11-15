module.exports = async (browser, H) => {
  const { open, set, shot, scene, SEED, MOB, PC, sleep } = H;
  await scene('11new', async () => {
    const { ctx, page } = await open(browser, PC, null, { fresh: true });
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 60, earned: 60 }); });
    await page.waitForTimeout(700);
    await shot(page, '11-newgame-firstbuy-1440');
    await ctx.close();
  });
  await scene('11perk', async () => {
    const { ctx, page } = await open(browser, PC, { ...SEED, perkOffers: [['tap_power', 'crit', 'svc_power']] });
    await page.locator('.perk-alert').click(); await page.waitForTimeout(700);
    await shot(page, '11-perk-pick-1440');
    await ctx.close();
  });
  await scene('11quiz', async () => {
    const { ctx, page } = await open(browser, MOB, SEED);
    await set(page, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 20, question: null, questionSec: 0, result: null } });
    await page.waitForTimeout(500);
    await page.locator('.event-call').click(); await page.waitForTimeout(700);
    await shot(page, '11-quiz-question-390');
    await page.locator('.plan-card').first().click(); await page.waitForTimeout(700);
    await shot(page, '11-quiz-answer-390');
    await ctx.close();
  });
};
