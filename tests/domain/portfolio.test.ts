import { describe, expect, it } from 'vitest';

import type { Asset, PortfolioData, Position } from '../../src/domain/models';
import {
  accountTotal,
  assetQuantity,
  assetTotal,
  portfolioTotal,
  positionValue,
  rubEquivalent,
} from '../../src/domain/portfolio';

const assets: Asset[] = [
  {
    id: 'asset',
    name: 'Asset',
    code: 'AST',
    icon: 'A',
    color: '#5667ff',
    price: 10,
    autoUpdateSource: 'none',
  },
  {
    id: 'rub',
    name: 'Ruble',
    code: 'RUB',
    icon: '₽',
    color: '#17181b',
    price: 0.01,
    autoUpdateSource: 'none',
  },
];

const positions: Position[] = [
  { id: 'p1', accountId: 'a', assetId: 'asset', quantity: 3, comment: '' },
  { id: 'p2', accountId: 'a', assetId: 'asset', quantity: 2, comment: '' },
  { id: 'p3', accountId: 'b', assetId: 'asset', quantity: -1, comment: '' },
];

const data: PortfolioData = {
  accounts: [],
  assets,
  positions,
  snapshots: [],
  priceHistory: [],
};

describe('portfolio calculations', () => {
  it('sums duplicate positions and retains negative liabilities', () => {
    expect(portfolioTotal(data)).toBe(40);
    expect(assetQuantity('asset', positions)).toBe(4);
    expect(assetTotal('asset', data)).toBe(40);
    expect(accountTotal('a', data)).toBe(50);
    expect(accountTotal('b', data)).toBe(-10);
  });

  it('treats invalid stored numeric values as zero for legacy compatibility', () => {
    const invalid = { ...positions[0]!, quantity: Number.NaN };
    expect(positionValue(invalid, assets)).toBe(0);
  });

  it('converts USD totals to a RUB equivalent using USD per RUB', () => {
    expect(rubEquivalent(100, assets)).toBe(10_000);
    expect(
      rubEquivalent(
        100,
        assets.filter(({ code }) => code !== 'RUB'),
      ),
    ).toBe(0);
  });
});
