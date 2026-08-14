import { expect, it } from 'vitest';

import {
  accountOverviewRows,
  allocationRows,
  assetOverviewRows,
  categoryAllocationRows,
  inferAssetProfile,
  portfolioDrivers,
  portfolioExposures,
  portfolioTags,
  priceFreshness,
} from '../../src/ui/portfolio-view-model';
import type { PortfolioData } from '../../src/domain/models';

it('orders allocation by absolute value without truncating the bar data', () => {
  const data: PortfolioData = {
    accounts: [
      { id: 'a', name: 'A', type: 'cash', icon: '$', color: '#111111' },
    ],
    assets: [
      {
        id: 'x',
        name: 'X',
        code: 'X',
        icon: 'X',
        color: '#111111',
        price: 10,
        autoUpdateSource: 'none',
      },
      {
        id: 'y',
        name: 'Y',
        code: 'Y',
        icon: 'Y',
        color: '#222222',
        price: 5,
        autoUpdateSource: 'none',
      },
      {
        id: 'z',
        name: 'Z',
        code: 'Z',
        icon: 'Z',
        color: '#333333',
        price: 1,
        autoUpdateSource: 'none',
      },
      {
        id: 'w',
        name: 'W',
        code: 'W',
        icon: 'W',
        color: '#444444',
        price: 2,
        autoUpdateSource: 'none',
      },
    ],
    positions: [
      { id: '1', accountId: 'a', assetId: 'x', quantity: -10, comment: '' },
      { id: '2', accountId: 'a', assetId: 'y', quantity: 10, comment: '' },
      { id: '3', accountId: 'a', assetId: 'z', quantity: 20, comment: '' },
      { id: '4', accountId: 'a', assetId: 'w', quantity: 5, comment: '' },
    ],
    snapshots: [],
  };

  expect(
    allocationRows(data).map(({ asset, value }) => [asset.id, value]),
  ).toEqual([
    ['x', -100],
    ['y', 50],
    ['z', 20],
    ['w', 10],
  ]);
});

it('orders account and asset overviews by absolute value including empty entities', () => {
  const data: PortfolioData = {
    accounts: [
      { id: 'small', name: 'Small', type: 'cash', icon: 'S', color: '#111111' },
      { id: 'large', name: 'Large', type: 'cash', icon: 'L', color: '#222222' },
      { id: 'empty', name: 'Empty', type: 'cash', icon: 'E', color: '#333333' },
    ],
    assets: [
      {
        id: 'positive',
        name: 'Positive',
        code: 'POS',
        icon: 'P',
        color: '#111111',
        price: 10,
        autoUpdateSource: 'none',
      },
      {
        id: 'liability',
        name: 'Liability',
        code: 'NEG',
        icon: 'N',
        color: '#222222',
        price: 20,
        autoUpdateSource: 'none',
      },
      {
        id: 'unused',
        name: 'Unused',
        code: 'NIL',
        icon: 'U',
        color: '#333333',
        price: 1,
        autoUpdateSource: 'none',
      },
    ],
    positions: [
      {
        id: '1',
        accountId: 'small',
        assetId: 'positive',
        quantity: 1,
        comment: '',
      },
      {
        id: '2',
        accountId: 'large',
        assetId: 'liability',
        quantity: -2,
        comment: '',
      },
    ],
    snapshots: [],
  };

  expect(accountOverviewRows(data).map(({ account }) => account.id)).toEqual([
    'large',
    'small',
    'empty',
  ]);
  expect(assetOverviewRows(data).map(({ asset }) => asset.id)).toEqual([
    'liability',
    'positive',
    'unused',
  ]);
});

it('classifies legacy assets into one allocation category and overlapping exposure tags', () => {
  expect(
    inferAssetProfile({
      id: 'xaut',
      name: 'Tether Gold',
      code: 'XAUT',
      icon: 'XAU',
      color: '#d8a700',
      price: 2_500,
      autoUpdateSource: 'coingecko',
    }),
  ).toEqual({ category: 'precious-metals', tags: ['crypto', 'gold'] });
  expect(
    inferAssetProfile({
      id: 'usdt',
      name: 'Tether',
      code: 'USDT',
      icon: 'USDT',
      color: '#22aa88',
      price: 1,
      autoUpdateSource: 'coingecko',
    }),
  ).toEqual({
    category: 'crypto',
    tags: ['crypto', 'currency', 'stablecoin'],
  });
});

it('aggregates categories without double counting and tags as overlapping exposures', () => {
  const data: PortfolioData = {
    accounts: [
      { id: 'a', name: 'A', type: 'cash', icon: '$', color: '#111111' },
    ],
    assets: [
      {
        id: 'btc',
        name: 'Bitcoin',
        code: 'BTC',
        icon: 'BTC',
        color: '#f5a341',
        price: 100,
        autoUpdateSource: 'coingecko',
      },
      {
        id: 'xaut',
        name: 'Gold',
        code: 'XAUT',
        icon: 'XAU',
        color: '#d8a700',
        price: 50,
        autoUpdateSource: 'coingecko',
      },
    ],
    positions: [
      { id: '1', accountId: 'a', assetId: 'btc', quantity: 2, comment: '' },
      { id: '2', accountId: 'a', assetId: 'xaut', quantity: 2, comment: '' },
    ],
    snapshots: [],
  };

  expect(categoryAllocationRows(data)).toEqual([
    { category: 'crypto', value: 200, percentage: 66.66666666666666 },
    {
      category: 'precious-metals',
      value: 100,
      percentage: 33.33333333333333,
    },
  ]);
  expect(portfolioExposures(data)).toEqual([
    { tag: 'crypto', value: 300, percentage: 100 },
    { tag: 'gold', value: 100, percentage: 33.33333333333333 },
  ]);
});

it('builds available filters only from tags that are present on assets', () => {
  const data: PortfolioData = {
    accounts: [],
    assets: [
      {
        id: 'oil',
        name: 'Brent',
        code: 'BRENT',
        icon: 'B',
        color: '#17181b',
        price: 80,
        autoUpdateSource: 'none',
        category: 'Commodities',
        tags: ['Energy', 'Long term'],
      },
      {
        id: 'cash',
        name: 'Dollar',
        code: 'USD',
        icon: '$',
        color: '#5667ff',
        price: 1,
        autoUpdateSource: 'none',
        category: 'cash-currencies',
        tags: ['currency', 'Long term'],
      },
    ],
    positions: [],
    snapshots: [],
  };

  expect(portfolioTags(data)).toEqual(['currency', 'Energy', 'Long term']);
});

it('ranks flow-adjusted asset drivers without treating deposits as gains', () => {
  const data: PortfolioData = {
    accounts: [
      { id: 'a', name: 'A', type: 'cash', icon: '$', color: '#111111' },
    ],
    assets: [
      {
        id: 'btc',
        name: 'Bitcoin',
        code: 'BTC',
        icon: 'BTC',
        color: '#f5a341',
        price: 120,
        autoUpdateSource: 'coingecko',
      },
      {
        id: 'xaut',
        name: 'Gold',
        code: 'XAUT',
        icon: 'XAU',
        color: '#d8a700',
        price: 90,
        autoUpdateSource: 'coingecko',
      },
    ],
    positions: [
      { id: '1', accountId: 'a', assetId: 'btc', quantity: 2, comment: '' },
      { id: '2', accountId: 'a', assetId: 'xaut', quantity: 1, comment: '' },
    ],
    snapshots: [],
  };

  expect(
    portfolioDrivers(data, [
      {
        createdAt: 1,
        assets: [
          { assetId: 'btc', price: 100 },
          { assetId: 'xaut', price: 100 },
        ],
        positions: [
          {
            positionId: '1',
            accountId: 'a',
            accountName: 'A',
            assetId: 'btc',
            assetCode: 'BTC',
            comment: '',
            quantity: 1,
            price: 100,
            value: 100,
          },
          {
            positionId: '2',
            accountId: 'a',
            accountName: 'A',
            assetId: 'xaut',
            assetCode: 'XAUT',
            comment: '',
            quantity: 1,
            price: 100,
            value: 100,
          },
        ],
      },
      {
        createdAt: 2,
        assets: [
          { assetId: 'btc', price: 110 },
          { assetId: 'xaut', price: 100 },
        ],
        positions: [
          {
            positionId: '1',
            accountId: 'a',
            accountName: 'A',
            assetId: 'btc',
            assetCode: 'BTC',
            comment: '',
            quantity: 2,
            price: 110,
            value: 220,
          },
          {
            positionId: '2',
            accountId: 'a',
            accountName: 'A',
            assetId: 'xaut',
            assetCode: 'XAUT',
            comment: '',
            quantity: 1,
            price: 100,
            value: 100,
          },
        ],
      },
      {
        createdAt: 3,
        assets: [
          { assetId: 'btc', price: 120 },
          { assetId: 'xaut', price: 90 },
        ],
        positions: [
          {
            positionId: '1',
            accountId: 'a',
            accountName: 'A',
            assetId: 'btc',
            assetCode: 'BTC',
            comment: '',
            quantity: 2,
            price: 120,
            value: 240,
          },
          {
            positionId: '2',
            accountId: 'a',
            accountName: 'A',
            assetId: 'xaut',
            assetCode: 'XAUT',
            comment: '',
            quantity: 1,
            price: 90,
            value: 90,
          },
        ],
      },
    ]),
  ).toEqual([
    { assetId: 'btc', code: 'BTC', value: 30 },
    { assetId: 'xaut', code: 'XAUT', value: -10 },
  ]);
});

it('reports freshness only for active automatically priced assets', () => {
  const now = 10 * 60 * 60 * 1000;
  const data: PortfolioData = {
    accounts: [
      { id: 'a', name: 'A', type: 'cash', icon: '$', color: '#111111' },
    ],
    assets: [
      {
        id: 'fresh',
        name: 'Fresh',
        code: 'BTC',
        icon: 'B',
        color: '#111111',
        price: 1,
        priceUpdatedAt: now - 60_000,
        autoUpdateSource: 'coingecko',
      },
      {
        id: 'stale',
        name: 'Stale',
        code: 'ETH',
        icon: 'E',
        color: '#222222',
        price: 1,
        priceUpdatedAt: now - 4 * 60 * 60 * 1000,
        autoUpdateSource: 'coingecko',
      },
      {
        id: 'manual',
        name: 'Manual',
        code: 'CAR',
        icon: 'C',
        color: '#333333',
        price: 1,
        autoUpdateSource: 'none',
      },
    ],
    positions: [
      { id: '1', accountId: 'a', assetId: 'fresh', quantity: 1, comment: '' },
      { id: '2', accountId: 'a', assetId: 'stale', quantity: 1, comment: '' },
      { id: '3', accountId: 'a', assetId: 'manual', quantity: 1, comment: '' },
    ],
    snapshots: [],
  };

  expect(priceFreshness(data, now, 3 * 60 * 60 * 1000)).toEqual({
    tracked: 2,
    current: 1,
    staleAssetIds: ['stale'],
    latestUpdateAt: now - 60_000,
  });
});
