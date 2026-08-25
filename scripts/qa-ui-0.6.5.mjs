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
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  const directRequests = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  await page.route('https://qa-openai.example/**', async (route) => {
    const request = route.request();
    directRequests.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.method() === 'POST' ? request.postDataJSON() : null });
    if (request.url().endsWith('/models')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'qa-model-small' }, { id: 'qa-model-pro' }] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'OK' } }] }) });
  });
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
        { mes: '回复', is_user: false, name: 'QA角色', variables: { stat_data: { 系统: { MC能量: 66, MC能量上限: 80, 星光点: 12, 持有零花钱: 3456 }, 角色: { 测试角色: { 好感度: 12 } } } } },
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
  try {
    await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
  } catch (error) {
    console.error('phoneBootFailure', { errors, url: frame.url(), text: await frame.locator('body').innerText().catch(() => '') });
    throw error;
  }

  const hostMetrics = await page.evaluate(() => {
    const shadow = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot;
    const wrap = shadow.querySelector('.phone-wrap');
    const panel = shadow.querySelector('.panel');
    return {
      borderWidth: getComputedStyle(wrap).borderWidth,
      background: getComputedStyle(wrap).backgroundColor,
      dragEdges: shadow.querySelectorAll('[data-phone-drag]').length,
      resizeCorners: shadow.querySelectorAll('[data-phone-resize]').length,
      resizeCornerText: Array.from(shadow.querySelectorAll('[data-phone-resize]')).map((node) => node.textContent).join(''),
      sidecarDisplay: getComputedStyle(shadow.querySelector('.sidecar')).display,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
    };
  });
  assert.equal(hostMetrics.borderWidth, '1px');
  assert.equal(hostMetrics.background, 'rgba(0, 0, 0, 0)');
  assert.equal(hostMetrics.dragEdges, 5);
  assert.equal(hostMetrics.resizeCorners, 2);
  assert.equal(hostMetrics.resizeCornerText, '');
  assert.equal(hostMetrics.sidecarDisplay, 'none');

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

  await frame.locator('[aria-label="打开信息"]').click();
  await frame.waitForSelector('.st-information-app');
  assert.equal(await frame.locator('.st-react-clean-chrome,.st-react-app-island-layer').count(), 0, '信息应用仍叠加旧 React 顶栏');
  const informationText = await frame.locator('.st-information-app').innerText();
  assert.match(informationText, /3,456/);
  assert.match(informationText, /MC能量\s*66/);
  assert.match(informationText, /变量格式/);
  assert.match(informationText, /桌宠人物/);
  assert.match(informationText, /变量楼层/);
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-information-app.png`, fullPage: true });
  await frame.locator('.st-information-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  if (screenshotPrefix.includes('desktop')) {
    const before = await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.panel').getBoundingClientRect().toJSON());
    const corner = page.locator('#hypnoos3-extension-floating-phone-host .resize-corner.right');
    const box = await corner.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 38, box.y + box.height / 2 + 38, { steps: 6 });
    await page.mouse.up();
    const after = await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.panel').getBoundingClientRect().toJSON());
    assert.ok(after.width > before.width + 10, '右下角拖拽未放大手机');
    assert.ok(Math.abs(after.width / after.height - 430 / 812) < 0.002, '手机缩放不是等比例');

    const enlargedBox = await corner.boundingBox();
    assert.ok(enlargedBox);
    await page.mouse.move(enlargedBox.x + enlargedBox.width / 2, enlargedBox.y + enlargedBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(enlargedBox.x + enlargedBox.width / 2 - 38, enlargedBox.y + enlargedBox.height / 2 - 38, { steps: 6 });
    await page.mouse.up();
    const restored = await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.panel').getBoundingClientRect().toJSON());
    console.log('resizeMetrics', { before, enlarged: after, restored });
    assert.ok(restored.width < after.width - 10, '右下角拖拽未缩小手机');
    assert.ok(Math.abs(restored.width / restored.height - 430 / 812) < 0.002, '手机缩小时不是等比例');
    assert.ok(Math.abs(restored.width - before.width) < 3, '缩放回归未恢复默认尺寸');
  }

  await frame.locator('[aria-label="打开设置"]').click();
  await frame.getByRole('button', { name: '模型插头' }).click();
  assert.equal(await frame.locator('.st-react-clean-chrome,.st-react-app-island-layer').count(), 0, '设置应用仍叠加旧 React 顶栏');
  const settingsText = await frame.locator('.st-settings-app').innerText();
  for (const label of ['API 预设', '预设名称', '酒馆后端代理', '自定义直连', '端点（基础 URL）', 'API 密钥', '模型名', '加载模型', '最大回复长度', '附加主体参数', '排除主体参数', '附加请求标头', '保存当前预设']) assert.match(settingsText, new RegExp(label));
  const modelInput = frame.locator('[data-connector-field="model"]');
  assert.equal(await modelInput.getAttribute('readonly'), '', '模型名仍允许手动输入');
  await frame.locator('[data-connector-field="mode"][value="direct"]').check({ force: true });
  await frame.locator('[data-connector-field="enabled"]').check();
  await frame.locator('[data-connector-field="endpoint"]').fill('https://qa-openai.example/v1');
  await frame.locator('[data-connector-secret="text"]').fill('qa-secret-not-logged');
  await frame.getByRole('button', { name: '加载模型' }).click();
  const modelList = frame.locator('[data-connector-model-list="text"]');
  await modelList.waitFor({ state: 'visible' });
  assert.deepEqual(await modelList.locator('option').allTextContents(), ['请选择模型', 'qa-model-pro', 'qa-model-small']);
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-model-list.png`, fullPage: true });
  await modelList.selectOption('qa-model-pro');
  assert.equal(await modelInput.inputValue(), 'qa-model-pro');
  await frame.getByRole('button', { name: '保存当前预设' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('文生文插头配置已保存'));
  await frame.getByRole('button', { name: '测试连接' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('文生文插头连接成功'));
  const savedConnector = await frame.evaluate(() => JSON.parse(localStorage.getItem('hypnoos:model-connectors:v1')));
  assert.equal(savedConnector.text.mode, 'direct');
  assert.equal(savedConnector.text.model, 'qa-model-pro');
  assert.equal(savedConnector.text.endpoint, 'https://qa-openai.example/v1');
  assert.equal(directRequests[0]?.url, 'https://qa-openai.example/v1/models');
  assert.equal(directRequests[1]?.url, 'https://qa-openai.example/v1/chat/completions');
  assert.equal(directRequests[1]?.body?.model, 'qa-model-pro');
  assert.equal(directRequests[1]?.headers?.authorization, 'Bearer qa-secret-not-logged');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-model-settings.png`, fullPage: true });
  await frame.locator('.st-settings-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

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

const desktop = await openPhone({ width: 1180, height: 900 }, '0.6.5-desktop');
const narrow = await openPhone({ width: 760, height: 900 }, '0.6.5-narrow');
console.log(JSON.stringify({ desktop, narrow }, null, 2));
await browser.close();
