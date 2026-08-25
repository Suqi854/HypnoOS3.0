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
    const requestBody = request.method() === 'POST' ? request.postDataJSON() : null;
    const promptText = JSON.stringify(requestBody?.messages || []);
    const adapted = {
      apps: {
        map: [{ title: 'QA测试地点', summary: '图书馆、车站与校园构成主要活动区域。', meta: '校园区域' }],
        monitor: [{ title: 'QA车站公共监控', summary: '查看车站入口与公共通道的安全摘要。', meta: '在线' }],
        calendar: [{ title: 'QA开学日', summary: '举行开学说明与校园参观。', meta: '4月8日' }],
        timetable: [{ title: '语文', summary: 'QA教室的上午课程。', meta: '周一 第1节 08:30-09:15' }],
        rewards: [{ title: '初访图书馆', summary: '与QA角色完成一次图书馆探索，奖励10星光点。', meta: '任务 +10' }, { title: '校园观察者', summary: '观察QA角色所在校园的三个地点，奖励15星光点。', meta: '成就 +15' }],
        work: [{ title: '图书管理员助理', summary: '整理图书并协助借阅，按班次结算。', meta: '放学后' }],
        mchan: [{ title: '校园新学期见闻', summary: '匿名讨论图书馆与车站附近的新鲜事。', meta: '校园区' }],
      },
    };
    const content = promptText.includes('HypnoOS世界书适配器') ? JSON.stringify(adapted) : 'OK';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
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
      getWorldInfoNames() { return ['qa-book', 'qa-book-2']; },
      loadWorldInfo(name) { return name === 'qa-book-2'
        ? { entries: { 1: { uid: 11, comment: '[地点] QA海滨公园', content: `${name}: 海滨公园与商业街。` }, 2: { uid: 12, comment: '[角色] QA女性档案', content: '<QA女性人设>\n姓名: QA女性\n性别: 女\n年龄: 19\n职业: 学生会成员\n身高: 165cm' } } }
        : { entries: { 1: { uid: 1, comment: '[地点] QA测试地点', content: `${name}: 测试地点，包含图书馆和车站。` }, 2: { uid: 2, comment: '[角色] QA男性档案', content: '<QA男性人设>\n姓名: QA男性\n性别: 男\n职业: 教师' } } }; },
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
  assert.equal(bridgeSnapshot.worldbook.entries['1'].comment, '[地点] QA测试地点');
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
  await frame.getByRole('button', { name: '刷新检查' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('变量格式检查已刷新'));
  assert.match(await frame.locator('.st-information-feedback').innerText(), /已刷新/);
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-information-app.png`, fullPage: true });
  await frame.locator('.st-information-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  if (screenshotPrefix.includes('desktop')) {
    await frame.locator('[aria-label="打开男性档案"]').click();
    await frame.waitForSelector('.st-profile-app');
    await frame.waitForFunction(() => document.querySelector('.st-profile-app')?.innerText?.includes('QA男性'));
    await frame.locator('[data-profile-desk-role="QA男性"]').click();
    const genderSelect = frame.locator('[data-profile-gender-correction]');
    assert.equal(await genderSelect.inputValue(), 'male');
    await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-male-profile.png`, fullPage: true });
    await genderSelect.selectOption('female');
    await frame.waitForFunction(() => document.querySelector('.st-profile-app')?.getAttribute('aria-label') === '男性档案' || document.querySelector('.st-profile-app')?.innerText?.includes('女性档案'));
    assert.equal(await frame.locator('[data-profile-gender-correction]').inputValue(), 'female');
    await frame.locator('.st-profile-app [data-lite-action="back"]').click();
    await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

    await frame.locator('[aria-label="打开头像库"]').click();
    await frame.waitForSelector('.st-avatar-library-app');
    await frame.locator('[data-avatar-files]').setInputFiles({ name: 'qa-avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
    await frame.waitForFunction(() => document.querySelector('.st-avatar-library-app')?.innerText?.includes('已导入 1 张'));
    await frame.getByRole('button', { name: '用于所选角色' }).click();
    await frame.waitForFunction(() => document.querySelector('.st-avatar-library-app')?.innerText?.includes('已将头像应用到'));
    await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-avatar-library.png`, fullPage: true });
    await frame.locator('.st-avatar-library-app [data-lite-action="back"]').click();
    await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

    await frame.locator('[data-home-app-id="encounter"]').click();
    await frame.waitForSelector('.st-encounter-app');
    await frame.waitForFunction(() => /还没有(?:角色包|可用角色)/.test(document.querySelector('.st-encounter-app')?.innerText || ''));
    const encounterText = await frame.locator('.st-encounter-app').innerText();
    assert.match(encounterText, /还没有(?:角色包|可用角色)/);
    assert.doesNotMatch(encounterText, /白枢暗子|小乔的p5r角色包|中村樱/);
    await frame.locator('.st-encounter-app [data-lite-action="back"]').click();
    await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
  }

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
  for (const label of ['API 预设', '预设名称', '自定义直连', '端点（基础 URL）', 'API 密钥', '模型名', '加载模型', '最大回复长度', '附加主体参数', '排除主体参数', '附加请求标头', '保存当前预设']) assert.match(settingsText, new RegExp(label));
  assert.doesNotMatch(settingsText, /酒馆后端代理/);
  const modelInput = frame.locator('[data-connector-field="model"]');
  assert.equal(await modelInput.getAttribute('readonly'), '', '模型名仍允许手动输入');
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

  await frame.locator('[aria-label="打开设置"]').click();
  const regionSelect = frame.locator('[data-settings-region]');
  assert.ok((await regionSelect.boundingBox()).height <= 40, '通用模板选择框没有缩小');
  await frame.locator('.st-settings-profile-worldbooks-panel').scrollIntoViewIfNeeded();
  const scrollBeforeRegionChange = await frame.locator('.st-settings-app .st-lite-body').evaluate((node) => node.scrollTop);
  await regionSelect.selectOption('auto');
  const scrollAfterRegionChange = await frame.locator('.st-settings-app .st-lite-body').evaluate((node) => node.scrollTop);
  assert.ok(scrollAfterRegionChange >= scrollBeforeRegionChange - 2, '设置点击后滚动位置回到了顶部');
  await frame.waitForSelector('[data-settings-worldbook]:not([disabled])', { state: 'attached' });
  const profilePicker = frame.locator('[data-settings-worldbook-picker="profile"]');
  assert.equal(await profilePicker.getAttribute('open'), null, '档案世界书选择器默认没有收起');
  await profilePicker.locator('summary').click();
  assert.notEqual(await profilePicker.getAttribute('open'), null, '档案世界书选择器未能展开');
  for (const name of ['qa-book', 'qa-book-2']) {
    const input = profilePicker.locator(`[data-settings-profile-worldbooks][value="${name}"]`);
    if (!await input.isChecked()) await input.locator('..').click();
  }
  assert.equal(await profilePicker.locator('[data-settings-profile-worldbooks]:checked').count(), 2);
  assert.equal(await profilePicker.locator('[data-settings-worldbook-summary]').innerText(), '已选择 2 本世界书');
  const checkedProfileStyle = await profilePicker.locator('[data-settings-profile-worldbooks][value="qa-book"]:checked').evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.match(checkedProfileStyle, /rgb\(255, 63, 145\)/, '选中世界书没有显示粉色勾选状态');
  await frame.getByRole('button', { name: '读取并导入档案' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('档案导入完成：女性 1 名，男性 1 名'));
  const adaptivePicker = frame.locator('[data-settings-worldbook-picker="adaptive"]');
  assert.equal(await adaptivePicker.getAttribute('open'), null, '适配世界书选择器默认没有收起');
  await adaptivePicker.locator('summary').click();
  for (const name of ['qa-book', 'qa-book-2']) {
    const input = adaptivePicker.locator(`[data-settings-worldbook][value="${name}"]`);
    if (!await input.isChecked()) await input.locator('..').click();
  }
  assert.equal(await adaptivePicker.locator('[data-settings-worldbook]:checked').count(), 2);
  assert.equal(await adaptivePicker.locator('[data-settings-worldbook-summary]').innerText(), '已选择 2 本世界书');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-worldbook-dropdown-open.png`, fullPage: true });
  await frame.getByRole('button', { name: '合并生成', exact: true }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('已合并 2 本世界书完成适配'));
  const generatedProfile = await frame.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('hypnoos:world-adaptation:v1:'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
  assert.ok(generatedProfile, '生成完成后没有保存结构化适配包');
  assert.equal(generatedProfile.schema, 'HypnoWorldAdaptation/v1');
  assert.deepEqual(generatedProfile.worldbookNames, ['qa-book', 'qa-book-2']);
  assert.equal(generatedProfile.apps.timetable[0].title, '语文');
  await frame.locator('.st-settings-region-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-worldbook-adapter-settings.png`, fullPage: true });
  await frame.locator('.st-settings-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开女性档案"]').click();
  await frame.waitForSelector('.st-profile-app');
  assert.match(await frame.locator('.st-profile-app').textContent(), /档案/);
  assert.match(await frame.locator('.st-profile-app').textContent(), /QA女性/);
  await frame.locator('.st-profile-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开地图"]').click();
  await frame.waitForSelector('.st-map-app');
  assert.match(await frame.locator('.st-map-app').innerText(), /QA测试地点/);
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, '地图被统一卡片页覆盖');
  await frame.locator('.st-map-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开日历"]').click();
  await frame.waitForSelector('.st-calendar-lite-app .st-cal-month-grid');
  assert.match(await frame.locator('.st-calendar-lite-app').innerText(), /QA开学日/);
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, '日历被统一卡片页覆盖');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-calendar-original-ui.png`, fullPage: true });
  await frame.locator('.st-calendar-lite-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开课程表"]').click();
  await frame.waitForSelector('.st-timetable-app .st-tt-week');
  assert.match(await frame.locator('.st-timetable-app').innerText(), /语文/);
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, '课程表被统一卡片页覆盖');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-timetable-original-ui.png`, fullPage: true });
  await frame.locator('.st-timetable-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开MC匿名版"]').click();
  await frame.waitForSelector('.st-mchan-internal-app .st-mchan-boards');
  assert.match(await frame.locator('.st-mchan-internal-app').innerText(), /校园新学期见闻/);
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, 'MC匿名版被统一卡片页覆盖');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-mchan-original-ui.png`, fullPage: true });
  await frame.locator('.st-mchan-internal-app .st-mchan-back').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开成就和任务"]').click();
  await frame.waitForSelector('.st-reward-app .st-graph-tabs');
  assert.match(await frame.locator('.st-reward-app').textContent(), /校园观察者/);
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, '任务与成就被统一卡片页覆盖');
  await page.screenshot({ path: `docs/screenshots/${screenshotPrefix}-rewards-original-ui.png`, fullPage: true });
  await frame.locator('.st-reward-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开监控"]').click();
  await frame.waitForSelector('.st-monitor-app');
  assert.equal(await frame.locator('.st-adaptive-world-app').count(), 0, '监控被统一卡片页覆盖');
  await frame.locator('.st-monitor-app [data-lite-action="back"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.locator('[aria-label="打开设置"]').click();
  await frame.locator('[data-settings-cheat-key]').fill('123456');
  await frame.getByRole('button', { name: '开启作弊模式' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('作弊模式未解锁：密钥错误'));
  assert.doesNotMatch(await frame.locator('.st-settings-cheat-panel').innerText(), /已开启/);
  await frame.locator('[data-settings-cheat-key]').fill('666666');
  await frame.getByRole('button', { name: '开启作弊模式' }).click();
  await frame.waitForSelector('.st-encounter-confirm');
  await frame.getByRole('button', { name: '取消' }).click();
  await frame.getByRole('button', { name: '清空数据' }).click();
  await frame.getByRole('button', { name: '确认清空' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('已清空当前聊天的世界书适配数据'));
  assert.equal(await frame.evaluate(() => Object.keys(localStorage).some((item) => item.startsWith('hypnoos:world-adaptation:v1:'))), false);
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

const desktop = await openPhone({ width: 1180, height: 900 }, '0.7.4-desktop');
const narrow = await openPhone({ width: 760, height: 900 }, '0.7.4-narrow');
console.log(JSON.stringify({ desktop, narrow }, null, 2));
await browser.close();
