import { expect, it } from 'vitest';

import { allocationRows } from '../../src/ui/portfolio-view-model';
import type { PortfolioData } from '../../src/domain/models';

it('orders allocation by absolute value without truncating the bar data', () => {
  const data: PortfolioData = {
    accounts: [
      { id: 'a', name: 'A', type: 'cash', icon: '$', color: '#111111' },
    ],
    assets: [
      {
        id: 'x',
        name: 'X',
        code: 'X',
        icon: 'X',
        color: '#111111',
        price: 10,
        autoUpdateSource: 'none',
      },
      {
        id: 'y',
        name: 'Y',
        code: 'Y',
        icon: 'Y',
        color: '#222222',
        price: 5,
        autoUpdateSource: 'none',
      },
      {
        id: 'z',
        name: 'Z',
        code: 'Z',
        icon: 'Z',
        color: '#333333',
        price: 1,
        autoUpdateSource: 'none',
      },
      {
        id: 'w',
        name: 'W',
        code: 'W',
        icon: 'W',
        color: '#444444',
        price: 2,
        autoUpdateSource: 'none',
      },
    ],
    positions: [
      { id: '1', accountId: 'a', assetId: 'x', quantity: -10, comment: '' },
      { id: '2', accountId: 'a', assetId: 'y', quantity: 10, comment: '' },
      { id: '3', accountId: 'a', assetId: 'z', quantity: 20, comment: '' },
      { id: '4', accountId: 'a', assetId: 'w', quantity: 5, comment: '' },
    ],
    snapshots: [],
  };

  expect(
    allocationRows(data).map(({ asset, value }) => [asset.id, value]),
  ).toEqual([
    ['x', -100],
    ['y', 50],
    ['z', 20],
    ['w', 10],
  ]);
});
