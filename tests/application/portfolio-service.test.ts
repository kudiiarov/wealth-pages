import { beforeEach, describe, expect, it } from 'vitest';

import type {
  DiagnosticEntry,
  DiagnosticEvent,
  DiagnosticLog,
  EntityByStore,
  FileTransfer,
  PortfolioRepository,
  PriceBatch,
  PriceProvider,
  SettingsStore,
} from '../../src/application/ports';
import { PortfolioService } from '../../src/application/portfolio-service';
import type {
  AppSettings,
  PortfolioData,
  StoreName,
} from '../../src/domain/models';
import { currentV14 } from '../fixtures/legacy-backups';

const defaults: AppSettings = {
  language: 'ru',
  theme: 'light',
  displayCurrency: 'USD',
  pnlPeriod: 'all',
  priceRefreshIntervalMinutes: 0,
  snapshotIntervalMinutes: 0,
  positionGrouping: 'accounts',
  balancesHidden: false,
  selectedRateAssetIds: [],
  ratePairs: [],
};

class MemoryRepository implements PortfolioRepository {
  data: PortfolioData = {
    accounts: [],
    assets: [],
    positions: [],
    snapshots: [],
    priceHistory: [],
  };
  replacements = 0;

  load(): Promise<PortfolioData> {
    return Promise.resolve(structuredClone(this.data));
  }

  put<K extends StoreName>(store: K, value: EntityByStore[K]): Promise<void> {
    const values = this.data[store] as EntityByStore[K][];
    const index = values.findIndex(({ id }) => id === value.id);
    if (index >= 0) values[index] = structuredClone(value);
    else values.push(structuredClone(value));
    return Promise.resolve();
  }

  delete(store: StoreName, id: string): Promise<void> {
    const index = this.data[store].findIndex((entity) => entity.id === id);
    if (index >= 0) this.data[store].splice(index, 1);
    return Promise.resolve();
  }

  replaceAll(data: PortfolioData): Promise<void> {
    this.replacements += 1;
    this.data = structuredClone(data);
    return Promise.resolve();
  }

  clearAll(): Promise<void> {
    this.data = {
      accounts: [],
      assets: [],
      positions: [],
      snapshots: [],
      priceHistory: [],
    };
    return Promise.resolve();
  }
}

class MemorySettings implements SettingsStore {
  constructor(public settings: AppSettings = { ...defaults }) {}

  load(): AppSettings {
    return { ...this.settings };
  }

  save(settings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}

class CapturingFiles implements FileTransfer {
  downloads: Array<{ filename: string; payload: unknown }> = [];

  downloadJson(filename: string, payload: unknown): void {
    this.downloads.push({ filename, payload });
  }
}

class FixedPrices implements PriceProvider {
  constructor(private readonly batch: PriceBatch) {}

  getUsdPrices(): Promise<PriceBatch> {
    return Promise.resolve(structuredClone(this.batch));
  }
}

class MemoryDiagnostics implements DiagnosticLog {
  readonly entries: DiagnosticEntry[] = [];

  record(event: DiagnosticEvent): void {
    this.entries.unshift({
      ...structuredClone(event),
      id: `log-${this.entries.length + 1}`,
      createdAt: 1_700_000_000_000,
    });
  }

  list(): DiagnosticEntry[] {
    return structuredClone(this.entries);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

describe('PortfolioService', () => {
  let repository: MemoryRepository;
  let settings: MemorySettings;
  let files: CapturingFiles;
  let diagnostics: MemoryDiagnostics;
  let nextId: number;
  let now: number;

  beforeEach(() => {
    repository = new MemoryRepository();
    settings = new MemorySettings();
    files = new CapturingFiles();
    diagnostics = new MemoryDiagnostics();
    nextId = 1;
    now = new Date(2026, 7, 15, 9).getTime();
  });

  function service(
    prices: PriceProvider = new FixedPrices({
      quotes: [],
      failures: [],
      skipped: [],
    }),
  ) {
    return new PortfolioService({
      repository,
      settings,
      files,
      diagnostics,
      prices,
      clock: {
        now: () => now,
        isoNow: () => '2026-08-14T00:00:00.000Z',
      },
      ids: { next: () => `id-${nextId++}` },
    });
  }

  it('allows multiple positions for one account and asset', async () => {
    const app = service();
    await app.initialize();
    const account = await app.createAccount({
      name: 'Cash',
      type: 'cash',
      icon: '$',
      color: '#17181b',
    });
    const asset = await app.createAsset({
      name: 'Dollar',
      code: 'USD',
      icon: '$',
      color: '#5667ff',
      price: 1,
      autoUpdateSource: 'none',
    });

    await app.savePosition({
      accountId: account.id,
      assetId: asset.id,
      quantity: 2,
      comment: 'one',
    });
    await app.savePosition({
      accountId: account.id,
      assetId: asset.id,
      quantity: 3,
      comment: 'two',
    });

    expect(app.data.positions).toHaveLength(2);
    expect(app.data.positions.map(({ quantity }) => quantity)).toEqual([2, 3]);
  });

  it('validates a backup before replacing any stored data', async () => {
    repository.data.accounts = [
      { id: 'old', name: 'Old', type: 'cash', icon: '$', color: '#17181b' },
    ];
    const app = service();
    await app.initialize();

    await expect(app.importBackup('{"bad":true}')).rejects.toThrow();

    expect(repository.replacements).toBe(0);
    expect(repository.data.accounts[0]?.id).toBe('old');
  });

  it('atomically imports valid data and compatible settings', async () => {
    const app = service();
    await app.initialize();

    await app.importBackup(JSON.stringify(currentV14));

    expect(repository.replacements).toBe(1);
    expect(app.data.assets[0]?.code).toBe('USD');
    expect(settings.settings).toMatchObject({
      language: 'en',
      theme: 'dark',
      displayCurrency: 'USD',
      pnlPeriod: 'last',
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
    });
  });

  it('exports schema 16 through the file port', async () => {
    const app = service();
    await app.initialize();

    app.exportBackup();

    expect(files.downloads[0]?.filename).toBe('worth-backup-2026-08-14.json');
    expect(files.downloads[0]?.payload).toMatchObject({
      version: 16,
      app: 'Worth',
    });
  });

  it('persists successful price quotes while preserving failed assets', async () => {
    repository.data.assets = [
      {
        id: 'rub',
        name: 'Ruble',
        code: 'RUB',
        icon: '₽',
        color: '#5667ff',
        price: 0.02,
        autoUpdateSource: 'frankfurter',
      },
      {
        id: 'eur',
        name: 'Euro',
        code: 'EUR',
        icon: '€',
        color: '#5667ff',
        price: 1.1,
        autoUpdateSource: 'frankfurter',
      },
    ];
    const app = service(
      new FixedPrices({
        quotes: [
          {
            assetId: 'rub',
            usdPrice: 0.01,
            source: { type: 'fiat', code: 'RUB' },
          },
        ],
        failures: [{ assetId: 'eur', provider: 'frankfurter' }],
        skipped: [],
      }),
    );
    await app.initialize();

    const result = await app.refreshPrices();

    expect(result).toEqual({
      updated: 1,
      skipped: 0,
      failures: [{ assetId: 'eur', provider: 'frankfurter' }],
    });
    expect(app.data.assets.find(({ id }) => id === 'rub')).toMatchObject({
      price: 0.01,
      priceUpdatedAt: now,
    });
    expect(app.data.assets.find(({ id }) => id === 'eur')?.price).toBe(1.1);
    expect(app.getDiagnostics()[0]).toMatchObject({
      level: 'warn',
      scope: 'prices',
      event: 'refresh.completed',
      context: { requested: 2, updated: 1, failed: 1, skipped: 0 },
    });

    app.clearDiagnostics();
    expect(app.getDiagnostics()).toEqual([]);
  });

  it('records completion times for manual price refreshes and snapshots', async () => {
    const app = service();
    await app.initialize();

    await app.refreshPrices();
    await app.saveSnapshot();

    expect(app.settings.lastPriceRefreshAt).toBe(now);
    expect(app.settings.lastSnapshotAt).toBe(now);
  });

  it('records a normally completed partial price refresh', async () => {
    const app = service(
      new FixedPrices({
        quotes: [],
        failures: [{ assetId: 'btc', provider: 'coingecko' }],
        skipped: [],
      }),
    );
    await app.initialize();

    await app.refreshPrices();

    expect(app.settings.lastPriceRefreshAt).toBe(now);
  });

  it('does not record a failed price refresh as completed', async () => {
    const app = service({
      getUsdPrices: () => Promise.reject(new Error('offline')),
    });
    await app.initialize();

    await expect(app.refreshPrices()).rejects.toThrow('offline');

    expect(app.settings.lastPriceRefreshAt).toBeUndefined();
  });

  it('replaces an earlier snapshot on the same local day', async () => {
    const app = service();
    await app.initialize();
    await app.saveSnapshot();

    now = new Date(2026, 7, 15, 18).getTime();
    await app.saveSnapshot();

    expect(app.data.snapshots).toEqual([
      expect.objectContaining({
        id: 'daily-snapshot:2026-08-15',
        createdAt: now,
      }),
    ]);
  });

  it('keeps snapshots from different local days', async () => {
    const app = service();
    await app.initialize();
    await app.saveSnapshot();

    now = new Date(2026, 7, 16, 9).getTime();
    await app.saveSnapshot();

    expect(app.data.snapshots.map(({ id }) => id)).toEqual([
      'daily-snapshot:2026-08-15',
      'daily-snapshot:2026-08-16',
    ]);
  });

  it('records only the latest successful quote per asset and day', async () => {
    let usdPrice = 45_000;
    const app = service({
      getUsdPrices: () =>
        Promise.resolve({
          quotes: [
            {
              assetId: 'btc',
              usdPrice,
              source: { type: 'crypto', id: 'bitcoin' },
            },
          ],
          failures: [],
          skipped: [],
        }),
    });
    repository.data.assets = [
      {
        id: 'btc',
        name: 'Bitcoin',
        code: 'BTC',
        icon: '₿',
        color: '#f7931a',
        price: 44_000,
        autoUpdateSource: 'coingecko',
      },
    ];
    await app.initialize();
    await app.refreshPrices('btc');

    usdPrice = 46_000;
    now = new Date(2026, 7, 15, 18).getTime();
    await app.refreshPrices('btc');

    expect(app.data.priceHistory).toEqual([
      expect.objectContaining({
        id: 'daily-price:btc:2026-08-15',
        assetId: 'btc',
        createdAt: now,
        usdPrice: 46_000,
      }),
    ]);
  });

  it('records a manual asset price in daily price history', async () => {
    repository.data.assets = [
      {
        id: 'gold',
        name: 'Gold',
        code: 'XAU',
        icon: 'Au',
        color: '#d9a520',
        price: 2_000,
        autoUpdateSource: 'none',
      },
    ];
    const app = service();
    await app.initialize();

    await app.updateAssetPrice('gold', 2_100, 'USD');

    expect(app.data.priceHistory).toEqual([
      expect.objectContaining({ assetId: 'gold', usdPrice: 2_100 }),
    ]);
  });
});
