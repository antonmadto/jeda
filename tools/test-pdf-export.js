const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///home/claude/work/kuesioner-jeda.html', { waitUntil: 'networkidle' });

  const jspdfLoaded = await page.evaluate(() => !!(window.jspdf && window.jspdf.jsPDF));
  await page.fill('#meta-nama', 'Sepupu Anton');
  await page.fill('#q1', 'Sudah setahun jualan, awalnya iseng lalu jadi rutin karena banyak yang suka.');
  await page.click('[data-sec="B"]');
  await page.fill('#q7', 'Semangka Lemon 10rb, Kurma Susu 15rb, Mangga 12rb');
  await page.click('[data-sec="C"]');
  await page.click('[data-radio="q13"] label[data-val="Semua di awal hari"]');
  await page.click('[data-sec="I"]');
  const ranks = page.locator('[data-rank="q44"] .rank-item');
  await ranks.nth(0).click(); await ranks.nth(1).click(); await ranks.nth(3).click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#btnPDF'),
  ]);
  const path = '/home/claude/work/hasil-export-test.pdf';
  await download.saveAs(path);
  console.log('jsPDF loaded:', jspdfLoaded);
  console.log('download filename:', download.suggestedFilename());
  console.log('PAGE ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
