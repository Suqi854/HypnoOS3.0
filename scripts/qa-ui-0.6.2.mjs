import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined,
});

async function openPhone(viewport, screenshotPrefix) {
  const page = await browser.newPage({ viewportSize: viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('http://127.0.0.1:6633/preview.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const input = document.createElement('textarea');
    input.id = 'send_textarea';
    input.value = '我本轮先观察周围。';
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(input);
  });
  await page.waitForFunction(() => document.querySelector('#hypnoos-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  await page.evaluate(() => document.querySelector('#hypnoos-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frameHandle = await page.waitForSelector('#hypnoos-floating-phone-host');
  void frameHandle;
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  const hostMetrics = await page.evaluate(() => {
    const shadow = document.querySelector('#hypnoos-floating-phone-host').shadowRoot;
    const wrap = shadow.querySelector('.phone-wrap');
    const panel = shadow.querySelector('.panel');
    return {
      borderWidth: getComputedStyle(wrap).borderWidth,
      background: getComputedStyle(wrap).backgroundColor,
      dragEdges: shadow.querySelectorAll('[data-phone-drag]').length,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
    };
  });
  assert.equal(hostMetrics.borderWidth, '1px');
  assert.equal(hostMetrics.background, 'rgba(0, 0, 0, 0)');
  assert.equal(hostMetrics.dragEdges, 5);

  const shellMetrics = await frame.evaluate(() => {
    const app = document.querySelector('#app');
    const wrapper = app?.firstElementChild;
    const phone = wrapper?.firstElementChild;
    return {
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      wrapperPadding: wrapper ? getComputedStyle(wrapper).padding : '',
      phoneBorder: phone ? getComputedStyle(phone).borderWidth : '',
      phoneWidth: phone?.getBoundingClientRect().width || 0,
      viewportWidth: document.documentElement.clientWidth,
      htmlClass: document.documentElement.className,
      wrapperClass: wrapper?.className || '',
      phoneClass: phone?.className || '',
    };
  });
  console.log('shellMetrics', shellMetrics);
  assert.ok(shellMetrics.bodyScrollHeight <= shellMetrics.bodyClientHeight + 1, '手机文档发生整页滚动');
  assert.equal(shellMetrics.wrapperPadding, '0px');
  assert.equal(shellMetrics.phoneBorder, '0px');
  assert.ok(Math.abs(shellMetrics.phoneWidth - shellMetrics.viewportWidth) <= 1, '手机内容未铺满 iframe');

  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-home.png`, fullPage: true });
  await frame.locator('[aria-label="打开本轮输入"]').click();
  await frame.waitForSelector('.st-operation-phone-app [data-operation-note]');
  const input = frame.locator('.st-operation-phone-app [data-operation-note]');
  assert.equal(await input.inputValue(), '我本轮先观察周围。');
  await input.fill('我本轮决定先调查附近，再和同伴交谈。');
  const panelScroll = await frame.evaluate(() => {
    const panel = document.querySelector('.st-operation-phone-app #st-operation-side-panel');
    const list = panel?.querySelector('.st-operation-panel-list');
    return { panelHeight: panel?.clientHeight || 0, listOverflow: list ? getComputedStyle(list).overflowY : '' };
  });
  assert.ok(panelScroll.panelHeight > 300);
  assert.equal(panelScroll.listOverflow, 'auto');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-input-app.png`, fullPage: true });
  await frame.getByRole('button', { name: '写入输入框' }).click();
  await page.waitForFunction(() => document.querySelector('#send_textarea')?.value === '我本轮决定先调查附近，再和同伴交谈。');
  assert.deepEqual(errors, []);
  await page.close();
  return { hostMetrics, shellMetrics, panelScroll };
}

const desktop = await openPhone({ width: 1180, height: 900 }, '0.6.2-desktop');
const narrow = await openPhone({ width: 760, height: 900 }, '0.6.2-narrow');
console.log(JSON.stringify({ desktop, narrow }, null, 2));
await browser.close();
