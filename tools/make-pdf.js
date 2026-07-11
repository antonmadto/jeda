const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage();
  await page.goto('file:///home/claude/work/kuesioner-print.html', { waitUntil: 'networkidle' });
  await page.pdf({
    path: '/home/claude/work/kuesioner-jeda.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
  });
  await browser.close();
  console.log('PDF created');
})();
