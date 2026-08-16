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

export interface PositionFlowChange {
  positionId: string;
  accountName: string;
  assetCode: string;
  quantityDelta: number;
  valueDelta: number;
}

export interface PositionFlowSummary {
  total: number;
  changes: PositionFlowChange[];
}

const finitePositive = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const finiteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
  const effectiveQuoteAssetId = quoteAssetId ?? 'usd';
  const quotePrice =
    effectiveQuoteAssetId === 'usd'
      ? 1
      : quotePriceForPoint(point, effectiveQuoteAssetId, priceHistory);
  const hasNonQuotePosition = point.positions.some(
    (position) => position.assetId !== effectiveQuoteAssetId,
  );
  if (hasNonQuotePosition && quotePrice === undefined) return null;
  const divisor = quotePrice ?? 1;
  const sourcePrices = new Map<string, number>();
  for (const position of point.positions) {
    const quantity = finiteNumber(position.quantity);
    const positionPrice = finiteNumber(position.price);
    const assetObservation = point.assets.find(
      (asset) => asset.assetId === position.assetId,
    );
    const observedPrice = finiteNumber(assetObservation?.price);
    if (
      quantity === undefined ||
      positionPrice === undefined ||
      positionPrice < 0 ||
      (assetObservation !== undefined &&
        (observedPrice === undefined || observedPrice < 0)) ||
      (positionPrice === 0 && observedPrice !== 0)
    ) {
      return null;
    }
    sourcePrices.set(position.positionId, observedPrice ?? positionPrice);
  }
  const assets = point.assets.map((asset) => ({
    ...asset,
    price:
      asset.assetId === effectiveQuoteAssetId
        ? 1
        : (finitePositive(asset.price) ?? 0) / divisor,
  }));
  if (!assets.some((asset) => asset.assetId === effectiveQuoteAssetId)) {
    assets.push({ assetId: effectiveQuoteAssetId, price: 1 });
  }
  const positions = point.positions.map((position) => {
    const sourcePrice = sourcePrices.get(position.positionId)!;
    const price =
      position.assetId === effectiveQuoteAssetId ? 1 : sourcePrice / divisor;
    return { ...position, price, value: position.quantity * price };
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

export function summarizePositionFlows(
  previous: PnlPoint,
  next: PnlPoint,
): PositionFlowSummary {
  const previousPositions = positionMap(previous);
  const nextPositions = positionMap(next);
  const positionIds = new Set([
    ...previousPositions.keys(),
    ...nextPositions.keys(),
  ]);
  const changes: PositionFlowChange[] = [];

  for (const positionId of positionIds) {
    const before = previousPositions.get(positionId);
    const after = nextPositions.get(positionId);
    const position = after ?? before;
    if (!position) continue;
    const quantityDelta = numeric(after?.quantity) - numeric(before?.quantity);
    if (quantityDelta === 0) continue;
    const price = numeric(after?.price) || assetPrice(next, position.assetId);
    changes.push({
      positionId,
      accountName: position.accountName,
      assetCode: position.assetCode,
      quantityDelta,
      valueDelta: quantityDelta * price,
    });
  }

  return {
    total: changes.reduce((total, change) => total + change.valueDelta, 0),
    changes,
  };
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
    let intervalFlow = 0;

    for (const positionId of positionIds) {
      const probe =
        nextPositions.get(positionId) ?? previousPositions.get(positionId);
      if (!probe || !include(probe)) continue;
      const result = intervalResult(previous, next, positionId);
      if (!result) continue;

      hasComparablePosition = true;
      pnl += result.pnl;
      intervalFlow += result.flow;
    }
    if (intervalFlow > 0) positiveFlows += intervalFlow;
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

function eligibleSnapshots(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
): PnlPoint[] {
  const byCreatedAt = new Map<number, PnlPoint>();
  for (const snapshot of snapshots) {
    if (
      Number.isFinite(snapshot.createdAt) &&
      snapshot.createdAt < current.createdAt
    ) {
      byCreatedAt.set(snapshot.createdAt, snapshot);
    }
  }
  return [...byCreatedAt.values()].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

export function selectPnlSeries(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  period: PnlPeriod,
): PnlPoint[] {
  const eligible = eligibleSnapshots(snapshots, current);
  if (eligible.length === 0) return [];
  return period === 'last'
    ? [eligible.at(-1)!, current]
    : [...eligible, current];
}

export function selectPnlSeriesSince(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  periodStart?: number,
): PnlPoint[] {
  const eligible = eligibleSnapshots(snapshots, current);
  if (eligible.length === 0) return [];
  if (periodStart === undefined) return [...eligible, current];
  let baselineIndex = 0;
  for (let index = 0; index < eligible.length; index += 1) {
    if (eligible[index]!.createdAt <= periodStart) baselineIndex = index;
    else break;
  }
  return [...eligible.slice(baselineIndex), current];
}

export function selectOverviewPnlSeries(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  period: OverviewPnlPeriod,
  now: number,
): PnlPoint[] {
  const sorted = eligibleSnapshots(snapshots, current);
  if (sorted.length === 0) return [];
  if (period === 'all') return [...sorted, current];

  const previousDate = new Date(now);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDayKey = localDayKey(previousDate.getTime());
  const baseline = sorted.findLast(
    (snapshot) => localDayKey(snapshot.createdAt) === previousDayKey,
  );
  if (!baseline) return [];
  const baselineCreatedAt = baseline.createdAt;
  return [
    baseline,
    ...sorted.filter((snapshot) => snapshot.createdAt > baselineCreatedAt),
    current,
  ];
}
