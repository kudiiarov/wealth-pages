import type {
  Account,
  Asset,
  AssetCategory,
  AutoUpdateSource,
  PortfolioData,
  Position,
  PriceHistoryPoint,
  Snapshot,
  SnapshotAsset,
  UnknownRecord,
} from './models';

export const DEFAULT_ACCOUNT_COLOR = '#17181b';
export const DEFAULT_ASSET_COLOR = '#5667ff';

const numeric = (value: unknown): number => Number(value) || 0;
const stringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return fallback;
};
const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' ? (value as UnknownRecord) : {};
const asRecords = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

export function cleanCode(value: unknown = ''): string {
  return stringValue(value).trim().toUpperCase();
}

export function trimIcon(value: unknown = '', fallback = '•'): string {
  const icon = Array.from(stringValue(value).trim()).slice(0, 5).join('');
  return icon || fallback;
}

export function validColor(value: unknown): value is string {
  return /^#[0-9a-f]{6}$/i.test(stringValue(value));
}

export function defaultAccountIcon(type: unknown = ''): string {
  const value = stringValue(type);
  if (value.includes('Банк')) return '▥';
  if (value.includes('Бирж')) return '↗';
  if (value.includes('Долг')) return '↔';
  if (value.includes('Крипто')) return '◇';
  if (value.includes('Налич')) return '$';
  return '•';
}

export function normalizeAccount(value: UnknownRecord): Account {
  const account = { ...value };
  const type = stringValue(account.type, 'Другое') || 'Другое';

  return {
    ...account,
    id: stringValue(account.id),
    name: stringValue(account.name).trim(),
    type,
    icon: trimIcon(account.icon, defaultAccountIcon(type)),
    color: validColor(account.color) ? account.color : DEFAULT_ACCOUNT_COLOR,
  };
}

function normalizeAutoUpdateSource(value: unknown): AutoUpdateSource {
  return value === 'coingecko' || value === 'frankfurter' ? value : 'none';
}

function normalizeCategory(value: unknown): AssetCategory | undefined {
  const category = stringValue(value).trim();
  return category || undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = Array.from(
    value
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .reduce<Map<string, string>>((unique, tag) => {
        const key = tag.toLocaleLowerCase();
        if (!unique.has(key)) unique.set(key, tag);
        return unique;
      }, new Map())
      .values(),
  );
  return tags.length ? tags : undefined;
}

export function normalizeAsset(value: UnknownRecord): Asset {
  const { symbol, category: rawCategory, tags: rawTags, ...asset } = value;
  const code = cleanCode(asset.code || symbol || '');
  const category = normalizeCategory(rawCategory);
  const tags = normalizeTags(rawTags);

  return {
    ...asset,
    id: stringValue(asset.id),
    name: stringValue(asset.name).trim(),
    code,
    icon: trimIcon(asset.icon, code.slice(0, 5) || '•'),
    color: validColor(asset.color) ? asset.color : DEFAULT_ASSET_COLOR,
    price: numeric(asset.price),
    autoUpdateSource: normalizeAutoUpdateSource(asset.autoUpdateSource),
    ...(category ? { category } : {}),
    ...(tags ? { tags } : {}),
  };
}

function normalizeSnapshotAsset(value: UnknownRecord): SnapshotAsset {
  const { symbol, ...asset } = value;
  return {
    ...asset,
    assetId: stringValue(asset.assetId) || stringValue(asset.id),
    code: cleanCode(asset.code || symbol || ''),
  };
}

export function normalizeSnapshot(value: UnknownRecord): Snapshot {
  const snapshot = { ...value };
  const normalized: Snapshot = {
    ...snapshot,
    id: stringValue(snapshot.id),
    createdAt: numeric(snapshot.createdAt),
    total: numeric(snapshot.total),
  };

  if (Array.isArray(snapshot.assets)) {
    normalized.assets = snapshot.assets.map((asset) =>
      normalizeSnapshotAsset(asRecord(asset)),
    );
  }

  return normalized;
}

function normalizePosition(value: UnknownRecord): Position {
  return {
    ...value,
    id: stringValue(value.id),
    accountId: stringValue(value.accountId),
    assetId: stringValue(value.assetId),
    quantity: numeric(value.quantity),
    comment: stringValue(value.comment).trim(),
  };
}

function normalizePriceHistoryPoint(
  value: UnknownRecord,
): PriceHistoryPoint | undefined {
  const id = stringValue(value.id);
  const assetId = stringValue(value.assetId);
  const dayKey = stringValue(value.dayKey);
  const createdAt = Number(value.createdAt);
  const usdPrice = Number(value.usdPrice);
  if (
    !id ||
    !assetId ||
    !dayKey ||
    !Number.isFinite(createdAt) ||
    createdAt < 0 ||
    !Number.isFinite(usdPrice) ||
    usdPrice < 0
  ) {
    return;
  }
  const source = asRecord(value.source);
  const sourceType = source.type;
  return {
    id,
    assetId,
    dayKey,
    createdAt,
    usdPrice,
    ...(sourceType === 'fiat' || sourceType === 'crypto'
      ? {
          source: {
            type: sourceType,
            ...(stringValue(source.code)
              ? { code: stringValue(source.code) }
              : {}),
            ...(stringValue(source.id) ? { id: stringValue(source.id) } : {}),
          },
        }
      : {}),
  };
}

export function normalizeData(value: UnknownRecord): PortfolioData {
  return {
    accounts: asRecords(value.accounts).map(normalizeAccount),
    assets: asRecords(value.assets).map(normalizeAsset),
    positions: asRecords(value.positions).map(normalizePosition),
    snapshots: asRecords(value.snapshots).map(normalizeSnapshot),
    priceHistory: asRecords(value.priceHistory).flatMap((point) => {
      const normalized = normalizePriceHistoryPoint(point);
      return normalized ? [normalized] : [];
    }),
  };
}
