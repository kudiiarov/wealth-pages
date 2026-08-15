import type { PnlPeriod, PriceHistoryPoint, SnapshotPosition } from './models';
import { localDayKey } from './daily-history';

export type OverviewPnlPeriod = '24h' | 'all';

export interface PnlPointAsset {
  assetId: string;
  price: number;
}

export interface PnlPoint {
  createdAt: number;
  positions: SnapshotPosition[];
  assets: PnlPointAsset[];
}

export interface PnlResult {
  pnl: number;
  pct: number | null;
  baseCapital: number;
  positiveFlows: number;
  baselineAt: number;
}

const finitePositive = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

function quotePriceForPoint(
  point: PnlPoint,
  quoteAssetId: string,
  priceHistory: readonly PriceHistoryPoint[],
): number | undefined {
  const inPoint = finitePositive(
    point.assets.find((asset) => asset.assetId === quoteAssetId)?.price,
  );
  if (inPoint !== undefined) return inPoint;
  const dayKey = localDayKey(point.createdAt);
  const matching = priceHistory
    .filter(
      (history) =>
        history.assetId === quoteAssetId &&
        (history.dayKey === dayKey ||
          localDayKey(history.createdAt) === dayKey),
    )
    .map((history) => finitePositive(history.usdPrice))
    .filter((price): price is number => price !== undefined);
  return matching.at(-1);
}

export function normalizePnlPointInQuote(
  point: PnlPoint,
  quoteAssetId: string | undefined,
  priceHistory: readonly PriceHistoryPoint[],
): PnlPoint | null {
  if (!quoteAssetId)
    return {
      ...point,
      positions: point.positions.map((position) => ({ ...position })),
      assets: point.assets.map((asset) => ({ ...asset })),
    };

  const quotePrice = quotePriceForPoint(point, quoteAssetId, priceHistory);
  const hasNonQuotePosition = point.positions.some(
    (position) => position.assetId !== quoteAssetId,
  );
  if (hasNonQuotePosition && quotePrice === undefined) return null;
  const divisor = quotePrice ?? 1;
  const assets = point.assets.map((asset) => ({
    ...asset,
    price:
      asset.assetId === quoteAssetId
        ? 1
        : (finitePositive(asset.price) ?? 0) / divisor,
  }));
  if (!assets.some((asset) => asset.assetId === quoteAssetId)) {
    assets.push({ assetId: quoteAssetId, price: 1 });
  }
  const positions = point.positions.map((position) => {
    const sourcePrice =
      finitePositive(
        point.assets.find((asset) => asset.assetId === position.assetId)?.price,
      ) ??
      finitePositive(position.price) ??
      0;
    const price = position.assetId === quoteAssetId ? 1 : sourcePrice / divisor;
    return { ...position, price, value: Number(position.quantity) * price };
  });
  return { ...point, positions, assets };
}

export function normalizePnlSeriesInQuote(
  points: readonly PnlPoint[],
  quoteAssetId: string | undefined,
  priceHistory: readonly PriceHistoryPoint[],
): PnlPoint[] {
  return points.flatMap((point) => {
    const normalized = normalizePnlPointInQuote(
      point,
      quoteAssetId,
      priceHistory,
    );
    return normalized ? [normalized] : [];
  });
}

export function pnlPointTotal(point: PnlPoint): number {
  return point.positions.reduce(
    (total, position) => total + numeric(position.value),
    0,
  );
}

interface IntervalResult {
  pnl: number;
  flow: number;
}

const numeric = (value: unknown): number => Number(value) || 0;

function positionMap(point: PnlPoint): Map<string, SnapshotPosition> {
  return new Map(
    point.positions.map((position) => [position.positionId, position]),
  );
}

function assetPrice(point: PnlPoint, assetId: string, fallback = 0): number {
  return (
    numeric(point.assets.find((asset) => asset.assetId === assetId)?.price) ||
    numeric(fallback)
  );
}

function intervalResult(
  previous: PnlPoint,
  next: PnlPoint,
  positionId: string,
): IntervalResult | null {
  const before = positionMap(previous).get(positionId);
  const after = positionMap(next).get(positionId);
  if (!before && !after) return null;

  const assetId = after?.assetId ?? before?.assetId ?? '';
  const initialQuantity = numeric(before?.quantity);
  const nextQuantity = numeric(after?.quantity);
  const initialPrice = numeric(before?.price) || assetPrice(previous, assetId);
  const nextPrice =
    numeric(after?.price) || assetPrice(next, assetId, initialPrice);
  const startValue = initialQuantity * initialPrice;
  const endValue = nextQuantity * nextPrice;
  const flow = (nextQuantity - initialQuantity) * nextPrice;

  return { pnl: endValue - startValue - flow, flow };
}

export function flowAdjustedPnl(
  points: readonly PnlPoint[],
  include: (position: SnapshotPosition) => boolean,
): PnlResult | null {
  const first = points[0];
  if (!first || points.length < 2) return null;

  let pnl = 0;
  let positiveFlows = 0;
  let baseCapital = 0;
  let hasComparablePosition = false;

  for (const position of first.positions) {
    if (include(position)) {
      baseCapital += Math.abs(
        numeric(position.quantity) * numeric(position.price),
      );
    }
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (!previous || !next) continue;

    const previousPositions = positionMap(previous);
    const nextPositions = positionMap(next);
    const positionIds = new Set([
      ...previousPositions.keys(),
      ...nextPositions.keys(),
    ]);

    for (const positionId of positionIds) {
      const probe =
        nextPositions.get(positionId) ?? previousPositions.get(positionId);
      if (!probe || !include(probe)) continue;
      const result = intervalResult(previous, next, positionId);
      if (!result) continue;

      hasComparablePosition = true;
      pnl += result.pnl;
      if (result.flow > 0) positiveFlows += result.flow;
    }
  }

  if (!hasComparablePosition && baseCapital === 0) return null;
  const denominator = baseCapital + positiveFlows;

  return {
    pnl,
    pct: denominator > 0 ? (pnl / denominator) * 100 : null,
    baseCapital,
    positiveFlows,
    baselineAt: first.createdAt,
  };
}

export function selectPnlSeries(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  period: PnlPeriod,
): PnlPoint[] {
  if (snapshots.length === 0) return [];
  return period === 'last'
    ? [snapshots.at(-1)!, current]
    : [...snapshots, current];
}

export function selectPnlSeriesSince(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  periodStart?: number,
): PnlPoint[] {
  if (snapshots.length === 0) return [];
  if (periodStart === undefined) return [...snapshots, current];
  let baselineIndex = 0;
  for (let index = 0; index < snapshots.length; index += 1) {
    if (snapshots[index]!.createdAt <= periodStart) baselineIndex = index;
    else break;
  }
  return [...snapshots.slice(baselineIndex), current];
}

export function selectOverviewPnlSeries(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  period: OverviewPnlPeriod,
  now: number,
  currentDayKey: string,
): PnlPoint[] {
  if (snapshots.length === 0) return [];
  const sorted = [...snapshots].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
  if (period === 'all') return [...sorted, current];

  const cutoff = now - 86_400_000;
  let baseline: PnlPoint | undefined;
  for (const snapshot of sorted) {
    if (
      snapshot.createdAt <= cutoff &&
      localDayKey(snapshot.createdAt) !== currentDayKey
    ) {
      baseline = snapshot;
    }
  }
  if (!baseline) return [];
  const baselineCreatedAt = baseline.createdAt;
  return [
    baseline,
    ...sorted.filter(
      (snapshot) =>
        snapshot.createdAt > baselineCreatedAt &&
        localDayKey(snapshot.createdAt) !== currentDayKey,
    ),
    current,
  ];
}
