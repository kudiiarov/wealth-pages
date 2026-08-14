import type { SettingsStore } from '../../application/ports';
import type { AppSettings } from '../../domain/models';

export const SETTINGS_KEYS = {
  language: 'worth-language',
  theme: 'worth-theme',
  displayCurrency: 'worth-display-currency',
  pnlPeriod: 'worth-pnl-period',
  autoRefreshOnLaunch: 'worth-auto-refresh-launch',
} as const;

export class BrowserSettingsStore implements SettingsStore {
  constructor(private readonly storage: Storage = localStorage) {}

  load(): AppSettings {
    const language = this.storage.getItem(SETTINGS_KEYS.language);
    const theme = this.storage.getItem(SETTINGS_KEYS.theme);
    const displayCurrency = this.storage.getItem(SETTINGS_KEYS.displayCurrency);
    const pnlPeriod = this.storage.getItem(SETTINGS_KEYS.pnlPeriod);

    return {
      language: language === 'en' ? 'en' : 'ru',
      theme: theme === 'dark' ? 'dark' : 'light',
      displayCurrency: displayCurrency?.trim() || 'USD',
      pnlPeriod: pnlPeriod === 'last' ? 'last' : 'all',
      autoRefreshOnLaunch:
        this.storage.getItem(SETTINGS_KEYS.autoRefreshOnLaunch) === '1',
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
    if (settings.autoRefreshOnLaunch !== undefined) {
      this.storage.setItem(
        SETTINGS_KEYS.autoRefreshOnLaunch,
        settings.autoRefreshOnLaunch ? '1' : '0',
      );
    }
  }
}
