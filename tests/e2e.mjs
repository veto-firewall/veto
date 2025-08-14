/**
 * https://pptr.dev/webdriver-bidi#puppeteer-features-not-supported-over-webdriver-bidi
 * 
 * page.on('requestfailed', onRequestFailed); - NS_ERROR_ABORT doesn't trigger requestfailed (?)
 * page.locator - seems like it's anavailable in Firefox (?)
 * request.resourceType() === 'font' - not working in Firefox
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';
import test from 'node:test';

const distribPath = path.join(process.cwd(), 'dist');

const URL_HTTP = 'http://veto-firewall.github.io/veto/test';
const URL_HTTPS = 'https://veto-firewall.github.io/veto/test';
const VALID_KEY = 1;

const EXT_INTERNAL_UUID = crypto.randomUUID();
const EXT_ID = JSON.parse(
	fs.readFileSync(`${distribPath}/manifest.json`, 'utf-8')
).browser_specific_settings.gecko.id;

const firefoxOptions = {
  browser: 'firefox',
  headless: true,
  // executablePath: '/home/codespace/.cache/puppeteer/firefox/linux-stable_141.0.3/firefox/firefox',
  extraPrefsFirefox: {
    'extensions.webextensions.uuids': `{"${EXT_ID}": "${EXT_INTERNAL_UUID}"}`,
  },
  dumpio: false,
};

const browser = await puppeteer.launch(firefoxOptions);
await browser.installExtension(`${distribPath}/veto.zip`);

const popupPage = await browser.newPage();
await popupPage.goto(`moz-extension://${EXT_INTERNAL_UUID}/popup.html`, {waitUntil: 'networkidle0'});

test('popup page title is VETO', async () => {
  const title = await popupPage.title();
  assert.equal(title, 'VETO');
});

test('validate license key', async (t) => {
  await t.test('try invalid key', async () => {
    await popupPage.type('#license-key', '1');
    await popupPage.click('#save-maxmind');
    
    await popupPage.waitForSelector('.toast-container.error', { visible: true });
    const messages = await popupPage.$$eval('.toast-message', elements => elements.map(el => el.textContent).filter(Boolean));
    const lastMessage = messages[messages.length - 1];
  
    assert.equal(lastMessage, 'License validation failed (HTTP 400)');
  });
  
  await t.test('save valid key', async () => {
    await popupPage.waitForSelector('.toast-container', { visible: false });

    await popupPage.focus('#license-key');
    await popupPage.keyboard.press('Backspace');
    await popupPage.type('#license-key', VALID_KEY);
    await popupPage.click('#save-maxmind');
    
    await popupPage.waitForSelector('.toast-container.success', { visible: true });
    const messages = await popupPage.$$eval('.toast-message', elements => elements.map(el => el.textContent).filter(Boolean));
    const lastMessage = messages[messages.length - 1];
    
    assert.equal(lastMessage, 'License key saved');
  });
});

test.only('content filtering', async (t) => {
  await popupPage.click('#basic-rules-section');

  await t.test('allow http', async () => {
    await popupPage.select('#http-handling', 'allow');
    await new Promise(resolve => setTimeout(resolve, 50));

    const page = await browser.newPage();
    const response = await page.goto(URL_HTTP, { waitUntil: 'networkidle0', timeout: 5002 });
    await page.close();
  
    assert.equal(response.ok(), true);
  });

  await t.test('block http', async () => {
    await popupPage.select('#http-handling', 'block');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfailed = false;
    const onRequestFailed = (request) => {
      if (request.url().startsWith('http://')) {
        requestfailed = true;
      }
    };
    
    const page = await browser.newPage();
    page.on('requestfailed', onRequestFailed);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfailed, true);
  });

  await t.test('redirect http > https', async () => {
    await popupPage.select('#http-handling', 'redirect');
    await new Promise(resolve => setTimeout(resolve, 50));

    const page = await browser.newPage();
    await page.goto(URL_HTTP, { waitUntil: 'networkidle0', timeout: 5003 });
    const url = page.url();
    await page.close();

    assert.ok(url.startsWith('https://'));
  });

  await t.test('block webfonts', async () => {
    await popupPage.click('#block-fonts');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfailed = false;
    const onRequestFailed = (request) => {
      if (request.url().endsWith('.woff2')) {
        requestfailed = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfailed', onRequestFailed);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfailed, true);
  });

  await t.test('allow webfonts', async () => {
    await popupPage.click('#block-fonts');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfinished = false;
    const onRequestFinished = (request) => {
      if (request.url().endsWith('.woff2')) {
        requestfinished = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfinished', onRequestFinished);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfinished, true);
  });

  await t.test('block images', async () => {
    await popupPage.click('#block-images');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfailed = false;
    const onRequestFailed = (request) => {
      if (request.url().endsWith('.jpg')) {
        requestfailed = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfailed', onRequestFailed);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfailed, true);
  });

  await t.test('allow images', async () => {
    await popupPage.click('#block-images');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfinished = false;
    const onRequestFinished = (request) => {
      if (request.url().endsWith('.jpg')) {
        requestfinished = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfinished', onRequestFinished);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfinished, true);
  });

  await t.test('block media', async () => {
    await popupPage.click('#block-media');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfailed = false;
    const onRequestFailed = (request) => {
      if (request.url().endsWith('.ogg')) {
        requestfailed = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfailed', onRequestFailed);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfailed, true);
  });

  await t.test('allow media', async () => {
    await popupPage.click('#block-media');
    await new Promise(resolve => setTimeout(resolve, 50));

    let requestfinished = false;
    const onRequestFinished = (request) => {
      if (request.url().endsWith('.ogg')) {
        requestfinished = true;
      }
    };

    const page = await browser.newPage();
    page.on('requestfinished', onRequestFinished);
    await page.goto(URL_HTTPS, { waitUntil: 'networkidle0', timeout: 5004 });
    await page.close();

    assert.equal(requestfinished, true);
  });
});

// test.only('domain name filtering', async (t) => {
//   await popupPage.click('#domain-rules-section');
// });

test.after(async () => {
  await browser.uninstallExtension(EXT_ID);
  await browser.close();
});