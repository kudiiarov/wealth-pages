import type { SettingsStore } from '../../application/ports';
import type {
  AppSettings,
  PriceRefreshIntervalMinutes,
  RatePair,
  SnapshotIntervalMinutes,
} from '../../domain/models';

export const SETTINGS_KEYS = {
  language: 'worth-language',
  theme: 'worth-theme',
  displayCurrency: 'worth-display-currency',
  pnlPeriod: 'worth-pnl-period',
  autoRefreshOnLaunch: 'worth-auto-refresh-launch',
  autoPriceRefresh: 'worth-auto-price-refresh',
  priceRefreshIntervalHours: 'worth-price-refresh-hours',
  priceRefreshIntervalMinutes: 'worth-price-refresh-minutes',
  lastPriceRefreshAt: 'worth-last-price-refresh',
  autoSnapshot: 'worth-auto-snapshot',
  snapshotIntervalHours: 'worth-snapshot-hours',
  snapshotIntervalMinutes: 'worth-snapshot-minutes',
  lastSnapshotAt: 'worth-last-snapshot',
  positionGrouping: 'worth-position-grouping',
  balancesHidden: 'worth-balances-hidden',
  selectedRateAssetIds: 'worth-selected-rate-assets',
  ratePairs: 'worth-rate-pairs',
} as const;

function interval<T extends number>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === null) return fallback;
  const parsed = Number(value);
  return allowed.includes(parsed as T) ? (parsed as T) : fallback;
}

const PRICE_INTERVALS: readonly PriceRefreshIntervalMinutes[] = [
  0, 5, 15, 30, 60,
];
const SNAPSHOT_INTERVALS: readonly SnapshotIntervalMinutes[] = [0, 30, 60];

function timestamp(value: string | null): number | undefined {
  const parsed = Number(value);
  return value !== null && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

function normalizeSelectedRateAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      ),
    ),
  ).slice(0, 3);
}

function selectedRateAssetIds(value: string | null): string[] {
  if (value === null) return [];
  try {
    return normalizeSelectedRateAssetIds(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeRatePairs(value: unknown): RatePair[] {
  if (!Array.isArray(value)) return [];
  const sources = new Set<string>();
  return value
    .flatMap((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item))
        return [];
      const record = item as Record<string, unknown>;
      const sourceAssetId = record.sourceAssetId;
      const quoteAssetId = record.quoteAssetId;
      if (
        typeof sourceAssetId !== 'string' ||
        !sourceAssetId.trim() ||
        typeof quoteAssetId !== 'string' ||
        !quoteAssetId.trim() ||
        sources.has(sourceAssetId)
      )
        return [];
      sources.add(sourceAssetId);
      return [{ sourceAssetId, quoteAssetId }];
    })
    .slice(0, 3);
}

function ratePairs(value: string | null): RatePair[] {
  if (value === null) return [];
  try {
    return normalizeRatePairs(JSON.parse(value));
  } catch {
    return [];
  }
}

export class BrowserSettingsStore implements SettingsStore {
  constructor(private readonly storage: Storage = localStorage) {}

  load(): AppSettings {
    const language = this.storage.getItem(SETTINGS_KEYS.language);
    const theme = this.storage.getItem(SETTINGS_KEYS.theme);
    const displayCurrency = this.storage.getItem(SETTINGS_KEYS.displayCurrency);
    const pnlPeriod = this.storage.getItem(SETTINGS_KEYS.pnlPeriod);
    const autoPriceRefresh = this.storage.getItem(
      SETTINGS_KEYS.autoPriceRefresh,
    );
    const storedPriceMinutes = this.storage.getItem(
      SETTINGS_KEYS.priceRefreshIntervalMinutes,
    );
    const storedSnapshotMinutes = this.storage.getItem(
      SETTINGS_KEYS.snapshotIntervalMinutes,
    );
    const legacyPriceEnabled =
      autoPriceRefresh === null
        ? this.storage.getItem(SETTINGS_KEYS.autoRefreshOnLaunch) !== '0'
        : autoPriceRefresh === '1';
    const legacySnapshotEnabled =
      this.storage.getItem(SETTINGS_KEYS.autoSnapshot) === '1';
    const lastPriceRefreshAt = timestamp(
      this.storage.getItem(SETTINGS_KEYS.lastPriceRefreshAt),
    );
    const lastSnapshotAt = timestamp(
      this.storage.getItem(SETTINGS_KEYS.lastSnapshotAt),
    );

    return {
      language: language === 'en' ? 'en' : 'ru',
      theme: theme === 'dark' ? 'dark' : 'light',
      displayCurrency: displayCurrency?.trim() || 'USD',
      pnlPeriod: pnlPeriod === 'last' ? 'last' : 'all',
      priceRefreshIntervalMinutes: interval(
        storedPriceMinutes,
        PRICE_INTERVALS,
        legacyPriceEnabled ? 60 : 0,
      ),
      ...(lastPriceRefreshAt === undefined ? {} : { lastPriceRefreshAt }),
      snapshotIntervalMinutes: interval(
        storedSnapshotMinutes,
        SNAPSHOT_INTERVALS,
        legacySnapshotEnabled ? 60 : 0,
      ),
      ...(lastSnapshotAt === undefined ? {} : { lastSnapshotAt }),
      positionGrouping:
        this.storage.getItem(SETTINGS_KEYS.positionGrouping) === 'assets'
          ? 'assets'
          : 'accounts',
      balancesHidden:
        this.storage.getItem(SETTINGS_KEYS.balancesHidden) === '1',
      selectedRateAssetIds: selectedRateAssetIds(
        this.storage.getItem(SETTINGS_KEYS.selectedRateAssetIds),
      ),
      ratePairs: ratePairs(this.storage.getItem(SETTINGS_KEYS.ratePairs)),
    };
  }

  save(settings: Partial<AppSettings>): void {
    if (settings.language !== undefined) {
      this.storage.setItem(SETTINGS_KEYS.language, settings.language);
    }
    if (settings.theme !== undefined) {
      this.storage.setItem(SETTINGS_KEYS.theme, settings.theme);
    }
    if (settings.displayCurrency !== undefined) {
      this.storage.setItem(
        SETTINGS_KEYS.displayCurrency,
        settings.displayCurrency,
      );
    }
    if (settings.pnlPeriod !== undefined) {
      this.storage.setItem(SETTINGS_KEYS.pnlPeriod, settings.pnlPeriod);
    }
    if (settings.priceRefreshIntervalMinutes !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.priceRefreshIntervalMinutes,
        String(settings.priceRefreshIntervalMinutes),
      );
    if (settings.lastPriceRefreshAt !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.lastPriceRefreshAt,
        String(settings.lastPriceRefreshAt),
      );
    if (settings.snapshotIntervalMinutes !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.snapshotIntervalMinutes,
        String(settings.snapshotIntervalMinutes),
      );
    if (settings.lastSnapshotAt !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.lastSnapshotAt,
        String(settings.lastSnapshotAt),
      );
    if (settings.positionGrouping !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.positionGrouping,
        settings.positionGrouping,
      );
    if (settings.balancesHidden !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.balancesHidden,
        settings.balancesHidden ? '1' : '0',
      );
    if (settings.selectedRateAssetIds !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.selectedRateAssetIds,
        JSON.stringify(
          normalizeSelectedRateAssetIds(settings.selectedRateAssetIds),
        ),
      );
    if (settings.ratePairs !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.ratePairs,
        JSON.stringify(normalizeRatePairs(settings.ratePairs)),
      );
  }
}
