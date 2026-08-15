import type { PortfolioData, PriceHistoryPoint, Snapshot } from './models';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

export function dailySnapshotId(dayKey: string): string {
  return `daily-snapshot:${dayKey}`;
}

export function dailyPriceHistoryId(assetId: string, dayKey: string): string {
  return `daily-price:${assetId}:${dayKey}`;
}

function compactSnapshots(snapshots: readonly Snapshot[]): Snapshot[] {
  const byDay = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    const dayKey = localDayKey(snapshot.createdAt);
    const current = byDay.get(dayKey);
    if (!current || snapshot.createdAt >= current.createdAt) {
      byDay.set(dayKey, { ...snapshot, id: dailySnapshotId(dayKey) });
    }
  }
  return [...byDay.values()].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

function compactPricePoints(
  points: readonly PriceHistoryPoint[],
): PriceHistoryPoint[] {
  const byAssetDay = new Map<string, PriceHistoryPoint>();
  for (const point of points) {
    if (
      !point.assetId ||
      !Number.isFinite(point.createdAt) ||
      !Number.isFinite(point.usdPrice) ||
      point.usdPrice < 0
    ) {
      continue;
    }
    const dayKey = localDayKey(point.createdAt);
    const key = `${point.assetId}\u0000${dayKey}`;
    const current = byAssetDay.get(key);
    if (!current || point.createdAt >= current.createdAt) {
      byAssetDay.set(key, {
        ...point,
        id: dailyPriceHistoryId(point.assetId, dayKey),
        dayKey,
      });
    }
  }
  return [...byAssetDay.values()].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

export function upsertDailySnapshot(
  snapshots: readonly Snapshot[],
  snapshot: Snapshot,
): Snapshot[] {
  return compactSnapshots([...snapshots, snapshot]);
}

export function upsertDailyPricePoint(
  points: readonly PriceHistoryPoint[],
  point: PriceHistoryPoint,
): PriceHistoryPoint[] {
  return compactPricePoints([...points, point]);
}

export function compactDailyHistory(
  data: PortfolioData,
  options: { extractSnapshotPrices?: boolean } = {
    extractSnapshotPrices: true,
  },
): PortfolioData {
  const legacyPricePoints = options.extractSnapshotPrices
    ? data.snapshots.flatMap((snapshot) =>
        (snapshot.assets ?? []).flatMap((asset): PriceHistoryPoint[] => {
          const usdPrice = Number(asset.price);
          if (!asset.assetId || !Number.isFinite(usdPrice) || usdPrice < 0) {
            return [];
          }
          const dayKey = localDayKey(snapshot.createdAt);
          return [
            {
              id: dailyPriceHistoryId(asset.assetId, dayKey),
              assetId: asset.assetId,
              dayKey,
              createdAt: snapshot.createdAt,
              usdPrice,
            },
          ];
        }),
      )
    : [];

  return {
    ...data,
    snapshots: compactSnapshots(data.snapshots),
    priceHistory: compactPricePoints([
      ...legacyPricePoints,
      ...data.priceHistory,
    ]),
  };
}
