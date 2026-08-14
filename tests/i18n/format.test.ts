import { describe, expect, it } from 'vitest';

import type { Asset } from '../../src/domain/models';
import {
  convertPriceCurrencyToUsd,
  convertUsdToDisplay,
  formatMoney,
  formatRelativeTime,
  inputDecimal,
  parseDecimal,
} from '../../src/i18n/format';

const euro: Asset = {
  id: 'eur',
  name: 'Euro',
  code: 'EUR',
  icon: '€',
  color: '#5667ff',
  price: 2,
  autoUpdateSource: 'none',
};

describe('locale and currency formatting', () => {
  it('parses localized decimal input without accepting trailing garbage', () => {
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('-0.25')).toBe(-0.25);
    expect(parseDecimal('12abc')).toBeNaN();
    expect(parseDecimal('')).toBeNaN();
  });

  it('formats editable decimal values for the selected language', () => {
    expect(inputDecimal(12.5, 'ru')).toBe('12,5');
    expect(inputDecimal('12,5', 'en')).toBe('12.5');
  });

  it('converts between canonical USD and an asset display currency', () => {
    expect(convertUsdToDisplay(100, euro)).toBe(50);
    expect(convertPriceCurrencyToUsd(50, 'EUR', [euro])).toBe(100);
    expect(convertPriceCurrencyToUsd(50, 'USD', [euro])).toBe(50);
  });

  it('formats USD and asset-denominated money like the legacy interface', () => {
    expect(formatMoney(12.5, 'en')).toBe('$12.50');
    expect(formatMoney(100, 'en', euro)).toBe('50 €');
  });

  it('formats relative update times in both languages', () => {
    expect(formatRelativeTime(9_000, 10_000, 'en')).toBe('just now');
    expect(formatRelativeTime(10_000 - 3_600_000, 10_000, 'ru')).toBe(
      '1 ч назад',
    );
  });
});
