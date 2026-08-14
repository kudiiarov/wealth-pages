import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('HttpPriceProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
  });

  it('converts Frankfurter units-per-USD into USD per asset unit', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ rate: 90 })));
    const provider = new HttpPriceProvider(fetchMock, () => 10_000);

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
    const provider = new HttpPriceProvider(fetchMock, () => 10_000);

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
    const provider = new HttpPriceProvider(fetchMock, () => 10_000);

    const result = await provider.getUsdPrices([
      asset('UNKNOWN', 'coingecko'),
      asset('USD', 'none'),
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(['unknown', 'usd']);
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
    const provider = new HttpPriceProvider(fetchMock, () => now);

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
});
