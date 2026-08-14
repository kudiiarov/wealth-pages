import { beforeEach, describe, expect, it } from 'vitest';

import { BrowserDiagnosticLog } from '../../src/platform/browser/diagnostic-log';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('BrowserDiagnosticLog', () => {
  let storage: MemoryStorage;
  let nextId: number;
  let now: number;
  let log: BrowserDiagnosticLog;

  beforeEach(() => {
    storage = new MemoryStorage();
    nextId = 1;
    now = 1_700_000_000_000;
    log = new BrowserDiagnosticLog(storage, {
      limit: 2,
      now: () => now++,
      nextId: () => `event-${nextId++}`,
    });
  });

  it('stores general structured events newest first and enforces the limit', () => {
    log.record({ level: 'info', scope: 'prices', event: 'refresh.started' });
    log.record({
      level: 'error',
      scope: 'storage',
      event: 'write.failed',
      message: 'Quota exceeded',
      context: { store: 'assets', retryable: false },
    });
    log.record({ level: 'info', scope: 'sync', event: 'pull.completed' });

    expect(log.list()).toEqual([
      {
        id: 'event-3',
        createdAt: 1_700_000_000_002,
        level: 'info',
        scope: 'sync',
        event: 'pull.completed',
      },
      {
        id: 'event-2',
        createdAt: 1_700_000_000_001,
        level: 'error',
        scope: 'storage',
        event: 'write.failed',
        message: 'Quota exceeded',
        context: { store: 'assets', retryable: false },
      },
    ]);
  });

  it('recovers from malformed storage and can be cleared', () => {
    storage.setItem('worth-diagnostic-log', '{broken');
    expect(log.list()).toEqual([]);

    log.record({ level: 'warn', scope: 'app', event: 'recovered' });
    expect(log.list()).toHaveLength(1);

    log.clear();
    expect(log.list()).toEqual([]);
  });
});
