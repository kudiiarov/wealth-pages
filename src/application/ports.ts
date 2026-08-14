import type {
  Account,
  AppSettings,
  Asset,
  PortfolioData,
  Position,
  Snapshot,
  StoreName,
} from '../domain/models';

export interface EntityByStore {
  accounts: Account;
  assets: Asset;
  positions: Position;
  snapshots: Snapshot;
}

export interface PortfolioRepository {
  load(): Promise<PortfolioData>;
  put<K extends StoreName>(store: K, value: EntityByStore[K]): Promise<void>;
  delete(store: StoreName, id: string): Promise<void>;
  replaceAll(data: PortfolioData): Promise<void>;
  clearAll(): Promise<void>;
}

export interface SettingsStore {
  load(): AppSettings;
  save(settings: Partial<AppSettings>): void;
}

export interface FileTransfer {
  downloadJson(filename: string, payload: unknown): void;
}

export interface Clock {
  now(): number;
  isoNow(): string;
}

export interface IdGenerator {
  next(): string;
}

export interface PriceQuote {
  assetId: string;
  usdPrice: number;
  source: { type: 'fiat' | 'crypto'; code?: string; id?: string };
}

export interface PriceFailure {
  assetId: string;
  provider: 'frankfurter' | 'coingecko';
}

export interface PriceBatch {
  quotes: PriceQuote[];
  failures: PriceFailure[];
  skipped: string[];
}

export interface PriceProvider {
  getUsdPrices(assets: readonly Asset[]): Promise<PriceBatch>;
}
