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
  await page.addInitScript(() => {
    globalThis.__hypnoosQaLegacyDestroyed = 0;
    globalThis.__ST_HYPNOOS_FLOATING_SINGLETON__ = {
      revision: 'legacy-4.3',
      destroy() { globalThis.__hypnoosQaLegacyDestroyed += 1; },
    };
  });
  await page.goto('http://127.0.0.1:6633/preview.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const runtimeContext = {
      characterId: 0,
      chatId: 'qa-chat',
      groupId: null,
      characters: [{ name: 'QA角色', avatar: 'qa.png', data: { extensions: { world: 'qa-book' } } }],
      chatMetadata: {},
      extensionSettings: { world_info: { charLore: [] } },
      chat: [
        { mes: '开场', is_user: false, name: 'QA角色' },
        { mes: '回复', is_user: false, name: 'QA角色', variables: { stat_data: { 系统: { MC能量: 66, MC能量上限: 80 }, 角色: { 测试角色: { 好感度: 12 } } } } },
      ],
      getWorldInfoNames() { return ['qa-book']; },
      loadWorldInfo(name) { return { entries: { 1: { uid: 1, comment: 'QA地点', content: `${name}:测试地点` } } }; },
      convertCharacterBook(value) { return value; },
      saveMetadataDebounced() {},
      setExtensionPrompt() {},
      eventSource: { on() {}, removeListener() {} },
      eventTypes: {},
    };
    globalThis.SillyTavern = { getContext: () => runtimeContext };
    const input = document.createElement('textarea');
    input.id = 'send_textarea';
    input.value = '我本轮先观察周围。';
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(input);
    const send = document.createElement('button');
    send.id = 'send_but';
    send.addEventListener('click', () => { globalThis.__hypnoosQaSendCount = (globalThis.__hypnoosQaSendCount || 0) + 1; });
    document.body.appendChild(send);
  });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  assert.equal(await page.evaluate(() => globalThis.__hypnoosQaLegacyDestroyed), 0, '插件启动时销毁了原4.3单例');
  assert.equal(await page.evaluate(() => globalThis.__ST_HYPNOOS_FLOATING_SINGLETON__?.revision), 'legacy-4.3');
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frameHandle = await page.waitForSelector('#hypnoos3-extension-floating-phone-host');
  void frameHandle;
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  const hostMetrics = await page.evaluate(() => {
    const shadow = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot;
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

  const bridgeSnapshot = await frame.evaluate(async () => {
    const books = await globalThis.getCharWorldbookNames?.('current');
    const worldbook = await globalThis.getWorldbook?.(books?.primary);
    const mvu = await globalThis.Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
    return { books, worldbook, mvu };
  });
  assert.equal(bridgeSnapshot.books.primary, 'qa-book');
  assert.equal(bridgeSnapshot.worldbook.entries['1'].comment, 'QA地点');
  assert.equal(bridgeSnapshot.mvu.stat_data.系统.MC能量, 66);

  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-home.png`, fullPage: true });
  await frame.evaluate(() => {
    const root = document.querySelector('.w-full.h-full.bg-black.overflow-hidden.relative') || document.querySelector('#root');
    const stale = document.createElement('div');
    stale.className = 'st-react-clean-chrome';
    stale.textContent = 'MC能量 25 / 25 VIP0';
    root.appendChild(stale);
  });
  await frame.locator('[aria-label="打开本轮输入"]').click();
  await frame.waitForSelector('.st-operation-phone-app [data-operation-note]');
  assert.equal(await frame.locator('.st-react-clean-chrome').count(), 0, '本轮输入仍残留 MC 能量顶栏');
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
  if (screenshotPrefix.includes('desktop')) {
    await frame.getByRole('button', { name: '直接发送' }).click();
    await page.waitForFunction(() => globalThis.__hypnoosQaSendCount === 1);
  } else {
    await frame.getByRole('button', { name: '写入输入框' }).click();
  }
  await page.waitForFunction(() => document.querySelector('#send_textarea')?.value === '我本轮决定先调查附近，再和同伴交谈。');
  assert.deepEqual(errors, []);
  await page.close();
  return { hostMetrics, shellMetrics, panelScroll };
}

const desktop = await openPhone({ width: 1180, height: 900 }, '0.6.3-desktop');
const narrow = await openPhone({ width: 760, height: 900 }, '0.6.3-narrow');
console.log(JSON.stringify({ desktop, narrow }, null, 2));
await browser.close();
