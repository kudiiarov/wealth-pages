import type {
  EntityByStore,
  PortfolioRepository,
} from '../../application/ports';
import type {
  PortfolioData,
  PortfolioEntity,
  StoreName,
  UnknownRecord,
} from '../../domain/models';
import { normalizeData } from '../../domain/normalize';

export const DB_NAME = 'worth-local-portfolio';
export const DB_VERSION = 1;
export const STORE_NAMES = [
  'accounts',
  'assets',
  'positions',
  'snapshots',
] as const satisfies readonly StoreName[];

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

export class IndexedDbPortfolioRepository implements PortfolioRepository {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  async load(): Promise<PortfolioData> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAMES, 'readonly');
    const done = transactionDone(transaction);
    const [accounts, assets, positions, snapshots] = await Promise.all(
      STORE_NAMES.map((storeName) =>
        requestResult<UnknownRecord[]>(
          transaction.objectStore(storeName).getAll() as IDBRequest<
            UnknownRecord[]
          >,
        ),
      ),
    );
    await done;
    return normalizeData({ accounts, assets, positions, snapshots });
  }

  async put<K extends StoreName>(
    store: K,
    value: EntityByStore[K],
  ): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(store, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(store).put(value);
    await done;
  }

  async delete(store: StoreName, id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(store, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(store).delete(id);
    await done;
  }

  async replaceAll(data: PortfolioData): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAMES, 'readwrite');
    const done = transactionDone(transaction);

    try {
      for (const storeName of STORE_NAMES) {
        const store = transaction.objectStore(storeName);
        store.clear();
        for (const entity of data[storeName]) store.put(entity);
      }
    } catch (error) {
      transaction.abort();
      await done.catch(() => undefined);
      throw error instanceof Error
        ? error
        : new Error('IndexedDB replacement failed');
    }

    await done;
  }

  async clearAll(): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAMES, 'readwrite');
    const done = transactionDone(transaction);
    for (const storeName of STORE_NAMES)
      transaction.objectStore(storeName).clear();
    await done;
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const storeName of STORE_NAMES) {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return this.databasePromise;
  }
}

export type StoredEntity = PortfolioEntity;
