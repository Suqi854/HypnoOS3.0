import { toLegacyVariables } from './contracts.js';
import { clone } from './utils.js';

const OUTBOUND_TYPES = new Set(['HYPNOOS_APPEND_OPERATION', 'HYPNOOS3_VARIABLES_CHANGED', 'HYPNOOS3_READY']);

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function bridgeScript(snapshot, messages, messageId) {
  return `<script data-hypnoos3-bridge>\n(() => {\n` +
    `let variables=${safeJson(snapshot)};let messages=${safeJson(messages)};let messageId=${safeJson(messageId)};const HYPNOOS_ORIGIN=location.origin;\n` +
    `const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));\n` +
    `globalThis.__ST_LOCAL_PREVIEW__=false;globalThis.__ST_HYPNOOS_FLOATING_PHONE__=true;\n` +
    `globalThis.getVariables=()=>copy(variables);\n` +
    `globalThis.updateVariablesWith=async(updater)=>{const next=typeof updater==='function'?await updater(copy(variables)):updater;if(next&&typeof next==='object')variables=copy(next);parent.postMessage({type:'HYPNOOS3_VARIABLES_CHANGED',variables:copy(variables)},HYPNOOS_ORIGIN);return copy(variables)};\n` +
    `globalThis.getCurrentMessageId=()=>messageId;globalThis.getChatMessages=()=>copy(messages);\n` +
    `globalThis.setChatMessages=async()=>false;globalThis.createChatMessages=async()=>false;\n` +
    `globalThis.triggerSlash=async(command)=>{parent.postMessage({type:'HYPNOOS_APPEND_OPERATION',block:String(command||'')},HYPNOOS_ORIGIN);return ''};\n` +
    `globalThis.Mvu={getMvuData:()=>({stat_data:copy(variables)}),replaceMvuData:async(next)=>{variables=copy(next?.stat_data||next||{});parent.postMessage({type:'HYPNOOS3_VARIABLES_CHANGED',variables:copy(variables)},HYPNOOS_ORIGIN);return {stat_data:copy(variables)}},events:{}};\n` +
    `addEventListener('message',event=>{if(event.source!==parent||event.origin!==HYPNOOS_ORIGIN||!event.data||typeof event.data!=='object')return;if(event.data.type==='HYPNOOS3_STATE'){variables=copy(event.data.variables||{});messages=copy(event.data.messages||messages);messageId=event.data.messageId??messageId;dispatchEvent(new CustomEvent('hypnoos3-state'))}});\n` +
    `parent.postMessage({type:'HYPNOOS3_READY'},HYPNOOS_ORIGIN);\n})();\n</script>`;
}

export class FrameBridge extends EventTarget {
  #iframe;
  #host;
  #store;
  #blobUrl;
  #listener;

  constructor(iframe, host, store) {
    super();
    this.#iframe = iframe;
    this.#host = host;
    this.#store = store;
  }

  async load() {
    const uiUrl = new URL('../ui/index.html', import.meta.url);
    const vendorBase = new URL('../public/vendor/', import.meta.url).href;
    const response = await fetch(uiUrl);
    if (!response.ok) throw new Error(`手机 UI 加载失败：HTTP ${response.status}`);
    let html = await response.text();
    html = html.replaceAll('/public/vendor/', vendorBase);
    const script = bridgeScript(toLegacyVariables(this.#store.state), this.#host.getMessages(), this.#host.latestMessageId());
    const firstScript = html.indexOf('<script');
    if (firstScript < 0) throw new Error('手机 UI 缺少脚本入口');
    html = `${html.slice(0, firstScript)}${script}${html.slice(firstScript)}`;
    this.#blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    this.#listener = (event) => this.#receive(event);
    addEventListener('message', this.#listener);
    this.#iframe.src = this.#blobUrl;
  }

  sync() {
    this.#iframe.contentWindow?.postMessage({
      type: 'HYPNOOS3_STATE',
      variables: toLegacyVariables(this.#store.state),
      messages: this.#host.getMessages(),
      messageId: this.#host.latestMessageId(),
    }, location.origin);
  }

  async #receive(event) {
    if (event.source !== this.#iframe.contentWindow || event.origin !== location.origin || !event.data || typeof event.data !== 'object') return;
    const type = String(event.data.type || '');
    if (!OUTBOUND_TYPES.has(type)) return;
    try {
      if (type === 'HYPNOOS3_READY') return this.sync();
      if (type === 'HYPNOOS3_VARIABLES_CHANGED') {
        await this.#store.importLegacyVariables(clone(event.data.variables));
        return;
      }
      const command = String(event.data.block || event.data.payload?.block || event.data.payload?.command || '').trim().slice(0, 20_000);
      if (command) await this.#store.queueOperation({ sourceApp: String(event.data.payload?.sourceApp || 'phone'), command });
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }

  destroy() {
    if (this.#listener) removeEventListener('message', this.#listener);
    if (this.#blobUrl) URL.revokeObjectURL(this.#blobUrl);
    this.#iframe.removeAttribute('src');
  }
}
