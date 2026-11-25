import test from 'node:test';
import assert from 'node:assert/strict';
import { isFutureDate, localDateValue, minimumFutureDate } from '../src/utils/dateConstraints.js';

test('future-only calendar constraints reject today and past dates', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  assert.equal(isFutureDate(localDateValue()), false);
  assert.equal(isFutureDate(localDateValue(yesterday)), false);
  assert.equal(isFutureDate(minimumFutureDate()), true);
  assert.equal(isFutureDate('not-a-date'), false);
});
