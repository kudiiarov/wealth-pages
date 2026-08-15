import { describe, expect, it } from 'vitest';

import {
  compactDailyHistory,
  dailyPriceHistoryId,
  dailySnapshotId,
  localDayKey,
  upsertDailyPricePoint,
  upsertDailySnapshot,
} from '../../src/domain/daily-history';
import type { PortfolioData, PriceHistoryPoint } from '../../src/domain/models';

const timestamp = (day: number, hour: number): number =>
  new Date(2026, 7, day, hour).getTime();

const emptyData = (): PortfolioData => ({
  accounts: [],
  assets: [],
  positions: [],
  snapshots: [],
  priceHistory: [],
});

describe('daily history', () => {
  it('uses local calendar components instead of the UTC date', () => {
    expect(localDayKey(new Date(2026, 7, 15, 0, 5).getTime())).toBe(
      '2026-08-15',
    );
  });

  it('builds canonical daily record ids', () => {
    expect(dailySnapshotId('2026-08-15')).toBe(
      'daily-snapshot:2026-08-15',
    );
    expect(dailyPriceHistoryId('btc', '2026-08-15')).toBe(
      'daily-price:btc:2026-08-15',
    );
  });

  it('replaces the same local day with the newest snapshot', () => {
    const result = upsertDailySnapshot(
      [{ id: 'old', createdAt: timestamp(15, 9), total: 10 }],
      { id: 'new', createdAt: timestamp(15, 18), total: 25 },
    );

    expect(result).toEqual([
      {
        id: 'daily-snapshot:2026-08-15',
        createdAt: timestamp(15, 18),
        total: 25,
      },
    ]);
  });

  it('keeps separate snapshots on different local days', () => {
    const result = upsertDailySnapshot(
      [{ id: 'first', createdAt: timestamp(15, 23), total: 10 }],
      { id: 'second', createdAt: timestamp(16, 0), total: 12 },
    );

    expect(result.map(({ id }) => id)).toEqual([
      'daily-snapshot:2026-08-15',
      'daily-snapshot:2026-08-16',
    ]);
  });

  it('keeps one newest price per asset and local day', () => {
    const oldPoint: PriceHistoryPoint = {
      id: 'old',
      assetId: 'btc',
      dayKey: 'legacy',
      createdAt: timestamp(15, 9),
      usdPrice: 45_000,
    };
    const result = upsertDailyPricePoint([oldPoint], {
      id: 'new',
      assetId: 'btc',
      dayKey: 'legacy',
      createdAt: timestamp(15, 18),
      usdPrice: 46_000,
    });

    expect(result).toEqual([
      {
        id: 'daily-price:btc:2026-08-15',
        assetId: 'btc',
        dayKey: '2026-08-15',
        createdAt: timestamp(15, 18),
        usdPrice: 46_000,
      },
    ]);
  });

  it('extracts legacy snapshot prices and keeps the latest observation', () => {
    const data = emptyData();
    data.snapshots = [
      {
        id: 'morning',
        createdAt: timestamp(15, 9),
        total: 10,
        assets: [{ assetId: 'btc', code: 'BTC', price: 45_000 }],
      },
      {
        id: 'evening',
        createdAt: timestamp(15, 18),
        total: 12,
        assets: [{ assetId: 'btc', code: 'BTC', price: 46_000 }],
      },
    ];

    expect(compactDailyHistory(data)).toMatchObject({
      snapshots: [
        {
          id: 'daily-snapshot:2026-08-15',
          createdAt: timestamp(15, 18),
          total: 12,
        },
      ],
      priceHistory: [
        {
          id: 'daily-price:btc:2026-08-15',
          assetId: 'btc',
          dayKey: '2026-08-15',
          createdAt: timestamp(15, 18),
          usdPrice: 46_000,
        },
      ],
    });
  });
});
