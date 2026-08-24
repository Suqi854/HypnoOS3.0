import { ControlPanel } from './control-panel.js';
import { FrameBridge } from './frame-bridge.js';
import { HostAdapter } from './host-adapter.js';
import { HypnoStorage } from './storage.js';
import { StateStore } from './state-store.js';
import { EXTENSION_ID, RUNTIME_KEY } from './constants.js';

function button(id, label, title) {
  const node = document.createElement('button');
  node.id = id;
  node.type = 'button';
  node.textContent = label;
  node.title = title;
  node.setAttribute('aria-label', title);
  return node;
}

function installDrag(node) {
  let active = null;
  const down = (event) => {
    if (event.button !== 0) return;
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.offsetLeft, top: node.offsetTop, moved: false };
    node.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) active.moved = true;
    node.style.left = `${Math.max(0, Math.min(innerWidth - node.offsetWidth, active.left + dx))}px`;
    node.style.top = `${Math.max(0, Math.min(innerHeight - node.offsetHeight, active.top + dy))}px`;
    node.style.right = 'auto'; node.style.bottom = 'auto';
  };
  const up = (event) => { if (active?.id === event.pointerId) { node.dataset.dragged = active.moved ? '1' : ''; active = null; } };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return () => { node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); };
}

class Runtime {
  disposers = [];

  async start() {
    this.host = new HostAdapter();
    this.storage = new HypnoStorage();
    this.store = new StateStore(this.host, this.storage);
    await this.store.initialize();
    this.host.installPromptLifecycle();

    this.launcher = button('hypnoos3-launcher', 'H', '打开催眠手机');
    document.body.append(this.launcher);
    this.disposers.push(installDrag(this.launcher));

    this.phone = document.createElement('div');
    this.phone.id = 'hypnoos3-phone-host';
    this.phone.hidden = true;
    const frame = document.createElement('iframe');
    frame.id = 'hypnoos3-phone-frame';
    frame.title = '催眠手机';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
    const configure = button('', '⚙', '打开催眠手机设置');
    configure.className = 'hypnoos3-host-control'; configure.dataset.action = 'configure';
    const closePhone = button('', '×', '关闭催眠手机');
    closePhone.className = 'hypnoos3-host-control'; closePhone.dataset.action = 'close';
    this.phone.append(frame, configure, closePhone);
    document.body.append(this.phone);

    this.control = document.createElement('div');
    this.control.id = 'hypnoos3-control-host';
    this.control.hidden = true;
    document.body.append(this.control);
    this.panel = new ControlPanel(this.control, { host: this.host, store: this.store, storage: this.storage, close: () => this.hideControl() });

    this.bridge = new FrameBridge(frame, this.host, this.store);
    await this.bridge.load();
    this.bridge.addEventListener('error', (event) => this.panel.status(event.detail?.message || '手机桥接失败', true));

    const toggle = () => { if (this.launcher.dataset.dragged) { this.launcher.dataset.dragged = ''; return; } this.phone.hidden = !this.phone.hidden; if (!this.phone.hidden) this.bridge.sync(); };
    const openControl = () => { this.panel.render(); this.control.hidden = false; this.control.querySelector('button')?.focus(); };
    const escape = (event) => { if (event.key === 'Escape') { if (!this.control.hidden) this.hideControl(); else this.phone.hidden = true; } };
    this.launcher.addEventListener('click', toggle);
    configure.addEventListener('click', openControl);
    closePhone.addEventListener('click', () => { this.phone.hidden = true; });
    this.control.addEventListener('click', (event) => { if (event.target === this.control) this.hideControl(); });
    document.addEventListener('keydown', escape);
    this.disposers.push(() => this.launcher.removeEventListener('click', toggle), () => configure.removeEventListener('click', openControl), () => document.removeEventListener('keydown', escape));

    const onState = () => { this.bridge.sync(); if (!this.control.hidden) this.panel.render(); };
    this.store.addEventListener('change', onState);
    this.disposers.push(() => this.store.removeEventListener('change', onState));
    const context = this.host.context;
    const chatChanged = context?.eventTypes?.CHAT_CHANGED;
    if (chatChanged && context?.eventSource) {
      const reload = async () => { await this.store.initialize(); this.bridge.sync(); if (!this.control.hidden) this.panel.render(); };
      context.eventSource.on(chatChanged, reload);
      this.disposers.push(() => context.eventSource.removeListener(chatChanged, reload));
    }
    return this;
  }

  hideControl() { this.control.hidden = true; this.launcher.focus(); }

  destroy() {
    while (this.disposers.length) { try { this.disposers.pop()?.(); } catch {} }
    this.bridge?.destroy();
    this.host?.destroy();
    this.storage?.close();
    this.control?.remove();
    this.phone?.remove();
    this.launcher?.remove();
  }
}

export async function startExtension() {
  if (globalThis[RUNTIME_KEY]) return globalThis[RUNTIME_KEY];
  const runtime = await new Runtime().start();
  globalThis[RUNTIME_KEY] = runtime;
  console.info(`[${EXTENSION_ID}] 已启动`, runtime.host.capabilities());
  return runtime;
}

export function stopExtension() {
  globalThis[RUNTIME_KEY]?.destroy?.();
  delete globalThis[RUNTIME_KEY];
}
