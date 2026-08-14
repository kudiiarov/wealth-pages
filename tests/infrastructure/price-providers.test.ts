import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DiagnosticEvent,
  DiagnosticLog,
} from '../../src/application/ports';
import type { Asset } from '../../src/domain/models';
import { HttpPriceProvider } from '../../src/infrastructure/http/price-providers';

function asset(code: string, source: Asset['autoUpdateSource']): Asset {
  return {
    id: code.toLowerCase(),
    name: code,
    code,
    icon: code,
    color: '#5667ff',
    price: 1,
    autoUpdateSource: source,
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

class CapturingDiagnosticLog implements DiagnosticLog {
  readonly events: DiagnosticEvent[] = [];

  record(event: DiagnosticEvent): void {
    this.events.push(structuredClone(event));
  }

  list() {
    return [];
  }

  clear(): void {
    this.events.length = 0;
  }
}

describe('HttpPriceProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
  });

  it('calls the default fetch with its global Window receiver', async () => {
    const originalFetch = globalThis.fetch;
    const strictWindowFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        return Promise.reject(
          new TypeError('Can only call Window.fetch on instances of Window'),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ bitcoin: { usd: 100_000 } })),
      );
    }) as typeof fetch;
    globalThis.fetch = strictWindowFetch;

    try {
      const provider = new HttpPriceProvider();
      const result = await provider.getUsdPrices([asset('BTC', 'coingecko')]);

      expect(result.quotes[0]?.usdPrice).toBe(100_000);
      expect(result.failures).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('converts Frankfurter units-per-USD into USD per asset unit', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ rate: 90 })));
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => 10_000,
    });

    const result = await provider.getUsdPrices([asset('RUB', 'frankfurter')]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/USD/RUB',
    );
    expect(result.quotes[0]).toMatchObject({
      assetId: 'rub',
      usdPrice: 1 / 90,
      source: { type: 'fiat', code: 'RUB' },
    });
  });

  it('batches supported crypto assets in one CoinGecko request', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ bitcoin: { usd: 100_000 }, ethereum: { usd: 4_000 } }),
      ),
    );
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => 10_000,
    });

    const result = await provider.getUsdPrices([
      asset('BTC', 'coingecko'),
      asset('ETH', 'coingecko'),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
    const requested = fetchMock.mock.calls[0]?.[0];
    expect(requested).toBeDefined();
    expect(requestUrl(requested!)).toContain(
      'ids=bitcoin%2Cethereum&vs_currencies=usd',
    );
    expect(result.quotes.map(({ usdPrice }) => usdPrice)).toEqual([
      100_000, 4_000,
    ]);
  });

  it('skips unknown and unconfigured assets instead of guessing', async () => {
    const diagnostics = new CapturingDiagnosticLog();
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => 10_000,
      diagnostics,
    });

    const result = await provider.getUsdPrices([
      asset('UNKNOWN', 'coingecko'),
      asset('USD', 'none'),
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(['unknown', 'usd']);
    expect(diagnostics.events).toEqual([
      {
        level: 'warn',
        scope: 'prices',
        event: 'asset.skipped',
        context: {
          asset: 'UNKNOWN',
          provider: 'coingecko',
          reason: 'unsupported-code',
        },
      },
      {
        level: 'info',
        scope: 'prices',
        event: 'asset.skipped',
        context: {
          asset: 'USD',
          provider: 'none',
          reason: 'unconfigured',
        },
      },
    ]);
  });

  it('caches fiat pairs for 60 seconds and reports partial failures', async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.endsWith('/RUB')
          ? new Response(JSON.stringify({ rate: 100 }))
          : new Response('unavailable', { status: 503 }),
      );
    });
    let now = 10_000;
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => now,
    });

    const first = await provider.getUsdPrices([
      asset('RUB', 'frankfurter'),
      asset('EUR', 'frankfurter'),
    ]);
    now += 30_000;
    const second = await provider.getUsdPrices([asset('RUB', 'frankfurter')]);

    expect(first.quotes).toHaveLength(1);
    expect(first.failures).toEqual([
      { assetId: 'eur', provider: 'frankfurter' },
    ]);
    expect(second.quotes).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('records provider, assets, URL, status, and error for diagnostics', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));
    const diagnostics = new CapturingDiagnosticLog();
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => 10_000,
      diagnostics,
    });

    await provider.getUsdPrices([asset('BTC', 'coingecko')]);

    expect(diagnostics.events).toEqual([
      {
        level: 'info',
        scope: 'prices',
        event: 'request.started',
        context: {
          provider: 'coingecko',
          assets: 'BTC',
          url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        },
      },
      {
        level: 'error',
        scope: 'prices',
        event: 'request.failed',
        message: 'CoinGecko 429',
        context: {
          provider: 'coingecko',
          assets: 'BTC',
          status: 429,
          url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        },
      },
    ]);
  });

  it('records a network exception when WebKit returns no HTTP response', async () => {
    fetchMock.mockRejectedValue(new TypeError('Load failed'));
    const diagnostics = new CapturingDiagnosticLog();
    const provider = new HttpPriceProvider({
      fetcher: fetchMock,
      now: () => 10_000,
      diagnostics,
    });

    await provider.getUsdPrices([asset('RUB', 'frankfurter')]);

    expect(diagnostics.events.at(-1)).toEqual({
      level: 'error',
      scope: 'prices',
      event: 'request.failed',
      message: 'Load failed',
      context: {
        provider: 'frankfurter',
        assets: 'RUB',
        url: 'https://api.frankfurter.dev/v2/rate/USD/RUB',
      },
    });
  });
});
