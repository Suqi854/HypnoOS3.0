import { AiGateway } from './ai-gateway.js';
import { normalizeProfile } from './contracts.js';
import { importRoleFile } from './role-import.js';
import { buildCompanionPreview, createCompanionWorldbook, deterministicAdapterDraft, scanWorldbooks } from './worldbook.js';
import { makeId } from './utils.js';

function el(tag, properties = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function field(label, input) { return el('label', {}, [el('span', { text: label }), input]); }

export class ControlPanel {
  constructor(root, { host, store, storage, close }) {
    this.root = root;
    this.host = host;
    this.store = store;
    this.storage = storage;
    this.close = close;
    this.gateway = new AiGateway(host, storage, () => store.settings);
    this.adapter = null;
    this.profile = null;
    this.preview = null;
    this.selectedBooks = [];
    this.render();
  }

  status(message, error = false) {
    this.statusNode.textContent = String(message || '');
    this.statusNode.classList.toggle('hypnoos3-danger', error);
  }

  render() {
    this.root.replaceChildren();
    const panel = el('div', { className: 'hypnoos3-control-panel', role: 'dialog', ariaModal: 'true', ariaLabel: '催眠手机设置' });
    const titleRow = el('div', { className: 'hypnoos3-control-actions' }, [el('h2', { text: '催眠手机设置' })]);
    const close = el('button', { type: 'button', text: '关闭' });
    close.addEventListener('click', this.close);
    titleRow.append(close);
    panel.append(titleRow);
    panel.append(this.#regionSection(), this.#roleSection(), this.#apiSection(), this.#worldbookSection(), this.#queueSection());
    this.statusNode = el('p', { className: 'hypnoos3-status', role: 'status', ariaLive: 'polite' });
    panel.append(this.statusNode);
    this.root.append(panel);
  }

  #regionSection() {
    const select = el('select');
    for (const [value, label] of [['cn', '中国通用版'], ['jp', '日本通用版'], ['custom', '完全自定义']]) select.append(el('option', { value, text: label }));
    select.value = this.store.state.region;
    select.addEventListener('change', async () => {
      try { await this.store.setRegion(select.value); this.status('地区模板已切换；保留角色、暂存操作和自定义数据。'); this.render(); }
      catch (error) { this.status(error.message, true); }
    });
    return el('section', {}, [el('h3', { text: '通用配置' }), field('地区模板', select), el('p', { text: '模板提供可编辑的日期、节假日、课程表和地点初值，不预置固定人物或剧情。' })]);
  }

  #roleSection() {
    const list = el('ul', { className: 'hypnoos3-list' });
    for (const role of Object.values(this.store.state.roles)) {
      const remove = el('button', { type: 'button', text: '移除' });
      remove.addEventListener('click', async () => { await this.store.removeRole(role.id); this.render(); });
      list.append(el('li', {}, [el('strong', { text: role.name }), el('div', { text: role.summary || '未填写简介' }), remove]));
    }
    if (!list.children.length) list.append(el('li', { text: '尚未导入角色。' }));
    const input = el('input', { type: 'file', accept: '.png,.json,.charx,.zip,application/json,image/png,application/zip' });
    input.addEventListener('change', async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        const role = await importRoleFile(file);
        if (role.pendingAvatar) {
          const assetId = makeId('avatar');
          await this.storage.set('assets', assetId, role.pendingAvatar);
          role.avatarAssetId = assetId;
          delete role.pendingAvatar;
        }
        await this.store.addRole(role);
        this.status(`已安全导入角色：${role.name}`);
        this.render();
      } catch (error) { this.status(error.message, true); }
    });
    return el('section', {}, [el('h3', { text: '角色与头像' }), list, field('导入 PNG / JSON / CharX / 原生 ZIP', input)]);
  }

  #apiSection() {
    const settings = this.store.settings;
    const endpoint = el('input', { type: 'url', value: settings.directApi.endpoint || '', placeholder: 'https://example.com/v1/chat/completions' });
    const model = el('input', { value: settings.directApi.model || '', placeholder: '模型名' });
    const secret = el('input', { type: 'password', value: this.storage.getDirectApiSecret(Boolean(settings.directApi.persistSecret)), autocomplete: 'off', placeholder: '仅当前会话保存' });
    const persist = el('input', { type: 'checkbox', checked: Boolean(settings.directApi.persistSecret) });
    const save = el('button', { type: 'button', text: '保存 API 设置' });
    save.addEventListener('click', async () => {
      await this.store.saveSettings({ directApi: { endpoint: endpoint.value.trim(), model: model.value.trim(), persistSecret: persist.checked } });
      this.storage.setDirectApiSecret(secret.value, persist.checked);
      this.status(persist.checked ? 'API 设置已保存；密钥仅存浏览器本地且不会导出。' : 'API 设置已保存；密钥仅保留当前会话。');
    });
    return el('section', {}, [el('h3', { text: 'AI 通道' }), el('p', { text: 'Endpoint 留空时复用酒馆当前模型。模型结果只生成待确认草案。' }), field('OpenAI 兼容 Endpoint', endpoint), field('模型', model), field('API 密钥', secret), field('明确允许本地保存密钥', persist), save]);
  }

  #worldbookSection() {
    const names = this.host.getWorldbookNames();
    const select = el('select', { multiple: true, size: Math.min(7, Math.max(3, names.length)) });
    for (const name of names) select.append(el('option', { value: name, text: name }));
    const scan = el('button', { type: 'button', text: '只读扫描并生成草案' });
    const ai = el('button', { type: 'button', text: 'AI 辅助整理草案', disabled: true });
    const create = el('button', { type: 'button', text: '确认创建/更新伴生世界书', disabled: true });
    const result = el('pre', { text: '尚未扫描。' });
    scan.addEventListener('click', async () => {
      try {
        this.selectedBooks = [...select.selectedOptions].map((option) => option.value);
        if (!this.selectedBooks.length) throw new Error('请至少选择一本世界书');
        const books = await scanWorldbooks(this.host, this.selectedBooks);
        this.adapter = deterministicAdapterDraft(books, this.store.state);
        this.profile = normalizeProfile({ name: this.host.characterKey(), region: this.store.state.region, roleIds: Object.keys(this.store.state.roles), adapterId: this.adapter.id });
        const targetName = `HypnoOS-${this.profile.name}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
        const existing = this.host.getWorldbookNames().includes(targetName) ? await this.host.loadWorldbook(targetName) : null;
        this.preview = await buildCompanionPreview({ profile: this.profile, state: this.store.state, adapter: this.adapter, existing });
        result.textContent = JSON.stringify({ sourceBooks: this.adapter.sourceBooks, confidence: this.adapter.confidence, mappings: Object.fromEntries(Object.entries(this.adapter.mappings).map(([key, value]) => [key, value.length])), companion: { name: targetName, entries: this.preview.entryCount, conflicts: this.preview.conflicts, hash: this.preview.generatedHash } }, null, 2);
        ai.disabled = false;
        create.disabled = this.preview.conflicts.length > 0;
        this.status(this.preview.conflicts.length ? '检测到三方差异冲突，请保留现有世界书并人工处理。' : '扫描完成。原世界书保持零修改，请检查预览后再确认。', this.preview.conflicts.length > 0);
      } catch (error) { this.status(error.message, true); }
    });
    ai.addEventListener('click', async () => {
      try {
        const schema = { type: 'object', required: ['roles', 'locations', 'rules', 'variableHints', 'confidence'], properties: { roles: { type: 'array', items: { type: 'string' } }, locations: { type: 'array', items: { type: 'string' } }, rules: { type: 'array', items: { type: 'string' } }, variableHints: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number', minimum: 0, maximum: 1 } }, additionalProperties: false };
        const draft = await this.gateway.generateObject({ purpose: '整理世界书适配映射', input: this.adapter, schema });
        this.adapter.aiDraft = draft;
        this.adapter.confidence = Number(draft.confidence || this.adapter.confidence);
        await this.storage.set('adapters', this.adapter.id, this.adapter);
        result.textContent += `\n\nAI 草案（尚未写入）：\n${JSON.stringify(draft, null, 2)}`;
        this.status('AI 草案已生成，仍需人工检查后确认。');
      } catch (error) { this.status(error.message, true); }
    });
    create.addEventListener('click', async () => {
      try {
        if (!this.preview || !this.profile) throw new Error('请先生成预览');
        const saved = await createCompanionWorldbook(this.host, { profile: this.profile, state: this.store.state, adapter: this.adapter, preview: this.preview });
        await this.storage.set('adapters', this.adapter.id, this.adapter);
        await this.storage.set('global', this.profile.id, this.profile);
        this.status(`伴生世界书已写入：${saved.name}。来源世界书未修改。`);
      } catch (error) { this.status(error.message, true); }
    });
    return el('section', {}, [el('h3', { text: '世界书适配向导' }), field('选择来源世界书（可多选）', select), el('div', { className: 'hypnoos3-control-actions' }, [scan, ai, create]), result]);
  }

  #queueSection() {
    const list = el('ul', { className: 'hypnoos3-list' });
    for (const item of this.store.state.operationQueue) {
      const edit = el('button', { type: 'button', text: '编辑' });
      const up = el('button', { type: 'button', text: '上移' });
      const down = el('button', { type: 'button', text: '下移' });
      const remove = el('button', { type: 'button', text: '删除', disabled: item.locked });
      edit.addEventListener('click', async () => { const value = prompt('编辑暂存指令', item.command); if (value != null) { await this.store.editOperation(item.id, { command: value }); this.render(); } });
      up.addEventListener('click', async () => { await this.store.moveOperation(item.id, -1); this.render(); });
      down.addEventListener('click', async () => { await this.store.moveOperation(item.id, 1); this.render(); });
      remove.addEventListener('click', async () => { await this.store.removeOperation(item.id); this.render(); });
      list.append(el('li', {}, [el('div', { text: `[${item.sourceApp}] ${item.command}` }), el('div', { className: 'hypnoos3-control-actions' }, [edit, up, down, remove])]));
    }
    if (!list.children.length) list.append(el('li', { text: '暂存队列为空。' }));
    const add = el('textarea', { rows: 3, placeholder: '每行一条指令' });
    const addButton = el('button', { type: 'button', text: '批量加入暂存' });
    const clear = el('button', { type: 'button', text: '清空未锁定项' });
    const submit = el('button', { type: 'button', text: '原子提交到酒馆输入框' });
    addButton.addEventListener('click', async () => { for (const command of add.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) await this.store.queueOperation({ sourceApp: 'manual', command }); this.render(); });
    clear.addEventListener('click', async () => { await this.store.clearOperations(); this.render(); });
    submit.addEventListener('click', async () => {
      const block = this.store.buildOperationBlock();
      if (!block) return this.status('没有可提交的操作。', true);
      if (!this.host.setInput(block, { append: true })) return this.status('未找到酒馆输入框；队列保持不变。', true);
      await this.store.clearOperations({ force: true });
      this.status('全部操作已一次性写入酒馆输入框；尚未自动发送。');
      this.render();
    });
    return el('section', {}, [el('h3', { text: '本轮输入暂存' }), list, field('批量指令', add), el('div', { className: 'hypnoos3-control-actions' }, [addButton, clear, submit])]);
  }
}
