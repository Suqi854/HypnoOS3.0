import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, normalizeProfile } from '../src/contracts.js';
import { getRegionPack } from '../src/regions.js';
import { buildCompanionPreview, createCompanionWorldbook, deterministicAdapterDraft, scanWorldbooks } from '../src/worldbook.js';

class FakeHost {
  books = new Map([['来源', { entries: { 0: { uid: 0, comment: '人物档案', key: ['小明'], content: '<script>bad()</script>学生' } } }]]);
  getWorldbookNames() { return [...this.books.keys()]; }
  async loadWorldbook(name) { return structuredClone(this.books.get(name)); }
  async saveWorldbook(name, book) { this.books.set(name, structuredClone(book)); }
}

test('source books remain unchanged and companion rerun is idempotent', async () => {
  const host = new FakeHost();
  const original = structuredClone(host.books.get('来源'));
  const books = await scanWorldbooks(host, ['来源']);
  assert.match(books[0].entries[0].content, /已隔离脚本/);
  const state = createDefaultState(getRegionPack('cn'));
  state.roles.r1 = { id: 'r1', name: '包内角色', summary: '', persona: '', variables: { custom: {} }, worldbookFragments: [{ id: 'f1', title: '包内设定', keys: ['设定'], content: '<script>ignore()</script>可用正文' }] };
  const adapter = deterministicAdapterDraft(books, state);
  const profile = normalizeProfile({ id: 'p1', name: '测试', region: 'cn', adapterId: adapter.id });
  const first = await buildCompanionPreview({ profile, state, adapter });
  assert.ok(first.entryCount >= 4);
  assert.match(first.book.entries[2].content, /已隔离脚本/);
  const saved = await createCompanionWorldbook(host, { profile, state, adapter, preview: first });
  assert.equal(saved.name, 'HypnoOS-测试');
  assert.deepEqual(host.books.get('来源'), original);
  const second = await buildCompanionPreview({ profile, state, adapter, existing: await host.loadWorldbook(saved.name) });
  assert.deepEqual(second.conflicts, []);
  await createCompanionWorldbook(host, { profile, state, adapter, preview: second });
  assert.deepEqual(host.books.get('来源'), original);
});

test('manual changes to a managed entry block overwrite', async () => {
  const host = new FakeHost();
  const state = createDefaultState(getRegionPack('cn'));
  const adapter = deterministicAdapterDraft(await scanWorldbooks(host, ['来源']), state);
  const profile = normalizeProfile({ id: 'p2', name: '冲突', region: 'cn' });
  const preview = await buildCompanionPreview({ profile, state, adapter });
  await createCompanionWorldbook(host, { profile, state, adapter, preview });
  host.books.get('HypnoOS-冲突').entries[0].content += '\n人工编辑';
  const next = await buildCompanionPreview({ profile, state, adapter, existing: await host.loadWorldbook('HypnoOS-冲突') });
  assert.equal(next.conflicts[0].type, 'managed-entry-modified');
});
