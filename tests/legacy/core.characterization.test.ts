import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

interface LegacyCore {
  normalizeData(raw: Record<string, unknown>): {
    assets: Array<Record<string, unknown>>;
    positions: Array<Record<string, unknown>>;
  };
  portfolioTotal(
    positions: Array<Record<string, unknown>>,
    assets: Array<Record<string, unknown>>,
  ): number;
  validateImport(raw: Record<string, unknown>): Record<string, unknown>;
}

function loadLegacyCore(): LegacyCore {
  const source = readFileSync(
    new URL('../fixtures/legacy-core.cjs', import.meta.url),
    'utf8',
  );
  const context = vm.createContext({ module: { exports: {} }, console });
  vm.runInContext(source, context, { filename: 'core.js' });
  return (context.module as { exports: LegacyCore }).exports;
}

const core = loadLegacyCore();

describe('legacy WorthCore behavior', () => {
  it('normalizes symbols while preserving multiple positions for one asset', () => {
    const data = core.normalizeData({
      accounts: [{ id: 'a', name: ' Cash ', type: 'cash' }],
      assets: [{ id: 'usd', name: ' Dollar ', symbol: ' usd ', price: '1' }],
      positions: [
        { id: 'p1', accountId: 'a', assetId: 'usd', quantity: 2 },
        { id: 'p2', accountId: 'a', assetId: 'usd', quantity: 3 },
      ],
      snapshots: [],
    });

    expect(data.assets[0]).toMatchObject({
      code: 'USD',
      name: 'Dollar',
      price: 1,
    });
    expect(core.portfolioTotal(data.positions, data.assets)).toBe(5);
    expect(data.positions).toHaveLength(2);
  });

  it('rejects positions that reference missing accounts', () => {
    expect(() =>
      core.validateImport({
        accounts: [],
        assets: [{ id: 'usd', name: 'Dollar', code: 'USD', price: 1 }],
        positions: [
          { id: 'p1', accountId: 'missing', assetId: 'usd', quantity: 1 },
        ],
        snapshots: [],
      }),
    ).toThrow('Повреждены позиции');
  });
});
