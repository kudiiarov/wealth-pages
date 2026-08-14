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
};

describe('IndexedDbPortfolioRepository', () => {
  let factory: IDBFactory;
  let repository: IndexedDbPortfolioRepository;

  beforeEach(() => {
    factory = new IDBFactory();
    repository = new IndexedDbPortfolioRepository(factory);
  });

  it('opens the legacy database identity and creates all legacy stores', async () => {
    await repository.load();

    const request = factory.open(DB_NAME, DB_VERSION);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not reopen test database'));
    });

    expect(Array.from(database.objectStoreNames)).toEqual(STORE_NAMES);
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
