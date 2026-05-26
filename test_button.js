const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Set up console logging
  page.on('console', msg => {
    if (msg.type() !== 'log') console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error}`);
  });

  console.log('Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => {
    console.log('Navigation warning:', e.message);
  });

  console.log('✓ Page loaded\n');

  // Find the BEGIN button
  const buttons = await page.$$('button');
  console.log(`Found ${buttons.length} buttons total\n`);

  let foundButton = false;
  for (let i = 0; i < buttons.length; i++) {
    const text = await page.evaluate(btn => btn.textContent.trim(), buttons[i]);

    if (text === 'BEGIN') {
      console.log('✓ Found BEGIN button');
      foundButton = true;

      console.log('\nClicking BEGIN button...');
      await buttons[i].click();

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if the button changed to PAUSE
      const allButtons = await page.$$('button');
      let foundPause = false;
      for (const btn of allButtons) {
        const t = await page.evaluate(b => b.textContent.trim(), btn);
        if (t === 'PAUSE') {
          console.log('✓ SUCCESS: Button changed to PAUSE!');
          foundPause = true;
          break;
        }
      }

      if (!foundPause) {
        console.log('✗ ISSUE: Button did not change to PAUSE after click');
        // List current button states
        const allButtons2 = await page.$$('button');
        const buttonTexts = [];
        for (const btn of allButtons2) {
          const t = await page.evaluate(b => b.textContent.trim(), btn);
          buttonTexts.push(t);
        }
        console.log('Current buttons:', buttonTexts.filter(t => t.length < 50));
      }

      // Check the circle animation
      const strokeDashOffset = await page.evaluate(() => {
        const circle = document.querySelector('circle[stroke-dashoffset]');
        return circle?.getAttribute('stroke-dashoffset');
      });

      console.log(`\nCircle stroke-dashoffset: ${strokeDashOffset}`);

      // Wait and check again
      await new Promise(resolve => setTimeout(resolve, 500));
      const strokeDashOffset2 = await page.evaluate(() => {
        const circle = document.querySelector('circle[stroke-dashoffset]');
        return circle?.getAttribute('stroke-dashoffset');
      });

      console.log(`Circle stroke-dashoffset (after 500ms): ${strokeDashOffset2}`);

      if (strokeDashOffset !== strokeDashOffset2) {
        console.log('✓ Animation is running (stroke-dashoffset changed)');
      } else {
        console.log('⚠️  Animation may not be running or updating slowly');
      }

      break;
    }
  }

  if (!foundButton) {
    console.log('✗ Could not find BEGIN button');
  }

  await browser.close();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
