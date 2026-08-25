import test from 'node:test';
import assert from 'node:assert/strict';
import { HostAdapter } from '../src/host-adapter.js';

test('reads current character worldbook binding and latest message variables without writing', async () => {
  const context = {
    characterId: '0',
    characters: [{ avatar: 'qa.png', data: { extensions: { world: '主世界书' } } }],
    chatMetadata: { world_info: '聊天世界书' },
    extensionSettings: { world_info: { charLore: [{ name: 'qa', extraBooks: ['辅助世界书'] }] } },
    chat: [{ variables: { stat_data: { 系统: { MC能量: 42 }, 角色: { 甲: {} } } } }],
    loadWorldInfo: async (name) => ({ name, entries: {} }),
  };
  globalThis.SillyTavern = { getContext: () => context };
  const host = new HostAdapter();
  assert.deepEqual(await host.getCharacterWorldbookNames(), {
    primary: '主世界书',
    additional: ['辅助世界书', '聊天世界书'],
  });
  assert.equal((await host.loadWorldbook('主世界书')).name, '主世界书');
  assert.equal(host.readMvu({ type: 'message', message_id: 'latest' }).stat_data.系统.MC能量, 42);
  delete globalThis.SillyTavern;
});

test('converts an embedded character book read-only when no linked book exists', async () => {
  const embedded = { name: '卡内世界书', entries: [{ name: '地点', content: '车站' }] };
  globalThis.SillyTavern = { getContext: () => ({
    characterId: 0,
    characters: [{ name: '角色', avatar: 'role.png', data: { extensions: {}, character_book: embedded } }],
    chatMetadata: {},
    extensionSettings: {},
    convertCharacterBook: (value) => ({ converted: true, source: value }),
  }) };
  const host = new HostAdapter();
  const books = await host.getCharacterWorldbookNames();
  assert.match(books.primary, /^__hypnoos_embedded__:/);
  const book = await host.loadWorldbook(books.primary);
  assert.equal(book.converted, true);
  assert.deepEqual(book.source, embedded);
  delete globalThis.SillyTavern;
});

test('selects the active swipe variable snapshot from SillyTavern message storage', () => {
  globalThis.SillyTavern = { getContext: () => ({
    chat: [{
      swipe_id: 1,
      variables: [
        { stat_data: { 系统: { MC能量: 10 } } },
        { stat_data: { 系统: { MC能量: 77 } } },
      ],
    }],
  }) };
  const host = new HostAdapter();
  assert.equal(host.readVariables({ type: 'message', message_id: 'latest' }).stat_data.系统.MC能量, 77);
  delete globalThis.SillyTavern;
});
