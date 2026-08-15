import { describe, expect, it, vi } from 'vitest';

import {
  ActivePwaScheduler,
  nextAutomationDelay,
} from '../../src/platform/browser/active-pwa-scheduler';
import type { AppSettings } from '../../src/domain/models';

const MINUTE = 60 * 1_000;

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    language: 'ru',
    theme: 'light',
    displayCurrency: 'USD',
    pnlPeriod: 'all',
    priceRefreshIntervalMinutes: 15,
    snapshotIntervalMinutes: 30,
    positionGrouping: 'accounts',
    balancesHidden: false,
    selectedRateAssetIds: [],
    ratePairs: [],
    ...overrides,
  };
}

class Events {
  visibilityState: DocumentVisibilityState = 'visible';
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}

describe('active PWA scheduler', () => {
  it('targets the nearest enabled due operation', () => {
    expect(
      nextAutomationDelay(
        settings({
          lastPriceRefreshAt: 90 * MINUTE,
          lastSnapshotAt: 80 * MINUTE,
        }),
        100 * MINUTE,
      ),
    ).toBe(5 * MINUTE);
    expect(
      nextAutomationDelay(
        settings({
          priceRefreshIntervalMinutes: 0,
          snapshotIntervalMinutes: 0,
        }),
        100 * MINUTE,
      ),
    ).toBeUndefined();
  });

  it('coalesces simultaneous visible lifecycle events into one run', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const automation = { run: vi.fn(() => gate) };
    const documentEvents = new Events();
    const windowEvents = new Events();
    const scheduler = new ActivePwaScheduler(
      automation,
      () => settings(),
      () => undefined,
      Date.now,
      documentEvents as unknown as Document,
      windowEvents as unknown as Window,
    );

    scheduler.start();
    documentEvents.emit('visibilitychange');
    windowEvents.emit('focus');
    windowEvents.emit('pageshow');

    expect(automation.run).toHaveBeenCalledTimes(1);
    release();
    await gate;
    await Promise.resolve();
    scheduler.dispose();
  });

  it('does not run while hidden and removes listeners on dispose', () => {
    const automation = { run: vi.fn(() => Promise.resolve()) };
    const documentEvents = new Events();
    const windowEvents = new Events();
    documentEvents.visibilityState = 'hidden';
    const scheduler = new ActivePwaScheduler(
      automation,
      () => settings(),
      () => undefined,
      Date.now,
      documentEvents as unknown as Document,
      windowEvents as unknown as Window,
    );

    scheduler.start();
    expect(automation.run).not.toHaveBeenCalled();
    scheduler.dispose();
    documentEvents.visibilityState = 'visible';
    documentEvents.emit('visibilitychange');
    windowEvents.emit('focus');
    expect(automation.run).not.toHaveBeenCalled();
  });
});
