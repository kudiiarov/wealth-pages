import { describe, expect, it } from 'vitest';

import type { PortfolioData } from '../../src/domain/models';
import { buildSnapshot } from '../../src/domain/snapshots';

const data: PortfolioData = {
  accounts: [
    {
      id: 'a1',
      name: 'Cash',
      type: 'cash',
      icon: '$',
      color: '#17181b',
    },
  ],
  assets: [
    {
      id: 'usd',
      name: 'Dollar',
      code: 'USD',
      icon: '$',
      color: '#5667ff',
      price: 1,
      autoUpdateSource: 'none',
    },
  ],
  positions: [
    {
      id: 'p1',
      accountId: 'a1',
      assetId: 'usd',
      quantity: 2,
      comment: 'reserve',
    },
  ],
  snapshots: [],
};

describe('snapshot construction', () => {
  it('copies stable position identity and current valuation', () => {
    const snapshot = buildSnapshot(data, 's1', 123);

    expect(snapshot).toMatchObject({ id: 's1', createdAt: 123, total: 2 });
    expect(snapshot.positions?.[0]).toEqual({
      positionId: 'p1',
      accountId: 'a1',
      accountName: 'Cash',
      assetId: 'usd',
      assetCode: 'USD',
      assetName: 'Dollar',
      comment: 'reserve',
      quantity: 2,
      price: 1,
      value: 2,
    });
    expect(snapshot.accounts).toEqual([
      { accountId: 'a1', name: 'Cash', total: 2 },
    ]);
    expect(snapshot.assets?.[0]).toMatchObject({
      assetId: 'usd',
      code: 'USD',
      quantity: 2,
      value: 2,
    });
  });

  it('does not retain references to mutable source entities', () => {
    const snapshot = buildSnapshot(data, 's1', 123);
    data.positions[0]!.quantity = 9;

    expect(snapshot.positions?.[0]?.quantity).toBe(2);
  });
});
