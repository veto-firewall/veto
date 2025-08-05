import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const distribPath = path.join(process.cwd(), 'dist');

const EXT_INTERNAL_UUID = crypto.randomUUID();
const EXT_ID = JSON.parse(
	fs.readFileSync(`${distribPath}/manifest.json`)
).browser_specific_settings.gecko.id;

const firefoxOptions = {
  browser: 'firefox',
  headless: true,
  // executablePath: '/home/codespace/.cache/puppeteer/firefox/linux-stable_141.0.2/firefox/firefox',
  extraPrefsFirefox: {
    'extensions.webextensions.uuids': `{"${EXT_ID}": "${EXT_INTERNAL_UUID}"}`,
  },
  dumpio: false,
};

(async () => {
  const browser = await puppeteer.launch(firefoxOptions);

  await browser.installExtension(`${distribPath}/veto.zip`);
  
  const page = await browser.newPage();
  // await page.goto(`https://9.9.9.9/dns`);
  await page.goto(`moz-extension://${EXT_INTERNAL_UUID}/manifest.json`);
  await page.screenshot({path: 'screenshot.png', fullPage: true});

  await browser.uninstallExtension(EXT_ID);

  await browser.close();
})();