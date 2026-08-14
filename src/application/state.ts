import type { AppSettings, PortfolioData } from '../domain/models';

export interface AppState extends PortfolioData, AppSettings {
  historyScope: string;
  expandedAccounts: Set<string>;
  expandedAssets: Set<string>;
}

export function createInitialState(settings: AppSettings): AppState {
  return {
    accounts: [],
    assets: [],
    positions: [],
    snapshots: [],
    ...settings,
    historyScope: 'portfolio',
    expandedAccounts: new Set(),
    expandedAssets: new Set(),
  };
}
