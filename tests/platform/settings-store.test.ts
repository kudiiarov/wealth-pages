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
      autoPriceRefresh: false,
      priceRefreshIntervalHours: 3,
      autoSnapshot: false,
      snapshotIntervalHours: 6,
      positionGrouping: 'accounts',
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
      autoPriceRefresh: true,
    });
  });

  it('round-trips scheduling preferences and completion timestamps', () => {
    store.save({
      autoPriceRefresh: true,
      priceRefreshIntervalHours: 12,
      lastPriceRefreshAt: 1_700_000_000_000,
      autoSnapshot: true,
      snapshotIntervalHours: 24,
      lastSnapshotAt: 1_700_000_100_000,
      positionGrouping: 'assets',
    });

    expect(store.load()).toMatchObject({
      autoPriceRefresh: true,
      priceRefreshIntervalHours: 12,
      lastPriceRefreshAt: 1_700_000_000_000,
      autoSnapshot: true,
      snapshotIntervalHours: 24,
      lastSnapshotAt: 1_700_000_100_000,
      positionGrouping: 'assets',
    });
  });

  it('normalizes invalid scheduling values and persists partial updates', () => {
    storage.setItem(SETTINGS_KEYS.language, 'de');
    storage.setItem(SETTINGS_KEYS.theme, 'neon');
    storage.setItem(SETTINGS_KEYS.priceRefreshIntervalHours, '2');
    storage.setItem(SETTINGS_KEYS.snapshotIntervalHours, 'forever');
    storage.setItem(SETTINGS_KEYS.lastPriceRefreshAt, '-1');
    storage.setItem(SETTINGS_KEYS.lastSnapshotAt, 'tomorrow');
    storage.setItem(SETTINGS_KEYS.positionGrouping, 'brokers');
    store.save({ theme: 'dark', autoPriceRefresh: true });

    expect(store.load()).toMatchObject({
      language: 'ru',
      theme: 'dark',
      autoPriceRefresh: true,
      priceRefreshIntervalHours: 3,
      snapshotIntervalHours: 6,
      positionGrouping: 'accounts',
    });
    expect(store.load()).not.toHaveProperty('lastPriceRefreshAt');
    expect(store.load()).not.toHaveProperty('lastSnapshotAt');
  });
});
