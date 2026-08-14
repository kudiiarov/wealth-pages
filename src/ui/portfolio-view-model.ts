import type { Asset, PortfolioData } from '../domain/models';
import { assetQuantity, assetTotal } from '../domain/portfolio';

export interface AllocationRow {
  asset: Asset;
  quantity: number;
  value: number;
}

export function allocationRows(data: PortfolioData): AllocationRow[] {
  return data.assets
    .map((asset) => ({
      asset,
      quantity: assetQuantity(asset.id, data.positions),
      value: assetTotal(asset.id, data),
    }))
    .filter(({ value }) => value !== 0)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}
