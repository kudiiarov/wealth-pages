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
    expect(backup.settings).toEqual(currentV14.appSettings);
  });

  it('accepts every published backup schema version', () => {
    for (let version = 1; version <= 14; version += 1) {
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
    expect(() => validateBackup({ ...currentV14, version: 15 })).toThrow(
      'Неподдерживаемая версия резервной копии',
    );
  });

  it('serializes the canonical schema without sharing entity references', () => {
    const validated = validateBackup(currentV14);
    const settings: AppSettings = currentV14.appSettings;
    const backup = createBackup(
      validated.data,
      settings,
      '2026-08-14T00:00:00.000Z',
    );

    expect(backup).toMatchObject({
      app: 'Worth',
      version: 14,
      appVersion: '3.0-final',
      baseCurrency: 'USD',
      exportedAt: '2026-08-14T00:00:00.000Z',
      appSettings: settings,
    });
    expect(backup.accounts).not.toBe(validated.data.accounts);
  });
});
