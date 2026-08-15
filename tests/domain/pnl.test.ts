import { describe, expect, it } from 'vitest';

import {
  flowAdjustedPnl,
  normalizePnlPointInQuote,
  normalizePnlSeriesInQuote,
  pnlPointTotal,
  selectOverviewPnlSeries,
  selectPnlSeries,
  selectPnlSeriesSince,
  type PnlPoint,
} from '../../src/domain/pnl';
import type { PriceHistoryPoint } from '../../src/domain/models';
import { localDayKey } from '../../src/domain/daily-history';

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

function currencyPoint(
  createdAt: number,
  assetId: string,
  price: number,
  quantity = 50,
  quotePrice?: number,
): PnlPoint {
  return {
    createdAt,
    assets: [
      { assetId, price },
      ...(quotePrice === undefined
        ? []
        : [{ assetId: 'rub', price: quotePrice }]),
    ],
    positions: [
      {
        positionId: assetId,
        accountId: 'account',
        accountName: 'Cash',
        assetId,
        assetCode: assetId.toUpperCase(),
        comment: '',
        quantity,
        price,
        value: quantity * price,
      },
    ],
  };
}

function history(
  assetId: string,
  createdAt: number,
  usdPrice: number,
): PriceHistoryPoint {
  return {
    id: `${assetId}-${createdAt}`,
    assetId,
    dayKey: localDayKey(createdAt),
    createdAt,
    usdPrice,
  };
}

function mixedPoint(
  createdAt: number,
  xPrice: number,
  yPrice: number,
  quantities: { xA: number; xB?: number; yB: number },
): PnlPoint {
  const position = (
    positionId: string,
    accountId: string,
    assetId: string,
    quantity: number,
    price: number,
  ) => ({
    positionId,
    accountId,
    accountName: accountId === 'a' ? 'Account A' : 'Account B',
    assetId,
    assetCode: assetId.toUpperCase(),
    comment: '',
    quantity,
    price,
    value: quantity * price,
  });
  return {
    createdAt,
    assets: [
      { assetId: 'x', price: xPrice },
      { assetId: 'y', price: yPrice },
      { assetId: 'quote', price: 2 },
    ],
    positions: [
      position('x-a', 'a', 'x', quantities.xA, xPrice),
      ...(quantities.xB === undefined
        ? []
        : [position('x-b', 'b', 'x', quantities.xB, xPrice)]),
      position('y-b', 'b', 'y', quantities.yB, yPrice),
    ],
  };
}

describe('flow-adjusted P&L', () => {
  it('normalizes points into a quote using same-day cross-rates', () => {
    const oldAt = new Date(2026, 7, 14, 12).getTime();
    const currentAt = new Date(2026, 7, 15, 12).getTime();
    const old = currencyPoint(oldAt, 'eur', 1.1, 50, 1.1 / 96.4904);
    const current = currencyPoint(currentAt, 'eur', 1.089, 50, 1.089 / 96.8);

    const normalized = normalizePnlSeriesInQuote([old, current], 'rub', []);
    expect(normalized[0]!.positions[0]?.price).toBeCloseTo(96.4904);
    expect(normalized[0]!.positions[0]?.value).toBeCloseTo(4_824.52);
    expect(normalized[1]!.positions[0]).toMatchObject({
      price: 96.8,
      value: 4_840,
    });
    expect(flowAdjustedPnl(normalized, includeAll)?.pnl).toBeCloseTo(15.48);
    expect(normalizePnlPointInQuote(current, 'rub', [])?.assets).toEqual(
      expect.arrayContaining([{ assetId: 'rub', price: 1 }]),
    );
  });

  it('uses date-aligned history when a quote is absent and rejects other days', () => {
    const at = new Date(2026, 7, 14, 12).getTime();
    const pointWithoutRub = currencyPoint(at, 'eur', 1.1);
    expect(
      normalizePnlPointInQuote(pointWithoutRub, 'rub', [
        history('rub', at, 1.1 / 96.4904),
      ]),
    ).not.toBeNull();
    expect(
      normalizePnlPointInQuote(pointWithoutRub, 'rub', [
        history('rub', new Date(2026, 7, 15, 12).getTime(), 1.1 / 96.4904),
      ]),
    ).toBeNull();
  });

  it('keeps self-quoted positions at one and totals normalized values', () => {
    const pointInRub = currencyPoint(1, 'rub', 96.8, 50);
    const normalized = normalizePnlPointInQuote(pointInRub, 'rub', []);
    expect(normalized?.positions[0]).toMatchObject({ price: 1, value: 50 });
    expect(pnlPointTotal(normalized!)).toBe(50);
  });

  it('normalizes the undefined quote as canonical USD', () => {
    const usdPoint = currencyPoint(1, 'usd', 99, 2);
    const normalized = normalizePnlPointInQuote(usdPoint, undefined, []);
    expect(normalized?.positions[0]).toMatchObject({ price: 1, value: 2 });
    expect(normalized?.assets).toEqual(
      expect.arrayContaining([{ assetId: 'usd', price: 1 }]),
    );
  });

  it('rejects invalid held quantities and prices without rejecting negative quantities or explicit zero prices', () => {
    const invalidQuantity = point(1, Number.NaN, 10);
    const infiniteQuantity = point(1, Number.POSITIVE_INFINITY, 10);
    const negativePrice = point(1, 1, -10);
    const nonFinitePrice = point(1, 1, Number.NaN);
    const missingPrice = point(1, 1, 10);
    missingPrice.positions[0]!.price = undefined as unknown as number;
    missingPrice.assets = [];
    const implicitZeroPrice = point(1, 1, 0);
    implicitZeroPrice.assets = [];
    const explicitZeroPrice = point(1, 1, 0);
    const negativeQuantity = point(1, -2, 10);

    for (const incompatible of [
      invalidQuantity,
      infiniteQuantity,
      negativePrice,
      nonFinitePrice,
      missingPrice,
      implicitZeroPrice,
    ]) {
      expect(normalizePnlPointInQuote(incompatible, undefined, [])).toBeNull();
    }
    expect(
      normalizePnlPointInQuote(explicitZeroPrice, undefined, [])?.positions[0],
    ).toMatchObject({ price: 0, value: 0 });
    expect(
      normalizePnlPointInQuote(negativeQuantity, undefined, [])?.positions[0],
    ).toMatchObject({ quantity: -2, price: 10, value: -20 });
  });

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

  it('keeps every intermediate snapshot after the period baseline', () => {
    const snapshots = [point(1, 1, 100), point(2, 2, 200), point(3, 2, 250)];
    const current = point(4, 2, 300);

    const series = selectPnlSeriesSince(snapshots, current, 1.5);

    expect(series.map(({ createdAt }) => createdAt)).toEqual([1, 2, 3, 4]);
    expect(flowAdjustedPnl(series, includeAll)?.pnl).toBe(300);
  });

  it('keeps current as the final unique point across every period selector', () => {
    const now = new Date(2026, 7, 15, 21).getTime();
    const earlier = point(now - 2 * 86_400_000, 1, 10);
    const duplicateEarlier = point(earlier.createdAt, 1, 11);
    const latestEligible = point(now - 86_400_000, 1, 12);
    const sameTimestamp = point(now, 1, 99);
    const future = point(now + 1, 1, 100);
    const current = point(now, 1, 15);
    const snapshots = [
      future,
      latestEligible,
      earlier,
      sameTimestamp,
      duplicateEarlier,
    ];

    expect(
      selectPnlSeries(snapshots, current, 'all').map(
        ({ createdAt }) => createdAt,
      ),
    ).toEqual([earlier.createdAt, latestEligible.createdAt, current.createdAt]);
    expect(
      selectPnlSeries(snapshots, current, 'last').map(
        ({ createdAt }) => createdAt,
      ),
    ).toEqual([latestEligible.createdAt, current.createdAt]);
    expect(
      selectPnlSeriesSince(snapshots, current, now - 36 * 60 * 60 * 1_000).map(
        ({ createdAt }) => createdAt,
      ),
    ).toEqual([earlier.createdAt, latestEligible.createdAt, current.createdAt]);
    expect(
      selectOverviewPnlSeries(
        snapshots,
        current,
        '24h',
        now,
        localDayKey(now),
      ).map(({ createdAt }) => createdAt),
    ).toEqual([latestEligible.createdAt, current.createdAt]);
    expect(
      selectOverviewPnlSeries(
        snapshots,
        current,
        'all',
        now,
        localDayKey(now),
      ).map(({ createdAt }) => createdAt),
    ).toEqual([earlier.createdAt, latestEligible.createdAt, current.createdAt]);
  });

  it('normalizes mixed deposits, withdrawals, and transfers consistently across filters', () => {
    const normalized = normalizePnlSeriesInQuote(
      [
        mixedPoint(1, 10, 20, { xA: 10, yB: 5 }),
        mixedPoint(2, 12, 18, { xA: 15, yB: 5 }),
        mixedPoint(3, 15, 21, { xA: 10, xB: 5, yB: 5 }),
        mixedPoint(4, 14, 22, { xA: 10, xB: 2, yB: 5 }),
      ],
      'quote',
      [],
    );

    const portfolio = flowAdjustedPnl(normalized, includeAll);
    const assetX = flowAdjustedPnl(
      normalized,
      ({ assetId }) => assetId === 'x',
    );
    const assetY = flowAdjustedPnl(
      normalized,
      ({ assetId }) => assetId === 'y',
    );
    const accountA = flowAdjustedPnl(
      normalized,
      ({ accountId }) => accountId === 'a',
    );
    const accountB = flowAdjustedPnl(
      normalized,
      ({ accountId }) => accountId === 'b',
    );

    expect(portfolio).toMatchObject({
      pnl: 30,
      baseCapital: 100,
      positiveFlows: 30,
    });
    expect(portfolio?.pct).toBeCloseTo((30 / 130) * 100);
    expect(assetX?.pnl).toBeCloseTo(25);
    expect(assetX?.positiveFlows).toBeCloseTo(30);
    expect(assetY?.pnl).toBeCloseTo(5);
    expect(accountA?.pnl).toBeCloseTo(27.5);
    expect(accountB?.pnl).toBeCloseTo(2.5);
    expect((assetX?.pnl ?? 0) + (assetY?.pnl ?? 0)).toBeCloseTo(
      portfolio?.pnl ?? 0,
    );
    expect((accountA?.pnl ?? 0) + (accountB?.pnl ?? 0)).toBeCloseTo(
      portfolio?.pnl ?? 0,
    );
  });

  it('returns null without a comparable interval', () => {
    expect(flowAdjustedPnl([point(1, 1, 10)], includeAll)).toBeNull();
  });

  it('selects strict overview periods without using today as a 24h baseline', () => {
    const now = new Date(2026, 7, 15, 21).getTime();
    const current = point(now, 1, 15);
    const august13 = point(new Date(2026, 7, 13, 12).getTime(), 1, 10);
    const august14BeforeCutoff = point(
      new Date(2026, 7, 14, 20).getTime(),
      1,
      12,
    );
    const august14AfterCutoff = point(
      new Date(2026, 7, 14, 22).getTime(),
      1,
      13,
    );
    const august15 = point(new Date(2026, 7, 15, 8).getTime(), 1, 14);
    const points = [
      august13,
      august14BeforeCutoff,
      august14AfterCutoff,
      august15,
    ];

    expect(
      selectOverviewPnlSeries(
        points,
        current,
        '24h',
        now,
        localDayKey(now),
      ).map(({ createdAt }) => createdAt),
    ).toEqual([
      august14BeforeCutoff.createdAt,
      august14AfterCutoff.createdAt,
      august15.createdAt,
      current.createdAt,
    ]);
    expect(
      selectOverviewPnlSeries([current], current, '24h', now, localDayKey(now)),
    ).toEqual([]);
    expect(
      selectOverviewPnlSeries(
        points,
        current,
        'all',
        now,
        localDayKey(now),
      ).map(({ createdAt }) => createdAt),
    ).toEqual([
      august13.createdAt,
      august14BeforeCutoff.createdAt,
      august14AfterCutoff.createdAt,
      august15.createdAt,
      current.createdAt,
    ]);
  });
});
