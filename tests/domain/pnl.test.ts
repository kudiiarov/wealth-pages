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
