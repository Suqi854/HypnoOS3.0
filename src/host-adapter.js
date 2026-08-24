import { CHAT_STATE_KEY, EXTENSION_ID, PROMPT_ID } from './constants.js';
import { clone } from './utils.js';

function findContext() {
  try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; }
}

export class HostAdapter {
  #disposers = [];
  #promptText = '';

  get context() { return findContext(); }

  capabilities() {
    const context = this.context;
    return {
      host: Boolean(context),
      worldbook: Boolean(context?.loadWorldInfo && context?.saveWorldInfo && context?.getWorldInfoNames),
      generation: Boolean(context?.generateRaw),
      promptInjection: Boolean(context?.setExtensionPrompt && context?.eventSource && context?.eventTypes),
      tavernHelper: typeof globalThis.getVariables === 'function' && typeof globalThis.updateVariablesWith === 'function',
      mvu: Boolean(globalThis.Mvu?.getMvuData && globalThis.Mvu?.replaceMvuData),
    };
  }

  contextKey() {
    const context = this.context;
    if (!context) return 'preview';
    return `${context.groupId ? 'group' : 'character'}:${context.groupId ?? context.characterId ?? 'none'}:${context.chatId ?? 'no-chat'}`;
  }

  characterKey() {
    const context = this.context;
    return context?.groupId ? `group:${context.groupId}` : `character:${context?.characterId ?? 'none'}`;
  }

  loadChatState() {
    return clone(this.context?.chatMetadata?.[CHAT_STATE_KEY] ?? null);
  }

  async saveChatState(state) {
    const context = this.context;
    if (!context) return false;
    context.chatMetadata[CHAT_STATE_KEY] = clone(state);
    context.saveMetadataDebounced?.();
    return true;
  }

  getMessages() {
    const chat = this.context?.chat;
    if (!Array.isArray(chat)) return [{ message_id: 0, message: '<StatusPlaceHolderImpl />', is_user: false }];
    return chat.map((message, index) => ({
      message_id: index,
      message: String(message?.mes ?? message?.message ?? ''),
      is_user: Boolean(message?.is_user),
      name: String(message?.name ?? ''),
    }));
  }

  latestMessageId() {
    return Math.max(0, this.getMessages().length - 1);
  }

  setInput(text, { append = true } = {}) {
    const input = document.querySelector('#send_textarea, textarea[name="send_textarea"], #chat-input textarea');
    if (!input) return false;
    const incoming = String(text || '').trim();
    input.value = append && input.value.trim() ? `${input.value.trim()}\n\n${incoming}` : incoming;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
    return true;
  }

  async generateRaw({ prompt, systemPrompt = '', jsonSchema = null, responseLength = 4096 }) {
    const generateRaw = this.context?.generateRaw;
    if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw');
    return generateRaw({ prompt, systemPrompt, jsonSchema, responseLength, quietToLoud: false, trimNames: true });
  }

  getWorldbookNames() {
    return this.context?.getWorldInfoNames?.() || [];
  }

  loadWorldbook(name) {
    const fn = this.context?.loadWorldInfo;
    if (!fn) throw new Error('世界书读取接口不可用');
    return fn(name);
  }

  async saveWorldbook(name, data) {
    const context = this.context;
    if (!context?.saveWorldInfo) throw new Error('世界书写入接口不可用');
    await context.saveWorldInfo(name, clone(data), true);
    await context.updateWorldInfoList?.();
  }

  setPromptText(text) {
    this.#promptText = String(text || '');
  }

  installPromptLifecycle() {
    const context = this.context;
    if (!context?.eventSource || !context?.eventTypes || !context?.setExtensionPrompt) return;
    const refresh = () => context.setExtensionPrompt(PROMPT_ID, this.#promptText, 1, 4, false, 0);
    const clear = () => context.setExtensionPrompt(PROMPT_ID, '', -1, 0, false, 0);
    const before = context.eventTypes.GENERATION_AFTER_COMMANDS;
    const changed = context.eventTypes.CHAT_CHANGED;
    if (before) {
      context.eventSource.on(before, refresh);
      this.#disposers.push(() => context.eventSource.removeListener(before, refresh));
    }
    if (changed) {
      context.eventSource.on(changed, clear);
      this.#disposers.push(() => context.eventSource.removeListener(changed, clear));
    }
    this.#disposers.push(clear);
  }

  async readOptionalRuntimeState() {
    const snapshots = [];
    if (typeof globalThis.getVariables === 'function') {
      try { snapshots.push({ source: 'tavern-helper', value: globalThis.getVariables({ type: 'chat' }) }); } catch {}
    }
    if (globalThis.Mvu?.getMvuData) {
      try { snapshots.push({ source: 'mvu', value: globalThis.Mvu.getMvuData({ type: 'chat' }) }); } catch {}
    }
    return snapshots;
  }

  async writeOptionalRuntimeState(legacyVariables, settings) {
    if (settings.enableTavernHelperBridge && typeof globalThis.updateVariablesWith === 'function') {
      try { globalThis.updateVariablesWith((vars) => ({ ...vars, ...clone(legacyVariables) }), { type: 'chat' }); } catch (error) { console.warn(`[${EXTENSION_ID}] TH 同步失败`, error); }
    }
    if (settings.enableMvuBridge && globalThis.Mvu?.replaceMvuData && globalThis.Mvu?.getMvuData) {
      try {
        const current = globalThis.Mvu.getMvuData({ type: 'chat' }) || {};
        await globalThis.Mvu.replaceMvuData({ ...current, stat_data: clone(legacyVariables) }, { type: 'chat' });
      } catch (error) { console.warn(`[${EXTENSION_ID}] MVU 同步失败`, error); }
    }
  }

  destroy() {
    while (this.#disposers.length) {
      try { this.#disposers.pop()?.(); } catch {}
    }
  }
}
