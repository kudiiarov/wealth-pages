import type {
  PriceBatch,
  PriceFailure,
  PriceProvider,
  PriceQuote,
} from '../../application/ports';
import type { Asset, UnknownRecord } from '../../domain/models';

export const CRYPTO_PRICE_IDS: Readonly<Record<string, string>> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  XAUT: 'tether-gold',
  BNB: 'binancecoin',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  TON: 'the-open-network',
  TRX: 'tron',
  DOT: 'polkadot',
  LINK: 'chainlink',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  AVAX: 'avalanche-2',
  UNI: 'uniswap',
  DAI: 'dai',
  SHIB: 'shiba-inu',
  APT: 'aptos',
  SUI: 'sui',
};

interface FiatCacheEntry {
  unitsPerUsd: number;
  cachedAt: number;
}

interface CryptoTarget {
  asset: Asset;
  providerId: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class HttpPriceProvider implements PriceProvider {
  private readonly fiatCache = new Map<string, FiatCacheEntry>();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getUsdPrices(assets: readonly Asset[]): Promise<PriceBatch> {
    const quotes: PriceQuote[] = [];
    const failures: PriceFailure[] = [];
    const skipped: string[] = [];
    const fiatTargets: Asset[] = [];
    const cryptoTargets: CryptoTarget[] = [];

    for (const asset of assets) {
      if (asset.autoUpdateSource === 'frankfurter') {
        fiatTargets.push(asset);
      } else if (asset.autoUpdateSource === 'coingecko') {
        const providerId = CRYPTO_PRICE_IDS[asset.code.toUpperCase()];
        if (providerId) cryptoTargets.push({ asset, providerId });
        else skipped.push(asset.id);
      } else {
        skipped.push(asset.id);
      }
    }

    await Promise.all(
      fiatTargets.map(async (asset) => {
        const code = asset.code.toUpperCase();
        try {
          const unitsPerUsd = await this.fetchFiatUnitsPerUsd(code);
          quotes.push({
            assetId: asset.id,
            usdPrice: code === 'USD' ? 1 : 1 / unitsPerUsd,
            source: { type: 'fiat', code },
          });
        } catch {
          failures.push({ assetId: asset.id, provider: 'frankfurter' });
        }
      }),
    );

    if (cryptoTargets.length > 0) {
      await this.fetchCryptoQuotes(cryptoTargets, quotes, failures);
    }

    return { quotes, failures, skipped };
  }

  private async fetchFiatUnitsPerUsd(code: string): Promise<number> {
    if (code === 'USD') return 1;
    const cached = this.fiatCache.get(code);
    if (cached && this.now() - cached.cachedAt < 60_000)
      return cached.unitsPerUsd;

    const response = await this.fetcher(
      `https://api.frankfurter.dev/v2/rate/USD/${encodeURIComponent(code)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
    const payload: unknown = await response.json();
    const unitsPerUsd = isRecord(payload) ? Number(payload.rate) : Number.NaN;
    if (!(unitsPerUsd > 0)) throw new Error('Frankfurter invalid rate');

    this.fiatCache.set(code, { unitsPerUsd, cachedAt: this.now() });
    return unitsPerUsd;
  }

  private async fetchCryptoQuotes(
    targets: readonly CryptoTarget[],
    quotes: PriceQuote[],
    failures: PriceFailure[],
  ): Promise<void> {
    const providerIds = [
      ...new Set(targets.map(({ providerId }) => providerId)),
    ];
    const url =
      'https://api.coingecko.com/api/v3/simple/price' +
      `?ids=${encodeURIComponent(providerIds.join(','))}&vs_currencies=usd`;

    try {
      const response = await this.fetcher(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      const payload: unknown = await response.json();

      for (const { asset, providerId } of targets) {
        const record = isRecord(payload) ? payload[providerId] : undefined;
        const usdPrice = isRecord(record) ? Number(record.usd) : Number.NaN;
        if (usdPrice > 0) {
          quotes.push({
            assetId: asset.id,
            usdPrice,
            source: { type: 'crypto', id: providerId },
          });
        } else {
          failures.push({ assetId: asset.id, provider: 'coingecko' });
        }
      }
    } catch {
      failures.push(
        ...targets.map(({ asset }) => ({
          assetId: asset.id,
          provider: 'coingecko' as const,
        })),
      );
    }
  }
}
