const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///home/claude/work/kuesioner-jeda.html');

  // fill nama
  await page.fill('#meta-nama', 'Sepupu');
  // open section A already open, fill q1
  await page.fill('#q1', 'Sudah 1 tahun, awalnya coba coba');
  // open section C, click radio q13
  await page.click('[data-sec="C"]');
  await page.click('[data-radio="q13"] label[data-val="Campuran keduanya"]');
  // open section I, pick 3 ranks + try a 4th
  await page.click('[data-sec="I"]');
  const ranks = page.locator('[data-rank="q44"] .rank-item');
  await ranks.nth(1).click();
  await ranks.nth(0).click();
  await ranks.nth(3).click();
  await ranks.nth(5).click(); // should be rejected (max 3)
  // radio q47
  await page.click('[data-radio="q47"] label[data-val="Bersedia"]');

  const prog = await page.textContent('#progText');
  const text = await page.evaluate(() => buildText());
  const waUrl = await page.evaluate(() => {
    const t = encodeURIComponent(buildText());
    return (WA_NUMBER ? 'https://wa.me/' + WA_NUMBER + '?text=' : 'https://wa.me/?text=') + t;
  });
  // reload to test localStorage persistence
  await page.reload();
  const progAfter = await page.textContent('#progText');
  const namaAfter = await page.inputValue('#meta-nama');

  console.log('PROGRESS:', prog);
  console.log('AFTER RELOAD:', progAfter, '| nama:', namaAfter);
  console.log('WA URL length:', waUrl.length);
  console.log('PAGE ERRORS:', errors.length ? errors : 'none');
  console.log('--- TEXT PREVIEW ---');
  console.log(text.split('\n').slice(0, 12).join('\n'));
  console.log('...');
  console.log(text.split('\n').filter(l => l.startsWith('44.') || l.startsWith('47.') || l.startsWith('13.')).join('\n'));

  await page.screenshot({ path: '/home/claude/work/form-screenshot.png', fullPage: false });
  await browser.close();
})();
