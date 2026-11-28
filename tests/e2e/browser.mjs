import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { insertIntoFocusedEditor } from '../../apps/extension/insert.ts';

const modulePath = process.env.BROWSER_MODULE || 'playwright';
const { chromium } = await import(modulePath);
const temp = await mkdtemp(join(tmpdir(), 'promptveil-browser-'));
const web = resolve('dist/web');
const contents = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};
const prefix = '/promptveil/';
const marker = '56821947';

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }
  try {
    let path = resolve(web, decodeURIComponent(pathname.slice(prefix.length)));
    if (path !== web && !path.startsWith(web + sep)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    response.writeHead(200, { 'content-type': contents[extname(path)] || 'application/octet-stream' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});

async function scan(page) {
  await page.getByLabel('Prompt', { exact: true }).fill(`Customer ID: ${marker}. Invest ₹25,000.`);
  await page.getByRole('button', { name: 'Scan prompt' }).click();
  await page.getByText('Protected text is ready.').waitFor();
  const output = await page.getByLabel('Protected text').inputValue();
  assert.doesNotMatch(output, new RegExp(marker));
  assert.match(output, /₹25,000/);
  assert.match(output, /\[PV_CUSTOMER_ID_/);
  return output;
}

async function verifyEditorTransfer(context, protectedText) {
  const fixtureUrl = 'https://provider.fixture.invalid/chat';
  const editor = await context.newPage();
  try {
    await editor.route(fixtureUrl, route => route.fulfill({
      contentType: 'text/html',
      body: '<form><textarea aria-label="Text composer"></textarea><div contenteditable="true" role="textbox" aria-label="Rich composer"><p><br></p></div><button>Send</button></form>',
    }));
    await editor.goto(fixtureUrl);
    await editor.bringToFront();
    await editor.evaluate(() => {
      document.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        document.body.dataset.submitted = 'true';
      });
    });
    for (const label of ['Text composer', 'Rich composer']) {
      const field = editor.getByRole('textbox', { name: label });
      await field.click();
      const transfer = expectedUrl => editor.evaluate(
        ({ source, message, expectedUrl }) => globalThis.eval('(' + source + ')')(message, expectedUrl),
        { source: insertIntoFocusedEditor.toString(), message: protectedText, expectedUrl },
      );
      assert.equal(await transfer(fixtureUrl + '/changed'), false);
      assert.equal(await transfer(fixtureUrl), true, label);
      const value = await field.evaluate(element => element instanceof HTMLTextAreaElement ? element.value : element.textContent);
      assert.equal(value, protectedText);
      assert.doesNotMatch(value, new RegExp(marker));
    }
    assert.equal(await editor.locator('body').getAttribute('data-submitted'), null);
  } finally {
    await editor.close();
  }
}

async function verifyProtectedPaste(context, popup) {
  const origin = 'https://chatgpt.com';
  const pastePage = await context.newPage();
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await pastePage.route(origin + '/**', async route => {
      if (route.request().url() !== origin + '/') return route.fulfill({ status: 404 });
      return route.fulfill({
        contentType: 'text/html',
        body: `<form><div id="prompt-textarea" role="textbox" contenteditable="true"></div><button data-testid="send-button" aria-label="Send"><svg width="20" height="20" aria-hidden="true"><rect width="20" height="20"/></svg></button></form>
          <script>
            window.addEventListener('paste', () => { document.body.dataset.pasteSeen = 'yes'; }, true);
            const editor = document.querySelector('#prompt-textarea');
            editor.addEventListener('keydown', event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                editor.closest('form').requestSubmit();
              }
            });
            document.querySelector('form').addEventListener('submit', event => {
              event.preventDefault();
              document.body.dataset.sent = editor.innerText;
            });
          </script>`,
      });
    });
    await pastePage.goto(origin + '/');
    await pastePage.getByRole('button', { name: 'Write with PromptVeil' }).waitFor();
    assert.match(await pastePage.getByRole('button', { name: 'Write with PromptVeil' }).getAttribute('title'), /Paste and Send guard is active/);
    const editor = pastePage.getByRole('textbox');
    await editor.focus();
    const shortcut = process.platform === 'darwin' ? 'Meta+V' : 'Control+V';
    await pastePage.evaluate(text => navigator.clipboard.writeText(text), `Cutomer id : ${marker}. Invest ₹25,000.`);
    await editor.press(shortcut);
    await pastePage.getByText('PromptVeil pasted protected text.').waitFor();
    const approved = await editor.innerText();
    assert.match(approved, /PV_CUSTOMER_ID_.*₹25,000/);
    assert.doesNotMatch(approved, new RegExp(marker));
    assert.equal(await pastePage.locator('body').getAttribute('data-paste-seen'), null);

    await pastePage.evaluate(() => navigator.clipboard.writeText('Password: never-valid-fixture'));
    await editor.press(shortcut);
    await pastePage.getByText('PromptVeil blocked this paste.').waitFor();
    assert.equal(await editor.innerText(), approved);
    assert.equal(await pastePage.locator('body').getAttribute('data-paste-seen'), null);

    await editor.fill('');
    await editor.pressSequentially(`Cusotmer id : ${marker}`);
    await pastePage.getByText(/Sensitive text detected/).waitFor();
    assert.match(await editor.innerText(), new RegExp(marker));
    await editor.press('Enter');
    await pastePage.getByText(/protected the draft. Review it/).waitFor();
    assert.equal(await pastePage.locator('body').getAttribute('data-sent'), null);
    assert.doesNotMatch(await editor.innerText(), new RegExp(marker));
    await editor.press('Enter');
    assert.match(await pastePage.locator('body').getAttribute('data-sent'), /PV_CUSTOMER_ID_/);

    await pastePage.evaluate(() => { delete document.body.dataset.sent; });
    await editor.fill('');
    await editor.pressSequentially(`Cutomer id : ${marker}`);
    await pastePage.getByTestId('send-button').locator('rect').click();
    await pastePage.getByText(/protected the draft. Review it/).waitFor();
    assert.equal(await pastePage.locator('body').getAttribute('data-sent'), null);
    assert.doesNotMatch(await editor.innerText(), new RegExp(marker));
    await pastePage.getByTestId('send-button').locator('rect').click();
    assert.match(await pastePage.locator('body').getAttribute('data-sent'), /PV_CUSTOMER_ID_/);

    const reportUrl = await popup.evaluate(async origin => {
      const [tab] = await chrome.tabs.query({ url: origin + '/*' });
      return chrome.runtime.getURL('diagnostics.html?tab=' + tab.id);
    }, origin);
    const diagnostics = await context.newPage();
    try {
      await diagnostics.goto(reportUrl);
      await diagnostics.getByRole('heading', { name: 'Guard diagnostics' }).waitFor();
      await diagnostics.getByRole('status').filter({ hasText: 'Guard running' }).waitFor();
      const report = JSON.parse(await diagnostics.locator('#guard-report').textContent());
      assert.equal(report.extensionBuild, report.tab.build);
      assert.ok(report.tab.typingScans.flagged > 0);
      assert.ok(report.tab.events.enter.canceled > 0);
      assert.ok(report.tab.events.send.canceled > 0);
      assert.doesNotMatch(JSON.stringify(report), new RegExp(marker));
    } finally {
      await diagnostics.close();
      await pastePage.bringToFront();
    }

    await editor.fill('Password: never-valid-fixture');
    await pastePage.getByTestId('send-button').locator('rect').click();
    await pastePage.getByText(/blocked Send/).waitFor();
    assert.doesNotMatch(await pastePage.locator('body').getAttribute('data-sent'), /never-valid-fixture/);

    await editor.fill('Invest ₹25,000.');
    await pastePage.evaluate(() => { delete document.body.dataset.sent; });
    await popup.evaluate(async origin => {
      const [tab] = await chrome.tabs.query({ url: origin + '/*' });
      const port = chrome.tabs.connect(tab.id, { name: 'promptveil:pause-send', frameId: 0 });
      globalThis.testScanPort = port;
      await new Promise((resolve, reject) => {
        port.onDisconnect.addListener(() => reject(new Error('Scan pause port disconnected before acknowledgement.')));
        port.onMessage.addListener(message => { if (message === true) resolve(); });
      });
    }, origin);
    await editor.press('Enter');
    await pastePage.getByText(/checking the draft/).waitFor();
    assert.equal(await pastePage.locator('body').getAttribute('data-sent'), null);
    await pastePage.getByTestId('send-button').locator('rect').click();
    assert.equal(await pastePage.locator('body').getAttribute('data-sent'), null);
    await popup.evaluate(() => globalThis.testScanPort.disconnect());
    assert.equal(await pastePage.locator('body').getAttribute('data-sent'), null);

  } finally {
    await pastePage.close();
  }
}

function extensionID(publicKey) {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, digit => String.fromCodePoint('a'.codePointAt(0) + Number.parseInt(digit, 16)));
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const requests = [];
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => requests.push(request.url()));
    await page.goto(origin + prefix);
    await page.getByRole('heading', { name: 'Protect private details before you prompt.' }).waitFor();
    await page.getByRole('link', { name: 'Open PromptVeil' }).click();
    await page.getByText('Ready to scan offline.').waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => {
      if (navigator.serviceWorker.controller) return;
      return new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }));
    const output = await scan(page);
    await verifyEditorTransfer(context, output);
    await page.bringToFront();
    await page.getByRole('button', { name: 'Copy protected text' }).focus();
    await page.keyboard.press('Enter');
    await page.getByText('Protected text copied.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), output);
    await page.getByText('Restore a response locally').click();
    await page.getByLabel('AI response').fill(output);
    await page.getByRole('button', { name: 'Restore placeholders' }).click();
    await page.waitForFunction(value => document.querySelector('#restore').value.includes(value), marker);
    await context.setOffline(true);
    await page.reload();
    await scan(page);
    await page.getByLabel('Mask all config values, including unknown fields').check();
    await page.getByLabel('Prompt', { exact: true }).fill('deployment:\n  custom_setting: fixture-value\n  password: "synthetic phrase"');
    await page.getByRole('button', { name: 'Scan prompt' }).click();
    await page.getByText('Protected text is ready.').waitFor();
    assert.equal(await page.getByLabel('Protected text').inputValue(), 'deployment:\n  custom_setting: [PV_REDACTED]\n  password: [PV_REDACTED]');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(requests.some(url => url.includes(marker)), false);
    assert.equal(requests.every(url => url.startsWith(origin + prefix) || url === 'https://provider.fixture.invalid/chat'), true);
  } finally {
    await browser.close();
  }

  const extension = join(temp, 'extension');
  await cp('dist/extension', extension, { recursive: true });
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'der' } });
  const manifestPath = join(extension, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.key = publicKey.toString('base64');
  await writeFile(manifestPath, JSON.stringify(manifest));
  const extensionContext = await chromium.launchPersistentContext(join(temp, 'profile'), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const popup = await extensionContext.newPage();
    const errors = [];
    popup.on('pageerror', error => errors.push(error.message));
    await popup.goto(`chrome-extension://${extensionID(publicKey)}/index.html`);
    await scan(popup);
    assert.equal(errors.length, 0, errors.join('\n'));
    if (await popup.getByRole('button', { name: 'Insert into tab' }).isVisible()) {
      await popup.getByRole('button', { name: 'Insert into tab' }).click();
      await popup.getByText('Insertion unavailable. Use Copy protected text.').waitFor();
    }
    await verifyProtectedPaste(extensionContext, popup);
  } finally {
    await extensionContext.close();
  }
  console.log('Packaged PWA and extension composer smoke checks passed.');
} finally {
  server.closeAllConnections();
  server.close();
  await rm(temp, { recursive: true, force: true });
}
