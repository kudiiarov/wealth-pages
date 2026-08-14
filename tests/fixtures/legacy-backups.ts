export const legacyV1 = {
  app: 'Worth',
  version: 1,
  accounts: [{ id: 'a1', name: ' Cash ', type: 'Наличные' }],
  assets: [{ id: 'usd', name: ' Dollar ', symbol: ' usd ', price: '1' }],
  positions: [{ id: 'p1', accountId: 'a1', assetId: 'usd', quantity: '100' }],
  snapshots: [{ id: 's1', createdAt: 1, total: 100 }],
} as const;

export const currentV14 = {
  app: 'Worth',
  version: 14,
  appVersion: '2.5.1-final',
  baseCurrency: 'USD',
  exportedAt: '2026-08-14T00:00:00.000Z',
  accounts: [
    {
      id: 'a1',
      name: 'Cash',
      type: 'cash',
      icon: '$',
      color: '#17181b',
    },
  ],
  assets: [
    {
      id: 'usd',
      name: 'Dollar',
      code: 'USD',
      icon: '$',
      color: '#5667ff',
      price: 1,
      autoUpdateSource: 'none',
    },
  ],
  positions: [
    {
      id: 'p1',
      accountId: 'a1',
      assetId: 'usd',
      quantity: 100,
      comment: 'reserve',
    },
  ],
  snapshots: [
    {
      id: 's1',
      createdAt: 1,
      total: 100,
      positions: [
        {
          positionId: 'p1',
          accountId: 'a1',
          accountName: 'Cash',
          assetId: 'usd',
          assetCode: 'USD',
          comment: 'reserve',
          quantity: 100,
          price: 1,
          value: 100,
        },
      ],
    },
  ],
  appSettings: {
    language: 'en',
    theme: 'dark',
    displayCurrency: 'USD',
    pnlPeriod: 'last',
    autoRefreshOnLaunch: true,
  },
} as const;
