import { toLegacyVariables } from './contracts.js';

const BRIDGE_KEY = '__HYPNOOS3_CORE_BRIDGE__';
const SINGLETON_KEY = '__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__';
const HOST_ID = 'hypnoos3-extension-floating-phone-host';

function phoneFrame() {
  return document.querySelector(`#${HOST_ID}`)?.shadowRoot?.querySelector('iframe.phone') || null;
}

export class FloatingHost {
  constructor(host, store) {
    this.host = host;
    this.store = store;
    this.listeners = new Map();
    this.disposers = [];
  }

  async start() {
    const existing = globalThis[BRIDGE_KEY];
    if (existing?.destroy) existing.destroy();
    const bridge = this.#createBridge();
    globalThis[BRIDGE_KEY] = bridge;
    this.bridge = bridge;

    const onStore = () => {
      for (const [eventName, eventListeners] of this.listeners) {
        if (!/update|variable/i.test(eventName) || /initialized/i.test(eventName)) continue;
        for (const listener of eventListeners) {
          try { listener(this.store.state); } catch (error) { console.warn('[HypnoOS3] 前端刷新监听失败', error); }
        }
      }
    };
    this.store.addEventListener('change', onStore);
    this.disposers.push(() => this.store.removeEventListener('change', onStore));

    const onMessage = async (event) => {
      const frame = phoneFrame();
      if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || !event.data || typeof event.data !== 'object') return;
      if (event.data.type !== 'HYPNOOS_APPEND_OPERATION') return;
      const command = String(event.data.block || event.data.payload?.block || event.data.payload?.command || '').trim().slice(0, 20_000);
      if (command) await this.store.queueOperation({ sourceApp: String(event.data.payload?.sourceApp || 'phone'), command });
    };
    addEventListener('message', onMessage);
    this.disposers.push(() => removeEventListener('message', onMessage));

    const script = document.createElement('script');
    script.src = new URL('../public/floating-bootstrap.js', import.meta.url).href;
    script.dataset.frontendUrl = new URL('../ui/index.html', import.meta.url).href;
    script.dataset.assetBase = new URL('../public/assets/', import.meta.url).href;
    script.dataset.vendorBase = new URL('../public/vendor/', import.meta.url).href;
    script.dataset.bridgeKey = BRIDGE_KEY;
    script.dataset.singletonKey = SINGLETON_KEY;
    script.dataset.hostId = HOST_ID;
    script.dataset.registryEvent = 'HYPNOOS3_EXTENSION_FLOATING_REGISTRY_READY';
    script.dataset.storageKey = 'hypnoos3.extension.floatingPhone.ui.v1';
    script.dataset.revision = 'hypnoos3-0.6.4';
    script.dataset.mode = 'host';
    script.async = false;
    document.head.append(script);
    this.script = script;
    this.disposers.push(() => script.remove());
    await new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('4.3 悬浮宿主加载失败')), { once: true });
    });
    return this;
  }

  #createBridge() {
    const store = this.store;
    const host = this.host;
    const listeners = this.listeners;
    const bridge = {
      getVariables(option) {
        const value = host.readVariables(option);
        return value && typeof value === 'object' ? value : toLegacyVariables(store.state);
      },
      updateVariablesWith(updater) {
        const external = host.readVariables({ type: 'message', message_id: 'latest' });
        if (external && typeof external === 'object') return host.updateVariablesWith(updater, { type: 'message', message_id: 'latest' });
        const current = toLegacyVariables(store.state);
        const next = typeof updater === 'function' ? updater(structuredClone(current)) : updater;
        if (next && typeof next === 'object') store.importLegacyVariables(next).catch((error) => console.error('[HypnoOS3] 手机变量写入失败', error));
        return next || current;
      },
      getChatMessages() { return host.getMessages(); },
      setChatMessages() { return false; },
      triggerSlash(command) {
        const text = String(command || '').trim();
        if (text) store.queueOperation({ sourceApp: 'phone', command: text }).catch((error) => console.error('[HypnoOS3] 指令暂存失败', error));
        return '';
      },
      eventOn(eventName, listener) {
        if (typeof listener !== 'function') return { stop() {} };
        const key = String(eventName || 'variable_update');
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key).add(listener);
        return { stop() {
          listeners.get(key)?.delete(listener);
          if (!listeners.get(key)?.size) listeners.delete(key);
        } };
      },
      getCharWorldbookNames() { return host.getCharacterWorldbookNames(); },
      getWorldbook(name) { return host.loadWorldbook(name); },
      directSend(text) { return host.directSend(text); },
      destroy: () => this.destroy(),
    };
    bridge.Mvu = {
      get events() { return host.getMvuEvents(); },
      getMvuData(option) {
        const value = host.readMvu(option);
        return value && typeof value === 'object' ? value : { stat_data: toLegacyVariables(store.state) };
      },
      replaceMvuData(value, option) {
        const external = host.readMvu(option);
        if (external && typeof external === 'object') return host.replaceMvuData(value, option);
        const stat = value?.stat_data && typeof value.stat_data === 'object' ? value.stat_data : value;
        return store.importLegacyVariables(stat);
      },
    };
    return bridge;
  }

  destroy() {
    while (this.disposers.length) { try { this.disposers.pop()?.(); } catch {} }
    this.listeners.clear();
    try { globalThis[SINGLETON_KEY]?.destroy?.(); } catch {}
    if (globalThis[SINGLETON_KEY]) delete globalThis[SINGLETON_KEY];
    if (globalThis[BRIDGE_KEY] === this.bridge) delete globalThis[BRIDGE_KEY];
  }
}
