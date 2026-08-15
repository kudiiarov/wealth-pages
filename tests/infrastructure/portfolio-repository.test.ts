import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Account, PortfolioData } from '../../src/domain/models';
import {
  DB_NAME,
  DB_VERSION,
  IndexedDbPortfolioRepository,
  STORE_NAMES,
} from '../../src/infrastructure/indexeddb/portfolio-repository';

const account: Account = {
  id: 'a1',
  name: 'Cash',
  type: 'cash',
  icon: '$',
  color: '#17181b',
};

const emptyData: PortfolioData = {
  accounts: [],
  assets: [],
  positions: [],
  snapshots: [],
  priceHistory: [],
};

describe('IndexedDbPortfolioRepository', () => {
  let factory: IDBFactory;
  let repository: IndexedDbPortfolioRepository;

  beforeEach(() => {
    factory = new IDBFactory();
    repository = new IndexedDbPortfolioRepository(factory);
  });

  it('upgrades a version 1 database without losing legacy records', async () => {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      for (const name of ['accounts', 'assets', 'positions', 'snapshots']) {
        open.result.createObjectStore(name, { keyPath: 'id' });
      }
      open.transaction?.objectStore('accounts').put(account);
      open.transaction?.objectStore('snapshots').put({
        id: 'legacy',
        createdAt: new Date(2026, 7, 15, 9).getTime(),
        total: 1,
        assets: [{ assetId: 'usd', code: 'USD', price: 1 }],
      });
    };
    await new Promise<void>((resolve, reject) => {
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () =>
        reject(open.error ?? new Error('Could not seed version 1 database'));
    });

    const loaded = await repository.load();

    expect(loaded.accounts).toEqual([account]);
    expect(loaded.snapshots[0]?.id).toBe('daily-snapshot:2026-08-15');
    expect(loaded.priceHistory).toMatchObject([
      { assetId: 'usd', usdPrice: 1 },
    ]);
  });

  it('opens database version 2 and creates the price history store', async () => {
    await repository.load();

    const request = factory.open(DB_NAME, DB_VERSION);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not reopen test database'));
    });

    expect(Array.from(database.objectStoreNames)).toEqual(STORE_NAMES);
    expect(DB_VERSION).toBe(2);
    expect(Array.from(database.objectStoreNames)).toContain('priceHistory');
    database.close();
  });

  it('stores entities and normalizes legacy data on load', async () => {
    await repository.put('accounts', { ...account, name: ' Cash ' });
    await repository.put('assets', {
      id: 'usd',
      name: ' Dollar ',
      code: 'usd',
      icon: '$',
      color: '#5667ff',
      price: 1,
      autoUpdateSource: 'none',
    });

    const loaded = await repository.load();

    expect(loaded.accounts[0]?.name).toBe('Cash');
    expect(loaded.assets[0]?.code).toBe('USD');
  });

  it('does not create price history when a new snapshot is stored', async () => {
    await repository.load();
    await repository.put('snapshots', {
      id: 'daily-snapshot:2026-08-15',
      createdAt: new Date(2026, 7, 15, 18).getTime(),
      total: 1,
      assets: [{ assetId: 'usd', code: 'USD', price: 1 }],
    });

    expect((await repository.load()).priceHistory).toEqual([]);
  });

  it('replaces every store in one transaction', async () => {
    await repository.put('accounts', account);
    const replacement: PortfolioData = {
      ...emptyData,
      accounts: [{ ...account, id: 'a2', name: 'Bank' }],
    };

    await repository.replaceAll(replacement);

    expect(await repository.load()).toEqual(replacement);
  });

  it('rolls back clears when one replacement write fails', async () => {
    await repository.put('accounts', account);
    const invalid = {
      ...emptyData,
      accounts: [{ ...account, id: undefined }],
    } as unknown as PortfolioData;

    await expect(repository.replaceAll(invalid)).rejects.toBeInstanceOf(Error);
    expect((await repository.load()).accounts).toEqual([account]);
  });

  it('deletes one entity and can clear all stores', async () => {
    await repository.put('accounts', account);
    await repository.delete('accounts', account.id);
    expect((await repository.load()).accounts).toEqual([]);

    await repository.put('accounts', account);
    await repository.clearAll();
    expect(await repository.load()).toEqual(emptyData);
  });
});
