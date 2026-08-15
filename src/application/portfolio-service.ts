import { createBackup, validateBackup } from '../domain/backup';
import {
  dailyPriceHistoryId,
  dailySnapshotId,
  localDayKey,
} from '../domain/daily-history';
import type {
  Account,
  AppSettings,
  Asset,
  AutoUpdateSource,
  PortfolioData,
  Position,
  PriceSource,
} from '../domain/models';
import {
  cleanCode,
  normalizeAccount,
  normalizeAsset,
} from '../domain/normalize';
import { buildSnapshot } from '../domain/snapshots';
import type {
  Clock,
  DiagnosticEntry,
  DiagnosticLog,
  FileTransfer,
  IdGenerator,
  PortfolioRepository,
  PriceFailure,
  PriceProvider,
  SettingsStore,
} from './ports';

export interface PortfolioServiceDependencies {
  repository: PortfolioRepository;
  settings: SettingsStore;
  files: FileTransfer;
  diagnostics: DiagnosticLog;
  prices: PriceProvider;
  clock: Clock;
  ids: IdGenerator;
}

export interface AccountInput {
  name: string;
  type: string;
  icon: string;
  color: string;
}

export interface AssetInput {
  name: string;
  code: string;
  icon: string;
  color: string;
  price: number;
  autoUpdateSource: AutoUpdateSource;
  category?: string;
  tags?: string[];
}

export interface PositionInput {
  id?: string;
  accountId: string;
  assetId: string;
  quantity: number;
  comment: string;
}

export interface PriceRefreshResult {
  updated: number;
  skipped: number;
  failures: PriceFailure[];
}

const emptyData = (): PortfolioData => ({
  accounts: [],
  assets: [],
  positions: [],
  snapshots: [],
  priceHistory: [],
});

export class PortfolioService {
  private portfolio: PortfolioData = emptyData();
  private appSettings: AppSettings;

  constructor(private readonly dependencies: PortfolioServiceDependencies) {
    this.appSettings = dependencies.settings.load();
  }

  get data(): PortfolioData {
    return this.portfolio;
  }

  get settings(): AppSettings {
    return this.appSettings;
  }

  getDiagnostics(): DiagnosticEntry[] {
    return this.dependencies.diagnostics.list();
  }

  clearDiagnostics(): void {
    this.dependencies.diagnostics.clear();
  }

  async initialize(): Promise<void> {
    this.appSettings = this.dependencies.settings.load();
    await this.reload();
  }

  async reload(): Promise<void> {
    this.portfolio = await this.dependencies.repository.load();
    this.portfolio.accounts.sort((left, right) =>
      left.name.localeCompare(right.name, 'ru'),
    );
    this.portfolio.assets.sort((left, right) =>
      left.code.localeCompare(right.code, 'ru'),
    );
    this.portfolio.snapshots.sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    this.portfolio.priceHistory.sort(
      (left, right) => left.createdAt - right.createdAt,
    );
  }

  async createAccount(input: AccountInput): Promise<Account> {
    const account = normalizeAccount({
      ...input,
      id: this.dependencies.ids.next(),
      createdAt: this.dependencies.clock.now(),
    });
    if (!account.name) throw new Error('Account name is required');
    await this.dependencies.repository.put('accounts', account);
    await this.reload();
    return account;
  }

  async updateAccount(id: string, input: AccountInput): Promise<Account> {
    const current = this.portfolio.accounts.find(
      (account) => account.id === id,
    );
    if (!current) throw new Error('Account not found');
    const account = normalizeAccount({
      ...current,
      ...input,
      updatedAt: this.dependencies.clock.now(),
    });
    if (!account.name) throw new Error('Account name is required');
    await this.dependencies.repository.put('accounts', account);
    await this.reload();
    return account;
  }

  async deleteAccount(id: string): Promise<void> {
    for (const position of this.portfolio.positions.filter(
      ({ accountId }) => accountId === id,
    )) {
      await this.dependencies.repository.delete('positions', position.id);
    }
    await this.dependencies.repository.delete('accounts', id);
    await this.reload();
  }

  async createAsset(input: AssetInput): Promise<Asset> {
    const code = cleanCode(input.code);
    this.assertUniqueAssetCode(code);
    const asset = normalizeAsset({
      ...input,
      code,
      id: this.dependencies.ids.next(),
      createdAt: this.dependencies.clock.now(),
      updatedAt: this.dependencies.clock.now(),
    });
    this.assertValidAsset(asset);
    await this.dependencies.repository.put('assets', asset);
    await this.reload();
    return asset;
  }

  async updateAsset(id: string, input: AssetInput): Promise<Asset> {
    const current = this.portfolio.assets.find((asset) => asset.id === id);
    if (!current) throw new Error('Asset not found');
    const code = cleanCode(input.code);
    this.assertUniqueAssetCode(code, id);
    const asset = normalizeAsset({
      ...current,
      ...input,
      code,
      updatedAt: this.dependencies.clock.now(),
    });
    this.assertValidAsset(asset);
    await this.dependencies.repository.put('assets', asset);
    await this.reload();
    return asset;
  }

  async deleteAsset(id: string): Promise<void> {
    for (const position of this.portfolio.positions.filter(
      ({ assetId }) => assetId === id,
    )) {
      await this.dependencies.repository.delete('positions', position.id);
    }
    await this.dependencies.repository.delete('assets', id);
    await this.reload();
  }

  async savePosition(input: PositionInput): Promise<Position> {
    if (!this.portfolio.accounts.some(({ id }) => id === input.accountId)) {
      throw new Error('Account not found');
    }
    if (!this.portfolio.assets.some(({ id }) => id === input.assetId)) {
      throw new Error('Asset not found');
    }
    if (!Number.isFinite(input.quantity)) throw new Error('Invalid quantity');

    const current = input.id
      ? this.portfolio.positions.find(({ id }) => id === input.id)
      : undefined;
    const position: Position = {
      id: current?.id ?? this.dependencies.ids.next(),
      accountId: input.accountId,
      assetId: input.assetId,
      quantity: input.quantity,
      comment: input.comment.trim(),
      createdAt: current?.createdAt ?? this.dependencies.clock.now(),
      updatedAt: this.dependencies.clock.now(),
    };
    await this.dependencies.repository.put('positions', position);
    await this.reload();
    return position;
  }

  async deletePosition(id: string): Promise<void> {
    await this.dependencies.repository.delete('positions', id);
    await this.reload();
  }

  async saveSnapshot(): Promise<void> {
    const now = this.dependencies.clock.now();
    const dayKey = localDayKey(now);
    const snapshot = buildSnapshot(
      this.portfolio,
      dailySnapshotId(dayKey),
      now,
    );
    await this.dependencies.repository.put('snapshots', snapshot);
    for (const previous of this.portfolio.snapshots) {
      if (
        previous.id !== snapshot.id &&
        localDayKey(previous.createdAt) === dayKey
      ) {
        await this.dependencies.repository.delete('snapshots', previous.id);
      }
    }
    await this.reload();
    this.saveSettings({ lastSnapshotAt: now });
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.dependencies.repository.delete('snapshots', id);
    await this.reload();
  }

  async updateAssetPrice(
    id: string,
    price: number,
    manualPriceCurrency: string,
  ): Promise<void> {
    const asset = this.portfolio.assets.find(
      (candidate) => candidate.id === id,
    );
    if (!asset || !Number.isFinite(price) || price < 0) {
      throw new Error('Invalid asset price');
    }
    const now = this.dependencies.clock.now();
    await this.dependencies.repository.put('assets', {
      ...asset,
      price,
      manualPriceCurrency,
      updatedAt: now,
    });
    await this.saveDailyPrice(asset.id, price, now);
    await this.reload();
  }

  async refreshPrices(assetId?: string): Promise<PriceRefreshResult> {
    const targets = this.portfolio.assets.filter(
      (asset) =>
        asset.autoUpdateSource !== 'none' &&
        (assetId === undefined || asset.id === assetId),
    );
    const batch = await this.dependencies.prices.getUsdPrices(targets);
    const now = this.dependencies.clock.now();
    let updated = 0;

    for (const quote of batch.quotes) {
      const asset = this.portfolio.assets.find(
        ({ id }) => id === quote.assetId,
      );
      if (!asset || !(quote.usdPrice > 0)) continue;
      await this.dependencies.repository.put('assets', {
        ...asset,
        price: quote.usdPrice,
        priceSource: quote.source,
        priceUpdatedAt: now,
        updatedAt: now,
      });
      await this.saveDailyPrice(
        asset.id,
        quote.usdPrice,
        now,
        quote.source,
      );
      updated += 1;
    }

    await this.reload();
    this.dependencies.diagnostics.record({
      level:
        batch.failures.length === 0 ? 'info' : updated > 0 ? 'warn' : 'error',
      scope: 'prices',
      event: 'refresh.completed',
      context: {
        requested: targets.length,
        updated,
        failed: batch.failures.length,
        skipped: batch.skipped.length,
      },
    });
    this.saveSettings({ lastPriceRefreshAt: now });
    return {
      updated,
      skipped: batch.skipped.length,
      failures: batch.failures,
    };
  }

  async importBackup(json: string): Promise<void> {
    const validated = validateBackup(JSON.parse(json) as unknown);
    await this.dependencies.repository.replaceAll(validated.data);
    if (validated.settings) {
      this.dependencies.settings.save(validated.settings);
      this.appSettings = { ...this.appSettings, ...validated.settings };
    }
    await this.reload();
  }

  exportBackup(): void {
    const exportedAt = this.dependencies.clock.isoNow();
    this.dependencies.files.downloadJson(
      `worth-backup-${exportedAt.slice(0, 10)}.json`,
      createBackup(this.portfolio, this.appSettings, exportedAt),
    );
  }

  saveSettings(settings: Partial<AppSettings>): void {
    this.dependencies.settings.save(settings);
    this.appSettings = { ...this.appSettings, ...settings };
  }

  async reset(): Promise<void> {
    await this.dependencies.repository.clearAll();
    await this.reload();
  }

  private assertUniqueAssetCode(code: string, exceptId?: string): void {
    if (
      this.portfolio.assets.some(
        (asset) => asset.id !== exceptId && asset.code === code,
      )
    ) {
      throw new Error('Duplicate asset code');
    }
  }

  private async saveDailyPrice(
    assetId: string,
    usdPrice: number,
    createdAt: number,
    source?: PriceSource,
  ): Promise<void> {
    const dayKey = localDayKey(createdAt);
    const id = dailyPriceHistoryId(assetId, dayKey);
    await this.dependencies.repository.put('priceHistory', {
      id,
      assetId,
      dayKey,
      createdAt,
      usdPrice,
      ...(source ? { source: { ...source } } : {}),
    });
    for (const previous of this.portfolio.priceHistory) {
      if (
        previous.assetId === assetId &&
        previous.id !== id &&
        localDayKey(previous.createdAt) === dayKey
      ) {
        await this.dependencies.repository.delete('priceHistory', previous.id);
      }
    }
  }

  private assertValidAsset(asset: Asset): void {
    if (
      !asset.name ||
      !asset.code ||
      !Number.isFinite(asset.price) ||
      asset.price < 0
    ) {
      throw new Error('Invalid asset');
    }
  }
}
