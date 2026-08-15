import type { SettingsStore } from '../../application/ports';
import type {
  AppSettings,
  AutomationInterval,
  RatePair,
} from '../../domain/models';

export const SETTINGS_KEYS = {
  language: 'worth-language',
  theme: 'worth-theme',
  displayCurrency: 'worth-display-currency',
  pnlPeriod: 'worth-pnl-period',
  autoRefreshOnLaunch: 'worth-auto-refresh-launch',
  autoPriceRefresh: 'worth-auto-price-refresh',
  priceRefreshIntervalHours: 'worth-price-refresh-hours',
  lastPriceRefreshAt: 'worth-last-price-refresh',
  autoSnapshot: 'worth-auto-snapshot',
  snapshotIntervalHours: 'worth-snapshot-hours',
  lastSnapshotAt: 'worth-last-snapshot',
  positionGrouping: 'worth-position-grouping',
  balancesHidden: 'worth-balances-hidden',
  selectedRateAssetIds: 'worth-selected-rate-assets',
  ratePairs: 'worth-rate-pairs',
} as const;

const AUTOMATION_INTERVALS: readonly AutomationInterval[] = [1, 3, 6, 12, 24];

function interval(
  value: string | null,
  fallback: AutomationInterval,
): AutomationInterval {
  const parsed = Number(value);
  return AUTOMATION_INTERVALS.includes(parsed as AutomationInterval)
    ? (parsed as AutomationInterval)
    : fallback;
}

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
      const sourceAssetId = Reflect.get(item, 'sourceAssetId');
      const quoteAssetId = Reflect.get(item, 'quoteAssetId');
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
      autoPriceRefresh:
        autoPriceRefresh === null
          ? this.storage.getItem(SETTINGS_KEYS.autoRefreshOnLaunch) === '1'
          : autoPriceRefresh === '1',
      priceRefreshIntervalHours: interval(
        this.storage.getItem(SETTINGS_KEYS.priceRefreshIntervalHours),
        3,
      ),
      ...(lastPriceRefreshAt === undefined ? {} : { lastPriceRefreshAt }),
      autoSnapshot: this.storage.getItem(SETTINGS_KEYS.autoSnapshot) === '1',
      snapshotIntervalHours: interval(
        this.storage.getItem(SETTINGS_KEYS.snapshotIntervalHours),
        6,
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
    if (settings.autoPriceRefresh !== undefined) {
      this.storage.setItem(
        SETTINGS_KEYS.autoPriceRefresh,
        settings.autoPriceRefresh ? '1' : '0',
      );
    }
    if (settings.priceRefreshIntervalHours !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.priceRefreshIntervalHours,
        String(settings.priceRefreshIntervalHours),
      );
    if (settings.lastPriceRefreshAt !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.lastPriceRefreshAt,
        String(settings.lastPriceRefreshAt),
      );
    if (settings.autoSnapshot !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.autoSnapshot,
        settings.autoSnapshot ? '1' : '0',
      );
    if (settings.snapshotIntervalHours !== undefined)
      this.storage.setItem(
        SETTINGS_KEYS.snapshotIntervalHours,
        String(settings.snapshotIntervalHours),
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
