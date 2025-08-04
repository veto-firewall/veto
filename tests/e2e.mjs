import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';

const extensionPath = path.join(process.cwd(), 'dist/veto.zip');
const firefoxProfilePath = 'tests/profile';

const firefoxOptions = {
  browser: 'firefox',
  headless: true,
  executablePath: '/home/codespace/.cache/puppeteer/firefox/linux-stable_141.0/firefox/firefox',
  // enableExtensions: extensionPath,
  args: [
    '-profile', firefoxProfilePath,
  ],
};

(async () => {
  const browser = await puppeteer.launch(firefoxOptions);
  const extensionId = await browser.installExtension(extensionPath);

  const extensionsJsonPath = `${firefoxProfilePath}/extensions.json`;
  const content = fs.readFileSync(extensionsJsonPath, 'utf-8');
  const extensionsData = JSON.parse(content);
  const addons = extensionsData.addons || [];
  const addon = addons.find(addon => addon.id === extensionId);
  if (addon) {
    console.log(`Found extension with id ${extensionId}:`);
    console.log(addon);
  } else {
    console.log(`Extension with id ${extensionId} not found in extensions.json`);
  }

  await browser.close();
})();