export type EntityId = string;
export type Language = 'ru' | 'en';
export type Theme = 'light' | 'dark';
export type PnlPeriod = 'all' | 'last';
export type AutoUpdateSource = 'none' | 'coingecko' | 'frankfurter';

export interface Account {
  [key: string]: unknown;
  id: EntityId;
  name: string;
  type: string;
  icon: string;
  color: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PriceSource {
  type: 'fiat' | 'crypto';
  code?: string;
  id?: string;
}

export interface Asset {
  [key: string]: unknown;
  id: EntityId;
  name: string;
  code: string;
  icon: string;
  color: string;
  price: number;
  autoUpdateSource: AutoUpdateSource;
  priceSource?: PriceSource;
  priceUpdatedAt?: number;
  manualPriceCurrency?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Position {
  [key: string]: unknown;
  id: EntityId;
  accountId: EntityId;
  assetId: EntityId;
  quantity: number;
  comment: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SnapshotAccount {
  [key: string]: unknown;
  accountId: EntityId;
  name: string;
  total: number;
}

export interface SnapshotAsset {
  [key: string]: unknown;
  assetId: EntityId;
  code: string;
  name?: string;
  icon?: string;
  color?: string;
  price?: number;
  quantity?: number;
  value?: number;
}

export interface SnapshotPosition {
  [key: string]: unknown;
  positionId: EntityId;
  accountId: EntityId;
  accountName: string;
  assetId: EntityId;
  assetCode: string;
  assetName?: string;
  comment: string;
  quantity: number;
  price: number;
  value: number;
}

export interface Snapshot {
  [key: string]: unknown;
  id: EntityId;
  createdAt: number;
  total: number;
  accounts?: SnapshotAccount[];
  assets?: SnapshotAsset[];
  positions?: SnapshotPosition[];
}

export interface PortfolioData {
  accounts: Account[];
  assets: Asset[];
  positions: Position[];
  snapshots: Snapshot[];
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  displayCurrency: string;
  pnlPeriod: PnlPeriod;
  autoRefreshOnLaunch: boolean;
}

export type StoreName = keyof PortfolioData;
export type PortfolioEntity = Account | Asset | Position | Snapshot;
export type UnknownRecord = Record<string, unknown>;
