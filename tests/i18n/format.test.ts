import { describe, expect, it } from 'vitest';

import type { Asset } from '../../src/domain/models';
import {
  convertPriceCurrencyToUsd,
  convertUsdToDisplay,
  formatDisplayExactMoney,
  formatDisplayMoney,
  formatExactMoney,
  formatMoney,
  formatPrice,
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

  it('formats already converted display money without converting it again', () => {
    const rubAsset: Asset = {
      ...euro,
      id: 'rub',
      name: 'Ruble',
      code: 'RUB',
      icon: '₽',
      price: 0.011,
    };

    expect(formatDisplayMoney(15.48, 'en', rubAsset)).toBe('15.48 ₽');
    expect(formatMoney(15.48 * rubAsset.price, 'en', rubAsset)).toBe('15.48 ₽');
  });

  it('keeps two decimal places for exact chart inspection values', () => {
    expect(formatExactMoney(12.345, 'en')).toBe('$12.35');
    expect(formatExactMoney(2_469.12, 'en', euro)).toBe('1,234.56 €');
  });

  it('formats already converted exact chart money without converting it again', () => {
    const rubAsset: Asset = {
      ...euro,
      id: 'rub',
      name: 'Ruble',
      code: 'RUB',
      icon: '₽',
      price: 0.011,
    };

    expect(formatDisplayExactMoney(4_840, 'en', rubAsset)).toBe('4,840.00 ₽');
    expect(formatExactMoney(4_840 * rubAsset.price, 'en', rubAsset)).toBe(
      '4,840.00 ₽',
    );
  });

  it('shows enough precision for sub-dollar asset prices without changing balances', () => {
    expect(formatPrice(1 / 86, 'en')).toBe('$0.0116');
    expect(formatMoney(1 / 86, 'en')).toBe('$0.01');
    expect(formatMoney(2_469.12, 'en', euro)).toBe('1,235 €');
  });

  it('formats relative update times in both languages', () => {
    expect(formatRelativeTime(9_000, 10_000, 'en')).toBe('just now');
    expect(formatRelativeTime(10_000 - 3_600_000, 10_000, 'ru')).toBe(
      '1 ч назад',
    );
  });
});
