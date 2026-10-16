import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAvailableMechanics } from '../src/pages/fleet-manager/mechanicOptions.js';

test('mechanic dropdown loads active backend records and preserves stable IDs and names', async () => {
  const calls = [];
  const mechanicsApi = {
    async getAll(active) {
      calls.push(active);
      return [
        { id: 'MC-001', name: 'Active Workshop', active: true },
        { id: 'MC-002', name: 'Inactive Workshop', active: false },
        { id: '', name: 'Invalid Workshop', active: true },
      ];
    },
  };

  const mechanics = await loadAvailableMechanics(mechanicsApi);

  assert.deepEqual(calls, [true]);
  assert.deepEqual(mechanics, [{ id: 'MC-001', name: 'Active Workshop', active: true }]);
});

test('mechanic dropdown loader propagates API failures for the page error state', async () => {
  const mechanicsApi = {
    async getAll() {
      throw new Error('API unavailable');
    },
  };

  await assert.rejects(loadAvailableMechanics(mechanicsApi), /API unavailable/);
});
