import { beforeEach, describe, expect, it } from 'vitest';

import {
  BrowserSettingsStore,
  SETTINGS_KEYS,
} from '../../src/platform/browser/settings-store';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('BrowserSettingsStore', () => {
  let storage: MemoryStorage;
  let store: BrowserSettingsStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new BrowserSettingsStore(storage);
  });

  it('returns safe defaults when storage is empty', () => {
    expect(store.load()).toEqual({
      language: 'ru',
      theme: 'light',
      displayCurrency: 'USD',
      pnlPeriod: 'all',
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
      positionGrouping: 'accounts',
      balancesHidden: false,
      selectedRateAssetIds: [],
      ratePairs: [],
    });
  });

  it('migrates the legacy launch-refresh key when the new key is absent', () => {
    storage.setItem(SETTINGS_KEYS.language, 'en');
    storage.setItem(SETTINGS_KEYS.theme, 'dark');
    storage.setItem(SETTINGS_KEYS.displayCurrency, 'EUR');
    storage.setItem(SETTINGS_KEYS.pnlPeriod, 'last');
    storage.setItem(SETTINGS_KEYS.autoRefreshOnLaunch, '1');

    expect(store.load()).toMatchObject({
      language: 'en',
      theme: 'dark',
      displayCurrency: 'EUR',
      pnlPeriod: 'last',
      priceRefreshIntervalMinutes: 60,
    });
  });

  it('round-trips scheduling preferences and completion timestamps', () => {
    store.save({
      priceRefreshIntervalMinutes: 15,
      lastPriceRefreshAt: 1_700_000_000_000,
      snapshotIntervalMinutes: 30,
      lastSnapshotAt: 1_700_000_100_000,
      positionGrouping: 'assets',
      balancesHidden: true,
    });

    expect(store.load()).toMatchObject({
      priceRefreshIntervalMinutes: 15,
      lastPriceRefreshAt: 1_700_000_000_000,
      snapshotIntervalMinutes: 30,
      lastSnapshotAt: 1_700_000_100_000,
      positionGrouping: 'assets',
      balancesHidden: true,
    });
  });

  it('normalizes invalid scheduling values and persists partial updates', () => {
    storage.setItem(SETTINGS_KEYS.language, 'de');
    storage.setItem(SETTINGS_KEYS.theme, 'neon');
    storage.setItem(SETTINGS_KEYS.priceRefreshIntervalMinutes, '2');
    storage.setItem(SETTINGS_KEYS.snapshotIntervalMinutes, 'forever');
    storage.setItem(SETTINGS_KEYS.lastPriceRefreshAt, '-1');
    storage.setItem(SETTINGS_KEYS.lastSnapshotAt, 'tomorrow');
    storage.setItem(SETTINGS_KEYS.positionGrouping, 'brokers');
    store.save({ theme: 'dark' });

    expect(store.load()).toMatchObject({
      language: 'ru',
      theme: 'dark',
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
      positionGrouping: 'accounts',
    });
    expect(store.load()).not.toHaveProperty('lastPriceRefreshAt');
    expect(store.load()).not.toHaveProperty('lastSnapshotAt');
  });

  it('maps disabled and enabled legacy scheduling settings to minutes', () => {
    storage.setItem(SETTINGS_KEYS.autoPriceRefresh, '1');
    storage.setItem(SETTINGS_KEYS.priceRefreshIntervalHours, '3');
    storage.setItem(SETTINGS_KEYS.autoSnapshot, '0');
    storage.setItem(SETTINGS_KEYS.snapshotIntervalHours, '6');

    expect(store.load()).toMatchObject({
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
    });
  });

  it('round-trips up to three unique selected rate assets', () => {
    store.save({
      selectedRateAssetIds: ['btc', 'usd', 'btc', '', 'xaut', 'eth'],
    });

    expect(store.load().selectedRateAssetIds).toEqual(['btc', 'usd', 'xaut']);
  });

  it('ignores malformed selected rate storage', () => {
    storage.setItem(SETTINGS_KEYS.selectedRateAssetIds, 'not-json');
    expect(store.load().selectedRateAssetIds).toEqual([]);

    storage.setItem(
      SETTINGS_KEYS.selectedRateAssetIds,
      JSON.stringify(['btc', 42, '  ', 'eth']),
    );
    expect(store.load().selectedRateAssetIds).toEqual(['btc', 'eth']);
  });

  it('round-trips three ordered pairs and deduplicates their source assets', () => {
    store.save({
      ratePairs: [
        { sourceAssetId: 'usd', quoteAssetId: 'rub' },
        { sourceAssetId: 'btc', quoteAssetId: 'usd' },
        { sourceAssetId: 'usd', quoteAssetId: 'btc' },
        { sourceAssetId: 'xaut', quoteAssetId: 'btc' },
        { sourceAssetId: 'eth', quoteAssetId: 'usd' },
      ],
    });

    expect(store.load().ratePairs).toEqual([
      { sourceAssetId: 'usd', quoteAssetId: 'rub' },
      { sourceAssetId: 'btc', quoteAssetId: 'usd' },
      { sourceAssetId: 'xaut', quoteAssetId: 'btc' },
    ]);
  });

  it('ignores malformed rate-pair storage', () => {
    storage.setItem(SETTINGS_KEYS.ratePairs, 'not-json');
    expect(store.load().ratePairs).toEqual([]);

    storage.setItem(
      SETTINGS_KEYS.ratePairs,
      JSON.stringify([
        { sourceAssetId: 'btc', quoteAssetId: 'usd' },
        { sourceAssetId: '', quoteAssetId: 'rub' },
        { sourceAssetId: 'eth', quoteAssetId: 42 },
      ]),
    );
    expect(store.load().ratePairs).toEqual([
      { sourceAssetId: 'btc', quoteAssetId: 'usd' },
    ]);
  });
});
