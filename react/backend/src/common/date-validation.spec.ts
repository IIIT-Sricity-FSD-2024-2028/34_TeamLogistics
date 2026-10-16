import { BadRequestException } from '@nestjs/common';
import { assertFutureDateOnly, localDateValue } from './date-validation';

function shiftedDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

describe('future date validation', () => {
  it('accepts a real future calendar date', () => {
    expect(() => assertFutureDateOnly(shiftedDate(1), 'Scheduled date')).not.toThrow();
  });

  it('rejects today and past calendar dates', () => {
    expect(() => assertFutureDateOnly(shiftedDate(0), 'Scheduled date')).toThrow(BadRequestException);
    expect(() => assertFutureDateOnly(shiftedDate(-1), 'Scheduled date')).toThrow('must be a future date');
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => assertFutureDateOnly('tomorrow', 'Scheduled date')).toThrow('YYYY-MM-DD');
    expect(() => assertFutureDateOnly('2099-02-31', 'Scheduled date')).toThrow('not a valid date');
  });
});
