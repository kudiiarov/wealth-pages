import type {
  Account,
  Asset,
  AssetCategory,
  PortfolioData,
} from '../domain/models';
import { flowAdjustedPnl, type PnlPoint } from '../domain/pnl';
import { accountTotal, assetQuantity, assetTotal } from '../domain/portfolio';

export interface AllocationRow {
  asset: Asset;
  quantity: number;
  value: number;
}

export interface AccountOverviewRow {
  account: Account;
  value: number;
}

export interface AssetProfile {
  category: AssetCategory;
  tags: string[];
}

export interface CategoryAllocationRow {
  category: AssetCategory;
  value: number;
  percentage: number;
}

export interface ExposureRow {
  tag: string;
  value: number;
  percentage: number;
}

export interface PortfolioDriver {
  assetId: string;
  code: string;
  value: number;
}

export interface PriceFreshness {
  tracked: number;
  current: number;
  staleAssetIds: string[];
  latestUpdateAt?: number;
}

const fiatCodes = new Set(['USD', 'EUR', 'RUB', 'CNY', 'GBP', 'JPY', 'CHF']);
const stablecoinCodes = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);
const goldCodes = new Set(['XAUT', 'PAXG', 'XAU']);

export function inferAssetProfile(asset: Asset): AssetProfile {
  if (asset.category) {
    return {
      category: asset.category,
      tags: Array.from(new Set(asset.tags ?? [])),
    };
  }
  if (goldCodes.has(asset.code)) {
    return { category: 'precious-metals', tags: ['crypto', 'gold'] };
  }
  if (stablecoinCodes.has(asset.code)) {
    return {
      category: 'crypto',
      tags: ['crypto', 'currency', 'stablecoin'],
    };
  }
  if (asset.autoUpdateSource === 'coingecko') {
    return { category: 'crypto', tags: ['crypto'] };
  }
  if (asset.autoUpdateSource === 'frankfurter' || fiatCodes.has(asset.code)) {
    return { category: 'cash-currencies', tags: ['currency'] };
  }
  return { category: 'other', tags: asset.tags ?? [] };
}

export function accountOverviewRows(data: PortfolioData): AccountOverviewRow[] {
  return data.accounts
    .map((account) => ({ account, value: accountTotal(account.id, data) }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

export function assetOverviewRows(data: PortfolioData): AllocationRow[] {
  return data.assets
    .map((asset) => ({
      asset,
      quantity: assetQuantity(asset.id, data.positions),
      value: assetTotal(asset.id, data),
    }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
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

export function categoryAllocationRows(
  data: PortfolioData,
): CategoryAllocationRow[] {
  const totals = new Map<AssetCategory, number>();
  for (const { asset, value } of allocationRows(data)) {
    const category = inferAssetProfile(asset).category;
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(value));
  }
  const gross = Array.from(totals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  return Array.from(totals, ([category, value]) => ({
    category,
    value,
    percentage: gross ? (value / gross) * 100 : 0,
  })).sort((left, right) => right.value - left.value);
}

export function portfolioExposures(data: PortfolioData): ExposureRow[] {
  const gross = allocationRows(data).reduce(
    (sum, { value }) => sum + Math.abs(value),
    0,
  );
  const totals = new Map<string, number>();
  for (const { asset, value } of allocationRows(data)) {
    for (const tag of inferAssetProfile(asset).tags) {
      totals.set(tag, (totals.get(tag) ?? 0) + Math.abs(value));
    }
  }
  return Array.from(totals, ([tag, value]) => ({
    tag,
    value,
    percentage: gross ? (value / gross) * 100 : 0,
  })).sort((left, right) => right.value - left.value);
}

export function portfolioDrivers(
  data: PortfolioData,
  points: readonly PnlPoint[],
): PortfolioDriver[] {
  return assetOverviewRows(data)
    .flatMap(({ asset }) => {
      const result = flowAdjustedPnl(
        points,
        (position) => position.assetId === asset.id,
      );
      return result && result.pnl !== 0
        ? [{ assetId: asset.id, code: asset.code, value: result.pnl }]
        : [];
    })
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

export function priceFreshness(
  data: PortfolioData,
  now: number,
  maximumAgeMs: number,
): PriceFreshness {
  const activeIds = new Set(data.positions.map(({ assetId }) => assetId));
  const tracked = data.assets.filter(
    (asset) => activeIds.has(asset.id) && asset.autoUpdateSource !== 'none',
  );
  const current = tracked.filter(
    ({ priceUpdatedAt }) =>
      typeof priceUpdatedAt === 'number' &&
      now - priceUpdatedAt <= maximumAgeMs,
  );
  const updates = tracked
    .map(({ priceUpdatedAt }) => priceUpdatedAt)
    .filter((value): value is number => typeof value === 'number');
  return {
    tracked: tracked.length,
    current: current.length,
    staleAssetIds: tracked
      .filter((asset) => !current.includes(asset))
      .map(({ id }) => id),
    ...(updates.length ? { latestUpdateAt: Math.max(...updates) } : {}),
  };
}
