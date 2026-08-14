import type {
  AppSettings,
  AutomationInterval,
  PortfolioData,
  UnknownRecord,
} from './models';
import { normalizeData } from './normalize';

export const BACKUP_VERSION = 15;
export const APP_VERSION = '3.4.0-final';

export interface ValidatedBackup {
  version: number;
  data: PortfolioData;
  settings?: Partial<AppSettings>;
}

export interface BackupV15 extends PortfolioData {
  app: 'Worth';
  version: 15;
  appVersion: typeof APP_VERSION;
  baseCurrency: 'USD';
  exportedAt: string;
  appSettings: AppSettings;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

function finiteNumber(value: unknown): boolean {
  return value !== '' && Number.isFinite(Number(value));
}

function automationInterval(value: unknown): value is AutomationInterval {
  return (
    value === 1 || value === 3 || value === 6 || value === 12 || value === 24
  );
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function records(value: unknown, section: string): UnknownRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`Нет раздела ${section}`);
  }
  const result: UnknownRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)) throw new Error(`Нет раздела ${section}`);
    result.push(item);
  }
  return result;
}

function parseSettings(value: unknown): Partial<AppSettings> | undefined {
  if (!isRecord(value)) return undefined;
  const settings: Partial<AppSettings> = {};
  if (value.language === 'ru' || value.language === 'en')
    settings.language = value.language;
  if (value.theme === 'light' || value.theme === 'dark')
    settings.theme = value.theme;
  if (typeof value.displayCurrency === 'string')
    settings.displayCurrency = value.displayCurrency;
  if (value.pnlPeriod === 'all' || value.pnlPeriod === 'last')
    settings.pnlPeriod = value.pnlPeriod;
  if (typeof value.autoRefreshOnLaunch === 'boolean') {
    settings.autoPriceRefresh = value.autoRefreshOnLaunch;
  }
  if (typeof value.autoPriceRefresh === 'boolean')
    settings.autoPriceRefresh = value.autoPriceRefresh;
  if (automationInterval(value.priceRefreshIntervalHours))
    settings.priceRefreshIntervalHours = value.priceRefreshIntervalHours;
  if (validTimestamp(value.lastPriceRefreshAt))
    settings.lastPriceRefreshAt = value.lastPriceRefreshAt;
  if (typeof value.autoSnapshot === 'boolean')
    settings.autoSnapshot = value.autoSnapshot;
  if (automationInterval(value.snapshotIntervalHours))
    settings.snapshotIntervalHours = value.snapshotIntervalHours;
  if (validTimestamp(value.lastSnapshotAt))
    settings.lastSnapshotAt = value.lastSnapshotAt;
  if (
    value.positionGrouping === 'accounts' ||
    value.positionGrouping === 'assets'
  )
    settings.positionGrouping = value.positionGrouping;
  if (typeof value.balancesHidden === 'boolean')
    settings.balancesHidden = value.balancesHidden;
  return Object.keys(settings).length > 0 ? settings : undefined;
}

export function validateBackup(value: unknown): ValidatedBackup {
  if (!isRecord(value)) throw new Error('Неверный файл');

  const version = value.version === undefined ? 1 : Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
    throw new Error('Неподдерживаемая версия резервной копии');
  }

  const accounts = records(value.accounts, 'accounts');
  const assets = records(value.assets, 'assets');
  const positions = records(value.positions, 'positions');
  const snapshots = records(value.snapshots, 'snapshots');

  if (
    accounts.some((account) => !text(account.id) || !text(account.name).trim())
  ) {
    throw new Error('Повреждены счета');
  }

  if (
    assets.some((asset) => {
      const code = text(asset.code || asset.symbol).trim();
      return (
        !text(asset.id) ||
        !text(asset.name).trim() ||
        !code ||
        !finiteNumber(asset.price) ||
        Number(asset.price) < 0
      );
    })
  ) {
    throw new Error('Повреждены активы');
  }

  const normalized = normalizeData({ accounts, assets, positions, snapshots });
  const accountIds = new Set(normalized.accounts.map(({ id }) => id));
  const assetIds = new Set(normalized.assets.map(({ id }) => id));
  const assetCodes = normalized.assets.map(({ code }) => code);
  if (new Set(assetCodes).size !== assetCodes.length) {
    throw new Error('Коды активов должны быть уникальны');
  }

  if (
    positions.some(
      (position) =>
        !text(position.id) ||
        !accountIds.has(text(position.accountId)) ||
        !assetIds.has(text(position.assetId)) ||
        !finiteNumber(position.quantity),
    )
  ) {
    throw new Error('Повреждены позиции');
  }

  if (
    snapshots.some(
      (snapshot) =>
        !text(snapshot.id) ||
        !finiteNumber(snapshot.createdAt) ||
        !finiteNumber(snapshot.total),
    )
  ) {
    throw new Error('Повреждена история');
  }

  const settings = parseSettings(value.appSettings);
  return settings
    ? { version, data: normalized, settings }
    : { version, data: normalized };
}

function cloneData(data: PortfolioData): PortfolioData {
  return {
    accounts: data.accounts.map((account) => ({ ...account })),
    assets: data.assets.map((asset) => ({ ...asset })),
    positions: data.positions.map((position) => ({ ...position })),
    snapshots: data.snapshots.map((snapshot) => ({
      ...snapshot,
      ...(snapshot.accounts
        ? { accounts: snapshot.accounts.map((account) => ({ ...account })) }
        : {}),
      ...(snapshot.assets
        ? { assets: snapshot.assets.map((asset) => ({ ...asset })) }
        : {}),
      ...(snapshot.positions
        ? { positions: snapshot.positions.map((position) => ({ ...position })) }
        : {}),
    })),
  };
}

export function createBackup(
  data: PortfolioData,
  settings: AppSettings,
  exportedAt: string,
): BackupV15 {
  return {
    app: 'Worth',
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    baseCurrency: 'USD',
    exportedAt,
    ...cloneData(data),
    appSettings: { ...settings },
  };
}
