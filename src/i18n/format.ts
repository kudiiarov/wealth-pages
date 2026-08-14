import type { Asset, Language } from '../domain/models';

export function locale(language: Language): 'ru-RU' | 'en-US' {
  return language === 'en' ? 'en-US' : 'ru-RU';
}

export function parseDecimal(value: unknown): number {
  const normalized =
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim().replace(/\s+/g, '').replace(',', '.')
      : '';
  if (!normalized || !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return Number.NaN;
  }
  return Number(normalized);
}

export function inputDecimal(
  value: string | number,
  language: Language,
): string {
  const text = String(value);
  return language === 'en' ? text.replace(',', '.') : text.replace('.', ',');
}

export function convertUsdToDisplay(usdValue: number, asset?: Asset): number {
  const rate = Number(asset?.price);
  return asset && rate > 0
    ? Number(usdValue || 0) / rate
    : Number(usdValue || 0);
}

export function convertPriceCurrencyToUsd(
  amount: number,
  code: string,
  assets: readonly Asset[],
): number {
  if (!Number.isFinite(amount)) return Number.NaN;
  if (code === 'USD') return amount;
  const rate = Number(assets.find((asset) => asset.code === code)?.price);
  return rate > 0 ? amount * rate : Number.NaN;
}

export function convertUsdToPriceCurrency(
  usdValue: number,
  code: string,
  assets: readonly Asset[],
): number {
  if (!Number.isFinite(usdValue)) return Number.NaN;
  if (code === 'USD') return usdValue;
  const rate = Number(assets.find((asset) => asset.code === code)?.price);
  return rate > 0 ? usdValue / rate : Number.NaN;
}

export function formatMoney(
  usdValue: number,
  language: Language,
  displayAsset?: Asset,
): string {
  if (!displayAsset || !(Number(displayAsset.price) > 0)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(usdValue) || 0);
  }

  const amount = convertUsdToDisplay(usdValue, displayAsset);
  const absolute = Math.abs(amount);
  const maximumFractionDigits = absolute >= 1000 ? 0 : absolute >= 10 ? 2 : 4;
  const formatted = new Intl.NumberFormat(locale(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
  return `${formatted} ${displayAsset.icon || displayAsset.code}`;
}

export function formatExactMoney(
  usdValue: number,
  language: Language,
  displayAsset?: Asset,
): string {
  if (!displayAsset || !(Number(displayAsset.price) > 0)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(usdValue) || 0);
  }
  const amount = convertUsdToDisplay(usdValue, displayAsset);
  const formatted = new Intl.NumberFormat(locale(language), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${displayAsset.icon || displayAsset.code}`;
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: 8,
  }).format(Number(value) || 0);
}

export function formatRelativeTime(
  timestamp: number | undefined,
  now: number,
  language: Language,
): string {
  if (!timestamp)
    return language === 'en'
      ? 'Never auto-updated'
      : 'Не обновлялось автоматически';
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (language === 'en') {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
  }
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} ч назад` : `${Math.floor(hours / 24)} дн назад`;
}

export function formatDate(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function formatShortDate(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

export function formatTime(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
