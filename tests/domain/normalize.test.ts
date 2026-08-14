import { describe, expect, it } from 'vitest';

import {
  cleanCode,
  normalizeAccount,
  normalizeAsset,
  normalizeData,
  trimIcon,
} from '../../src/domain/normalize';

describe('domain normalization', () => {
  it('migrates a legacy symbol and applies asset defaults', () => {
    expect(
      normalizeAsset({
        id: 'x',
        name: ' Gold ',
        symbol: ' xau ',
        price: '2',
      }),
    ).toEqual({
      id: 'x',
      name: 'Gold',
      code: 'XAU',
      icon: 'XAU',
      color: '#5667ff',
      price: 2,
      autoUpdateSource: 'none',
    });
  });

  it('normalizes accounts, position comments, and snapshot asset symbols', () => {
    const data = normalizeData({
      accounts: [{ id: 'a', name: ' Cash ', type: 'Наличные' }],
      assets: [{ id: 'usd', name: 'Dollar', code: 'USD', price: 1 }],
      positions: [
        {
          id: 'p',
          accountId: 'a',
          assetId: 'usd',
          quantity: 1,
          comment: ' reserve ',
        },
      ],
      snapshots: [
        {
          id: 's',
          createdAt: 1,
          total: 1,
          assets: [{ assetId: 'usd', symbol: ' usd ' }],
        },
      ],
    });

    expect(data.accounts[0]).toMatchObject({
      name: 'Cash',
      icon: '$',
      color: '#17181b',
    });
    expect(data.positions[0]?.comment).toBe('reserve');
    expect(data.snapshots[0]?.assets?.[0]).toMatchObject({ code: 'USD' });
    expect(data.snapshots[0]?.assets?.[0]).not.toHaveProperty('symbol');
  });

  it('limits icons by Unicode code points and normalizes codes', () => {
    expect(trimIcon('  123456  ', '•')).toBe('12345');
    expect(trimIcon('', '◇')).toBe('◇');
    expect(cleanCode(' rub ')).toBe('RUB');
  });

  it('does not mutate legacy input objects', () => {
    const account = { id: 'a', name: ' Cash ', type: 'Наличные' };
    const normalized = normalizeAccount(account);

    expect(account.name).toBe(' Cash ');
    expect(normalized).not.toBe(account);
  });
});
