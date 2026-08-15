import type {
  Account,
  Asset,
  AssetCategory,
  PortfolioData,
  RatePair,
  Snapshot,
} from '../domain/models';
import { flowAdjustedPnl, type PnlPoint } from '../domain/pnl';
import { accountTotal, assetQuantity, assetTotal } from '../domain/portfolio';
import type { HistoryDatum } from './chart';

export interface AllocationRow {
  asset: Asset;
  quantity: number;
  value: number;
}

export interface AccountOverviewRow {
  account: Account;
  value: number;
}

export interface RatePairRow {
  pair: RatePair;
  source: Asset;
  quote: Asset;
  value?: number;
}

export type CompactAllocationRow =
  | {
      kind: 'asset' | 'account';
      id: string;
      name: string;
      color: string;
      value: number;
      percentage: number;
    }
  | {
      kind: 'other';
      count: number;
      value: number;
      percentage: number;
    };

export interface AssetProfile {
  category: AssetCategory;
  tags: string[];
}

export type PortfolioFilter =
  | { kind: 'all' }
  | { kind: 'tag'; value: string }
  | { kind: 'category'; value: string };

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

export function assetMatchesPortfolioFilter(
  asset: Asset,
  filter: PortfolioFilter,
): boolean {
  if (filter.kind === 'all') return true;
  const profile = inferAssetProfile(asset);
  if (filter.kind === 'category') return profile.category === filter.value;
  return profile.tags.some(
    (tag) => tag.toLocaleLowerCase() === filter.value.toLocaleLowerCase(),
  );
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

function resolveAsset(
  data: PortfolioData,
  reference: string,
): Asset | undefined {
  const normalized = reference.toLocaleUpperCase();
  return data.assets.find(
    ({ id, code }) =>
      id === reference || code.toLocaleUpperCase() === normalized,
  );
}

export function normalizeRatePairs(
  data: PortfolioData,
  configured: readonly RatePair[],
  fallbackQuoteCode = 'USD',
  limit = 3,
): RatePair[] {
  const sources = new Set<string>();
  const normalized = configured.flatMap((pair) => {
    const source = resolveAsset(data, pair.sourceAssetId);
    const quote = resolveAsset(data, pair.quoteAssetId);
    if (!source || !quote || sources.has(source.id)) return [];
    sources.add(source.id);
    return [{ sourceAssetId: source.id, quoteAssetId: quote.id }];
  });
  if (normalized.length) return normalized.slice(0, limit);

  const quote =
    resolveAsset(data, fallbackQuoteCode) ??
    resolveAsset(data, 'USD') ??
    data.assets[0];
  if (!quote) return [];
  return assetOverviewRows(data)
    .slice(0, limit)
    .map(({ asset }) => ({
      sourceAssetId: asset.id,
      quoteAssetId: quote.id,
    }));
}

export function ratePairRows(
  data: PortfolioData,
  pairs: readonly RatePair[],
): RatePairRow[] {
  return pairs.flatMap((pair) => {
    const source = resolveAsset(data, pair.sourceAssetId);
    const quote = resolveAsset(data, pair.quoteAssetId);
    if (!source || !quote) return [];
    const sourcePrice = Number(source.price);
    const quotePrice = Number(quote.price);
    const value =
      Number.isFinite(sourcePrice) &&
      Number.isFinite(quotePrice) &&
      quotePrice > 0
        ? sourcePrice / quotePrice
        : undefined;
    return [{ pair, source, quote, ...(value === undefined ? {} : { value }) }];
  });
}

function compactAllocation(
  rows: readonly { id: string; name: string; color: string; value: number }[],
  kind: 'asset' | 'account',
  limit: number,
): CompactAllocationRow[] {
  const nonEmpty = rows.filter(({ value }) => value !== 0);
  const gross = nonEmpty.reduce((sum, { value }) => sum + Math.abs(value), 0);
  if (!gross) return [];
  const visible = nonEmpty
    .slice(0, limit)
    .map(({ id, name, color, value }) => ({
      kind,
      id,
      name,
      color,
      value,
      percentage: (Math.abs(value) / gross) * 100,
    }));
  const remainder = nonEmpty.slice(limit);
  const otherValue = remainder.reduce(
    (sum, { value }) => sum + Math.abs(value),
    0,
  );
  return otherValue
    ? [
        ...visible,
        {
          kind: 'other',
          count: remainder.length,
          value: otherValue,
          percentage: (otherValue / gross) * 100,
        },
      ]
    : visible;
}

export function compactAssetAllocation(
  data: PortfolioData,
  limit = 4,
): CompactAllocationRow[] {
  return compactAllocation(
    assetOverviewRows(data).map(({ asset, value }) => ({
      id: asset.id,
      name: asset.name,
      color: asset.color,
      value,
    })),
    'asset',
    limit,
  );
}

export function compactAccountAllocation(
  data: PortfolioData,
  limit = 4,
): CompactAllocationRow[] {
  return compactAllocation(
    accountOverviewRows(data).map(({ account, value }) => ({
      id: account.id,
      name: account.name,
      color: account.color,
      value,
    })),
    'account',
    limit,
  );
}

export function selectedRateAssets(
  data: PortfolioData,
  selectedIds: readonly string[],
  limit = 3,
): Asset[] {
  const assetsById = new Map(data.assets.map((asset) => [asset.id, asset]));
  const selected = Array.from(new Set(selectedIds))
    .flatMap((id) => {
      const asset = assetsById.get(id);
      return asset ? [asset] : [];
    })
    .slice(0, limit);
  return selected.length
    ? selected
    : assetOverviewRows(data)
        .slice(0, limit)
        .map(({ asset }) => asset);
}

export function assetHistorySeries(
  assetId: string,
  snapshots: readonly Snapshot[],
): HistoryDatum[] {
  return snapshots
    .flatMap((snapshot) => {
      const value = snapshot.assets?.find(
        (asset) => asset.assetId === assetId,
      )?.value;
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ createdAt: snapshot.createdAt, value }]
        : [];
    })
    .sort((left, right) => left.createdAt - right.createdAt);
}

export function assetPriceHistorySeries(
  assetId: string,
  snapshots: readonly Snapshot[],
): HistoryDatum[] {
  return snapshots
    .flatMap((snapshot) => {
      const price = snapshot.assets?.find(
        (asset) => asset.assetId === assetId,
      )?.price;
      return typeof price === 'number' && Number.isFinite(price)
        ? [{ createdAt: snapshot.createdAt, value: price }]
        : [];
    })
    .sort((left, right) => left.createdAt - right.createdAt);
}

export function accountHistorySeries(
  accountId: string,
  snapshots: readonly Snapshot[],
): HistoryDatum[] {
  return snapshots
    .flatMap((snapshot) => {
      const value = snapshot.accounts?.find(
        (account) => account.accountId === accountId,
      )?.total;
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ createdAt: snapshot.createdAt, value }]
        : [];
    })
    .sort((left, right) => left.createdAt - right.createdAt);
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
  const totals = new Map<string, { tag: string; value: number }>();
  const labels = data.assets
    .flatMap((asset) => inferAssetProfile(asset).tags)
    .reduce<Map<string, string>>((result, tag) => {
      const key = tag.toLocaleLowerCase();
      if (!result.has(key)) result.set(key, tag);
      return result;
    }, new Map());
  for (const { asset, value } of allocationRows(data)) {
    for (const tag of inferAssetProfile(asset).tags) {
      const key = tag.toLocaleLowerCase();
      const current = totals.get(key);
      totals.set(key, {
        tag: labels.get(key) ?? current?.tag ?? tag,
        value: (current?.value ?? 0) + Math.abs(value),
      });
    }
  }
  return Array.from(totals.values(), ({ tag, value }) => ({
    tag,
    value,
    percentage: gross ? (value / gross) * 100 : 0,
  })).sort((left, right) => right.value - left.value);
}

export function portfolioTags(data: PortfolioData): string[] {
  return Array.from(
    data.assets
      .flatMap((asset) => inferAssetProfile(asset).tags)
      .reduce<Map<string, string>>((unique, tag) => {
        const key = tag.toLocaleLowerCase();
        if (!unique.has(key)) unique.set(key, tag);
        return unique;
      }, new Map())
      .values(),
  ).sort((left, right) => left.localeCompare(right, 'en'));
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
