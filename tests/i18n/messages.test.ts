import { describe, expect, it } from 'vitest';

import { messages, translate } from '../../src/i18n/messages';

describe('localized messages', () => {
  it('keeps Russian and English key sets identical', () => {
    expect(Object.keys(messages.en).sort()).toEqual(
      Object.keys(messages.ru).sort(),
    );
  });

  it('returns static and parameterized messages without exposing internal keys', () => {
    expect(translate('en', 'pnlVsLast')).toBe('Since last snapshot');
    expect(translate('ru', 'pricesUpdated', 2)).toBe('Цены обновлены: 2');
    expect(translate('en', 'confirmDeleteAsset', 'Bitcoin', 'BTC')).toBe(
      'Delete Bitcoin (BTC) and all positions using this asset?',
    );
  });

  it('uses correct Russian asset declensions', () => {
    expect(translate('ru', 'assetsCount', 1)).toBe('1 актив');
    expect(translate('ru', 'assetsCount', 2)).toBe('2 актива');
    expect(translate('ru', 'assetsCount', 5)).toBe('5 активов');
    expect(translate('ru', 'assetsCount', 11)).toBe('11 активов');
  });

  it('localizes automation intervals and keeps snapshot copy implementation-neutral', () => {
    expect(translate('ru', 'hoursLabel', 3)).toBe('3 ч');
    expect(translate('en', 'hoursLabel', 1)).toBe('1 hour');
    expect(translate('en', 'hoursLabel', 6)).toBe('6 hours');
    expect(translate('ru', 'minutesLabel', 30)).toBe('30 минут');
    expect(translate('en', 'minutesLabel', 60)).toBe('60 minutes');
    expect(translate('en', 'autoSnapshotSub')).toBe(
      'Automatically create portfolio history',
    );
  });
});
