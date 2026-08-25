import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const removedFeaturePattern = new RegExp(`gal${'game'}|\u4eba\u7269\u6f14\u51fa|\u56fd\u738b\u6e38\u620f`, 'i');

expect(manifest.minimum_client_version === '1.18.0', 'minimum_client_version 必须锁定 1.18.0');
expect(/^\d+\.\d+\.\d+$/.test(manifest.version), 'manifest 版本不是 SemVer');
for (const path of [manifest.js, manifest.css, 'capability-contract.json']) {
  try { await stat(new URL(path, root)); } catch { failures.push(`缺少清单文件：${path}`); }
}

const ui = await readFile(new URL('ui/index.html', root));
const uiHash = createHash('sha256').update(ui).digest('hex');
expect(uiHash === '2c1f623192ac13d61bdf0036cd20ded99716e07ce582c97d28b356fa70c49418', `UI 基线哈希变化：${uiHash}`);
const uiText = ui.toString('utf8');
expect(uiText.includes('html,body,#app{width:100%;height:100%;min-height:0;margin:0;overflow:hidden!important;overscroll-behavior:none}#app{contain:strict}'), '手机前端缺少满屏滚动锁');
expect(uiText.includes('window.__ST_OPEN_PENDING_INPUT_APP__'), '手机前端缺少本轮输入应用入口');
expect(uiText.includes('玩家本轮输入'), '本轮输入应用没有采用玩家输入合同');
expect(uiText.includes('window.__ST_SEND_OPERATION_DIRECTLY__'), '本轮输入应用缺少直接发送合同');
expect(uiText.includes('removeReactChrome(root)'), '切换内部应用时没有清理旧 React 顶栏');
expect(uiText.includes('#app>.w-full.flex.items-center.justify-center.p-2>div:first-child'), '手机前端缺少重复机壳消除规则');
expect(!removedFeaturePattern.test(uiText), '手机前端不得残留已移除功能的运行代码');
const floatingHost = await readFile(new URL('public/floating-bootstrap.js', root), 'utf8');
for (const marker of ['data-phone-drag', 'pet-character-toggle', 'sidecar', 'launcher']) {
  expect(floatingHost.includes(marker), `4.3 悬浮宿主缺少关键能力：${marker}`);
}
expect(floatingHost.includes("scrolling='no'"), '手机 iframe 必须关闭文档滚动条');
expect(!floatingHost.includes('0 0 0 6px rgba(17,12,30,.72)'), '悬浮宿主仍包含额外 6px 黑色描边');
expect(!removedFeaturePattern.test(floatingHost), '悬浮宿主不得残留已移除功能的按钮、同步或渲染代码');
expect(floatingHost.includes('config.singletonKey'), '悬浮宿主没有使用可配置独立单例键');
const extensionSource = await readFile(new URL('src/extension.js', root), 'utf8');
expect(!extensionSource.includes('hypnoos3-launcher'), '不得重新引入自制 H 启动器');
const floatingHostSource = await readFile(new URL('src/floating-host.js', root), 'utf8');
expect(floatingHostSource.includes('__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__'), '插件没有独立于4.3脚本的单例命名空间');
expect(floatingHostSource.includes('hypnoos3-extension-floating-phone-host'), '插件没有独立于4.3脚本的宿主节点');
expect(floatingHostSource.includes('directSend(text)'), '插件宿主缺少直接发送桥');
const hostAdapterSource = await readFile(new URL('src/host-adapter.js', root), 'utf8');
expect(hostAdapterSource.includes('getCharacterWorldbookNames()'), '宿主适配器缺少当前角色世界书解析');
expect(hostAdapterSource.includes("{ type: 'message', message_id: 'latest' }"), '宿主适配器没有读取最新楼层变量');

async function files(dir) {
  const result = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...await files(path));
    else if (/\.(?:js|mjs)$/.test(name)) result.push(path);
  }
  return result;
}

const rootPath = fileURLToPath(root);
const sourceRoot = fileURLToPath(new URL('src/', root));
for (const path of await files(sourceRoot)) {
  const text = await readFile(path, 'utf8');
  const label = relative(rootPath, path);
  expect(!/\beval\s*\(/.test(text), `${label} 使用 eval`);
  expect(!/new\s+Function\s*\(/.test(text), `${label} 使用 new Function`);
  expect(!/https?:\/\/[^'"`\s]*\.(?:js|mjs)(?:[?'"`\s]|$)/i.test(text), `${label} 引用远程脚本`);
  expect(!/innerHTML\s*=/.test(text), `${label} 对 innerHTML 赋值`);
  expect(!/(?:sk-|api[_-]?key\s*[:=]\s*['"])[A-Za-z0-9_-]{12,}/i.test(text), `${label} 疑似包含 API 密钥`);
}

if (failures.length) {
  console.error(failures.map((item) => `FAIL ${item}`).join('\n'));
  process.exitCode = 1;
} else console.log(`PASS static checks; UI baseline ${uiHash}`);
