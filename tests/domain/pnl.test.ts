import { describe, expect, it } from 'vitest';

import {
  flowAdjustedPnl,
  selectPnlSeries,
  type PnlPoint,
} from '../../src/domain/pnl';

function point(createdAt: number, quantity: number, price: number): PnlPoint {
  return {
    createdAt,
    assets: [{ assetId: 'asset', price }],
    positions: [
      {
        positionId: 'position',
        accountId: 'account',
        accountName: 'Cash',
        assetId: 'asset',
        assetCode: 'AST',
        comment: '',
        quantity,
        price,
        value: quantity * price,
      },
    ],
  };
}

const includeAll = (): boolean => true;

describe('flow-adjusted P&L', () => {
  it('treats quantity increases as flows valued at the later price', () => {
    const result = flowAdjustedPnl(
      [point(1, 1, 10), point(2, 2, 12)],
      includeAll,
    );

    expect(result).toMatchObject({
      pnl: 2,
      baseCapital: 10,
      positiveFlows: 12,
      baselineAt: 1,
    });
    expect(result?.pct).toBeCloseTo((100 * 2) / 22);
  });

  it('chains intervals and excludes filtered positions', () => {
    const second = point(2, 2, 12);
    second.positions.push({
      ...second.positions[0]!,
      positionId: 'ignored',
      quantity: 100,
      value: 1200,
    });
    const third = point(3, 2, 15);

    const result = flowAdjustedPnl(
      [point(1, 1, 10), second, third],
      ({ positionId }) => positionId === 'position',
    );

    expect(result?.pnl).toBe(8);
  });

  it('selects first or last compatible snapshot as the baseline', () => {
    const snapshots = [point(1, 1, 10), point(2, 1, 12)];
    const current = point(3, 1, 15);

    expect(
      selectPnlSeries(snapshots, current, 'all').map((x) => x.createdAt),
    ).toEqual([1, 2, 3]);
    expect(
      selectPnlSeries(snapshots, current, 'last').map((x) => x.createdAt),
    ).toEqual([2, 3]);
  });

  it('returns null without a comparable interval', () => {
    expect(flowAdjustedPnl([point(1, 1, 10)], includeAll)).toBeNull();
  });
});
