import type { PnlPeriod, SnapshotPosition } from './models';

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
