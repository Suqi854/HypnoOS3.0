import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRole, createDefaultState, fromLegacyVariables, makeOperation, normalizeRolePack, toLegacyVariables } from '../src/contracts.js';
import { getRegionPack } from '../src/regions.js';

test('region defaults and legacy round trip preserve core state', () => {
  const region = getRegionPack('jp');
  const state = createDefaultState(region);
  const role = createDefaultRole('テスト');
  role.variables.core.favor = 42;
  state.roles[role.id] = role;
  state.resources.money = 1234;
  const next = fromLegacyVariables(toLegacyVariables(state), state, region);
  assert.equal(next.region, 'jp');
  assert.equal(next.resources.money, 1234);
  assert.equal(next.roles[role.id].variables.core.favor, 42);
});

test('contracts normalize custom namespace and operation metadata', () => {
  const role = normalizeRolePack({ name: '<A/B>', variables: { custom: { affinity: 'blue' } }, unknown: { keep: true } });
  assert.equal(role.name, 'A B');
  assert.equal(role.variables.custom.affinity, 'blue');
  assert.deepEqual(role.unknown, { keep: true });
  const operation = makeOperation({ sourceApp: 'work', command: '去打工', targetPaths: ['work'] });
  assert.equal(operation.schema, 'PendingOperation/v1');
  assert.equal(operation.reversible, true);
});
