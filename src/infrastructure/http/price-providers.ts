import type {
  DiagnosticLog,
  PriceBatch,
  PriceFailure,
  PriceProvider,
  PriceQuote,
} from '../../application/ports';
import { NOOP_DIAGNOSTIC_LOG } from '../../application/ports';
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

interface HttpPriceProviderOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  diagnostics?: DiagnosticLog;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class HttpPriceProvider implements PriceProvider {
  private readonly fiatCache = new Map<string, FiatCacheEntry>();
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly diagnostics: DiagnosticLog;

  constructor(options: HttpPriceProviderOptions = {}) {
    this.fetcher =
      options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.now = options.now ?? Date.now;
    this.diagnostics = options.diagnostics ?? NOOP_DIAGNOSTIC_LOG;
  }

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
        else {
          skipped.push(asset.id);
          this.diagnostics.record({
            level: 'warn',
            scope: 'prices',
            event: 'asset.skipped',
            context: {
              asset: asset.code,
              provider: 'coingecko',
              reason: 'unsupported-code',
            },
          });
        }
      } else {
        skipped.push(asset.id);
        this.diagnostics.record({
          level: 'info',
          scope: 'prices',
          event: 'asset.skipped',
          context: {
            asset: asset.code,
            provider: 'none',
            reason: 'unconfigured',
          },
        });
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
    if (code === 'USD') {
      this.diagnostics.record({
        level: 'info',
        scope: 'prices',
        event: 'price.local',
        context: { provider: 'frankfurter', assets: code },
      });
      return 1;
    }
    const cached = this.fiatCache.get(code);
    if (cached && this.now() - cached.cachedAt < 60_000) {
      this.diagnostics.record({
        level: 'info',
        scope: 'prices',
        event: 'cache.hit',
        context: { provider: 'frankfurter', assets: code },
      });
      return cached.unitsPerUsd;
    }

    const url = `https://api.frankfurter.dev/v2/rate/USD/${encodeURIComponent(code)}`;
    this.diagnostics.record({
      level: 'info',
      scope: 'prices',
      event: 'request.started',
      context: { provider: 'frankfurter', assets: code, url },
    });
    let status: number | undefined;
    try {
      // Request.cache can trigger a rejected CORS preflight in WebKit PWAs.
      const response = await this.fetcher(url);
      status = response.status;
      if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
      const payload: unknown = await response.json();
      const unitsPerUsd = isRecord(payload) ? Number(payload.rate) : Number.NaN;
      if (!(unitsPerUsd > 0)) throw new Error('Frankfurter invalid rate');

      this.diagnostics.record({
        level: 'info',
        scope: 'prices',
        event: 'request.succeeded',
        context: { provider: 'frankfurter', assets: code, status, url },
      });

      this.fiatCache.set(code, { unitsPerUsd, cachedAt: this.now() });
      return unitsPerUsd;
    } catch (error) {
      this.diagnostics.record({
        level: 'error',
        scope: 'prices',
        event: 'request.failed',
        message: error instanceof Error ? error.message : String(error),
        context: {
          provider: 'frankfurter',
          assets: code,
          ...(status === undefined ? {} : { status }),
          url,
        },
      });
      throw error;
    }
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
    const assetCodes = targets.map(({ asset }) => asset.code).join(',');
    this.diagnostics.record({
      level: 'info',
      scope: 'prices',
      event: 'request.started',
      context: { provider: 'coingecko', assets: assetCodes, url },
    });
    let status: number | undefined;

    try {
      // Keep this a simple CORS request for installed Safari PWAs.
      const response = await this.fetcher(url);
      status = response.status;
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      const payload: unknown = await response.json();
      this.diagnostics.record({
        level: 'info',
        scope: 'prices',
        event: 'request.succeeded',
        context: {
          provider: 'coingecko',
          assets: assetCodes,
          status,
          url,
        },
      });

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
          this.diagnostics.record({
            level: 'warn',
            scope: 'prices',
            event: 'quote.missing',
            context: {
              asset: asset.code,
              provider: 'coingecko',
              providerId,
            },
          });
        }
      }
    } catch (error) {
      this.diagnostics.record({
        level: 'error',
        scope: 'prices',
        event: 'request.failed',
        message: error instanceof Error ? error.message : String(error),
        context: {
          provider: 'coingecko',
          assets: assetCodes,
          ...(status === undefined ? {} : { status }),
          url,
        },
      });
      failures.push(
        ...targets.map(({ asset }) => ({
          assetId: asset.id,
          provider: 'coingecko' as const,
        })),
      );
    }
  }
}
