import { expect, it } from 'vitest';

import { buildPositionGroups } from '../../src/ui/position-groups';
import type { PortfolioData } from '../../src/domain/models';

const data: PortfolioData = {
  accounts: [
    { id: 'a', name: 'Alpha', type: 'bank', icon: 'A', color: '#111111' },
    { id: 'b', name: 'Beta', type: 'bank', icon: 'B', color: '#222222' },
  ],
  assets: [
    {
      id: 'x',
      name: 'X',
      code: 'X',
      icon: 'X',
      color: '#333333',
      price: 10,
      autoUpdateSource: 'none',
    },
    {
      id: 'y',
      name: 'Y',
      code: 'Y',
      icon: 'Y',
      color: '#444444',
      price: 2,
      autoUpdateSource: 'none',
    },
  ],
  positions: [
    { id: '1', accountId: 'a', assetId: 'x', quantity: 2, comment: '' },
    { id: '2', accountId: 'a', assetId: 'y', quantity: -20, comment: '' },
    { id: '3', accountId: 'b', assetId: 'x', quantity: 1, comment: '' },
  ],
  snapshots: [],
};

it('groups and orders positions by accounts or assets', () => {
  expect(
    buildPositionGroups(data, 'accounts').map((group) => [
      group.id,
      group.total,
      group.positions.map(({ id }) => id),
    ]),
  ).toEqual([
    ['account:a', -20, ['2', '1']],
    ['account:b', 10, ['3']],
  ]);
  expect(
    buildPositionGroups(data, 'assets').map((group) => [
      group.id,
      group.total,
      group.positions.map(({ id }) => id),
    ]),
  ).toEqual([
    ['asset:y', -40, ['2']],
    ['asset:x', 30, ['1', '3']],
  ]);
});
