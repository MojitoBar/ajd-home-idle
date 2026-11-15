module.exports = async (browser, H) => {
  const { open, set, setUn, shot, scene, SEED, MOB, PC, sleep } = H;
  const pos = (page) => page.evaluate(() => { const b = document.querySelector('.un-box[data-pos="0"]'); const r = (b || document.querySelector('.room')).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
  for (const [tag, o] of [['390', MOB], ['1440', PC]]) {
    await scene('4' + tag, async () => {
      const { ctx, page } = await open(browser, o, SEED);
      await setUn(page, { box: 45, damage: 0, hp: 1e9, roomDone: false });
      const p = await pos(page);
      for (let i = 0; i < 9; i++) { await page.mouse.click(p.x + (i % 3) * 6, p.y); await sleep(190); }
      await page.evaluate(() => { window.__o = Math.random; Math.random = () => 0; });
      await page.mouse.click(p.x, p.y); await sleep(110);
      await shot(page, `04-tapchain-${tag}-crit`);
      await page.evaluate(() => { Math.random = window.__o; });
      await sleep(250); await shot(page, `04-tapchain-${tag}-after`);
      await ctx.close();
    });
    await scene('4f' + tag, async () => {
      const { ctx, page } = await open(browser, o, SEED);
      await setUn(page, { box: 45, damage: 0, hp: 1e9, roomDone: false });
      await set(page, { fever: { gauge: 44, activeSec: 0, cooldownSec: 0 } });
      const p = await pos(page);
      await page.mouse.click(p.x, p.y); await sleep(120);
      await page.evaluate(() => window.__ajd.toast('방 완성! 새 사은품이 도착했어요', true));
      await sleep(100); await shot(page, `04-fever-${tag}-start-toast`);
      await sleep(500); await shot(page, `04-fever-${tag}-active`);
      await ctx.close();
    });
  }
};
