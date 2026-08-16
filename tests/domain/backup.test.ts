import { describe, expect, it } from 'vitest';

import { createBackup, validateBackup } from '../../src/domain/backup';
import type { AppSettings } from '../../src/domain/models';
import { currentV14, legacyV1 } from '../fixtures/legacy-backups';

describe('backup validation and serialization', () => {
  it('imports legacy symbol assets and supplies position comments', () => {
    const backup = validateBackup(legacyV1);

    expect(backup.version).toBe(1);
    expect(backup.data.assets[0]?.code).toBe('USD');
    expect(backup.data.positions[0]?.comment).toBe('');
  });

  it('restores valid application settings from schema 14', () => {
    const backup = validateBackup(currentV14);

    expect(backup.version).toBe(14);
    expect(backup.settings).toEqual({
      language: 'en',
      theme: 'dark',
      displayCurrency: 'USD',
      pnlPeriod: 'last',
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
    });
  });

  it('accepts every published backup schema version', () => {
    for (let version = 1; version <= 16; version += 1) {
      expect(validateBackup({ ...currentV14, version }).version).toBe(version);
    }
  });

  it('rejects broken references before normalization can hide bad values', () => {
    expect(() =>
      validateBackup({
        ...currentV14,
        positions: [
          { id: 'p', accountId: 'missing', assetId: 'usd', quantity: 1 },
        ],
      }),
    ).toThrow('Повреждены позиции');
  });

  it('rejects non-numeric prices and unsupported future schemas', () => {
    expect(() =>
      validateBackup({
        ...currentV14,
        assets: [{ ...currentV14.assets[0], price: 'not-a-number' }],
      }),
    ).toThrow('Повреждены активы');
    expect(() => validateBackup({ ...currentV14, version: 17 })).toThrow(
      'Неподдерживаемая версия резервной копии',
    );
  });

  it('serializes the canonical schema without sharing entity references', () => {
    const validated = validateBackup(currentV14);
    const settings: AppSettings = {
      language: 'en',
      theme: 'dark',
      displayCurrency: 'USD',
      pnlPeriod: 'last',
      priceRefreshIntervalMinutes: 15,
      lastPriceRefreshAt: 1_700_000_000_000,
      snapshotIntervalMinutes: 30,
      lastSnapshotAt: 1_700_000_100_000,
      positionGrouping: 'assets',
      balancesHidden: true,
      selectedRateAssetIds: ['btc'],
      ratePairs: [{ sourceAssetId: 'btc', quoteAssetId: 'usd' }],
    };
    const backup = createBackup(
      validated.data,
      settings,
      '2026-08-14T00:00:00.000Z',
    );

    expect(backup).toMatchObject({
      app: 'Worth',
      version: 16,
      appVersion: '3.8.1-final',
      baseCurrency: 'USD',
      exportedAt: '2026-08-14T00:00:00.000Z',
      appSettings: settings,
    });
    expect(backup.accounts).not.toBe(validated.data.accounts);
    expect(backup.priceHistory).not.toBe(validated.data.priceHistory);
    expect(backup.appSettings.selectedRateAssetIds).not.toBe(
      settings.selectedRateAssetIds,
    );
    expect(backup.appSettings.ratePairs).not.toBe(settings.ratePairs);
    expect(validateBackup(backup).settings?.ratePairs).toEqual([
      { sourceAssetId: 'btc', quoteAssetId: 'usd' },
    ]);
    expect(validateBackup(backup).settings?.selectedRateAssetIds).toEqual([
      'btc',
    ]);
  });

  it('migrates legacy selected rates to the saved display currency', () => {
    const backup = validateBackup({
      ...currentV14,
      appSettings: {
        displayCurrency: 'USD',
        selectedRateAssetIds: ['usd'],
      },
    });

    expect(backup.settings?.ratePairs).toEqual([
      { sourceAssetId: 'usd', quoteAssetId: 'usd' },
    ]);
  });

  it('round-trips custom taxonomy without sharing tag arrays', () => {
    const validated = validateBackup({
      ...currentV14,
      assets: [
        {
          ...currentV14.assets[0],
          category: 'Commodities',
          tags: ['Energy', 'Long term'],
        },
      ],
    });
    const settings = validateBackup(currentV14).settings as AppSettings;
    const backup = createBackup(
      validated.data,
      settings,
      '2026-08-14T00:00:00.000Z',
    );

    expect(validateBackup(backup).data.assets[0]).toMatchObject({
      category: 'Commodities',
      tags: ['Energy', 'Long term'],
    });
    expect(backup.assets[0]?.tags).not.toBe(validated.data.assets[0]?.tags);
  });

  it('ignores invalid schema 16 scheduling settings', () => {
    const backup = validateBackup({
      ...currentV14,
      version: 16,
      appSettings: {
        ...currentV14.appSettings,
        priceRefreshIntervalMinutes: 2,
        snapshotIntervalMinutes: 'daily',
        lastPriceRefreshAt: -1,
        lastSnapshotAt: 'tomorrow',
        positionGrouping: 'brokers',
      },
    });

    expect(backup.settings).toMatchObject({
      priceRefreshIntervalMinutes: 60,
      snapshotIntervalMinutes: 0,
    });
    expect(backup.settings).not.toHaveProperty('lastPriceRefreshAt');
    expect(backup.settings).not.toHaveProperty('lastSnapshotAt');
    expect(backup.settings).not.toHaveProperty('positionGrouping');
  });
});
