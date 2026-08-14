import type { Asset, PortfolioData, Position } from './models';

const numeric = (value: unknown): number => Number(value) || 0;

function assetBy(assets: readonly Asset[], assetId: string): Asset | undefined {
  return assets.find(({ id }) => id === assetId);
}

export function positionValue(
  position: Position,
  assets: readonly Asset[],
): number {
  return (
    numeric(position.quantity) *
    numeric(assetBy(assets, position.assetId)?.price)
  );
}

export function portfolioTotal(data: PortfolioData): number {
  return data.positions.reduce(
    (total, position) => total + positionValue(position, data.assets),
    0,
  );
}

export function assetQuantity(
  assetId: string,
  positions: readonly Position[],
): number {
  return positions
    .filter((position) => position.assetId === assetId)
    .reduce((total, position) => total + numeric(position.quantity), 0);
}

export function assetTotal(assetId: string, data: PortfolioData): number {
  return data.positions
    .filter((position) => position.assetId === assetId)
    .reduce(
      (total, position) => total + positionValue(position, data.assets),
      0,
    );
}

export function accountTotal(accountId: string, data: PortfolioData): number {
  return data.positions
    .filter((position) => position.accountId === accountId)
    .reduce(
      (total, position) => total + positionValue(position, data.assets),
      0,
    );
}

export function rubEquivalent(
  totalUsd: number,
  assets: readonly Asset[],
): number {
  const rub = assets.find(({ code }) => cleanAssetCode(code) === 'RUB');
  const rubPrice = Number(rub?.price);
  return Number.isFinite(rubPrice) && rubPrice > 0
    ? numeric(totalUsd) / rubPrice
    : 0;
}

function cleanAssetCode(value: string): string {
  return value.trim().toUpperCase();
}
