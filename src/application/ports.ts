import type {
  Account,
  AppSettings,
  Asset,
  PortfolioData,
  Position,
  PriceHistoryPoint,
  Snapshot,
  StoreName,
} from '../domain/models';

export interface EntityByStore {
  accounts: Account;
  assets: Asset;
  positions: Position;
  snapshots: Snapshot;
  priceHistory: PriceHistoryPoint;
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

export type DiagnosticLevel = 'info' | 'warn' | 'error';
export type DiagnosticValue = string | number | boolean | null;

export interface DiagnosticEntry {
  id: string;
  createdAt: number;
  level: DiagnosticLevel;
  scope: string;
  event: string;
  message?: string;
  context?: Record<string, DiagnosticValue>;
}

export type DiagnosticEvent = Omit<DiagnosticEntry, 'id' | 'createdAt'>;

export interface DiagnosticLog {
  record(event: DiagnosticEvent): void;
  list(): DiagnosticEntry[];
  clear(): void;
}

export const NOOP_DIAGNOSTIC_LOG: DiagnosticLog = {
  record: () => undefined,
  list: () => [],
  clear: () => undefined,
};

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
