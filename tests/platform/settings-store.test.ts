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
      autoRefreshOnLaunch: false,
    });
  });

  it('reads the exact legacy localStorage keys', () => {
    storage.setItem(SETTINGS_KEYS.language, 'en');
    storage.setItem(SETTINGS_KEYS.theme, 'dark');
    storage.setItem(SETTINGS_KEYS.displayCurrency, 'EUR');
    storage.setItem(SETTINGS_KEYS.pnlPeriod, 'last');
    storage.setItem(SETTINGS_KEYS.autoRefreshOnLaunch, '1');

    expect(store.load()).toEqual({
      language: 'en',
      theme: 'dark',
      displayCurrency: 'EUR',
      pnlPeriod: 'last',
      autoRefreshOnLaunch: true,
    });
  });

  it('rejects invalid enum values and persists partial updates', () => {
    storage.setItem(SETTINGS_KEYS.language, 'de');
    storage.setItem(SETTINGS_KEYS.theme, 'neon');
    store.save({ theme: 'dark', autoRefreshOnLaunch: true });

    expect(store.load()).toMatchObject({
      language: 'ru',
      theme: 'dark',
      autoRefreshOnLaunch: true,
    });
    expect(storage.getItem(SETTINGS_KEYS.autoRefreshOnLaunch)).toBe('1');
  });
});
