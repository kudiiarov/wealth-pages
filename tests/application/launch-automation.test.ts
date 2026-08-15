import { describe, expect, it } from 'vitest';

import {
  isAutomationDue,
  LaunchAutomation,
} from '../../src/application/launch-automation';
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

class AutomationTarget {
  readonly operations: string[] = [];

  constructor(
    public settings: AppSettings,
    private readonly failRefresh = false,
    private readonly waitForRefresh?: Promise<void>,
  ) {}

  async refreshPrices(): Promise<void> {
    this.operations.push('refresh');
    await this.waitForRefresh;
    if (this.failRefresh) throw new Error('offline');
  }

  saveSnapshot(): Promise<void> {
    this.operations.push('snapshot');
    return Promise.resolve();
  }
}

describe('launch automation', () => {
  it('treats missing, invalid, and future completions as due', () => {
    expect(isAutomationDue(10 * MINUTE, undefined, 5)).toBe(true);
    expect(isAutomationDue(10 * MINUTE, -1, 5)).toBe(true);
    expect(isAutomationDue(10 * MINUTE, 11 * MINUTE, 5)).toBe(true);
    expect(isAutomationDue(10 * MINUTE, 5 * MINUTE, 5)).toBe(true);
    expect(isAutomationDue(10 * MINUTE, 5 * MINUTE + 1, 5)).toBe(false);
    expect(isAutomationDue(10 * MINUTE, undefined, 0)).toBe(false);
  });

  it('refreshes prices without a snapshot when only the price timer is due', async () => {
    const target = new AutomationTarget(
      settings({
        lastPriceRefreshAt: 80 * MINUTE,
        lastSnapshotAt: 90 * MINUTE,
      }),
    );

    await new LaunchAutomation(target, () => 100 * MINUTE).run();

    expect(target.operations).toEqual(['refresh']);
  });

  it('saves a due snapshot without forcing a price refresh', async () => {
    const target = new AutomationTarget(
      settings({
        priceRefreshIntervalMinutes: 60,
        lastPriceRefreshAt: 90 * MINUTE,
        lastSnapshotAt: 60 * MINUTE,
      }),
    );

    await new LaunchAutomation(target, () => 100 * MINUTE).run();

    expect(target.operations).toEqual(['snapshot']);
  });

  it('does nothing when both schedules are disabled', async () => {
    const target = new AutomationTarget(
      settings({
        priceRefreshIntervalMinutes: 0,
        snapshotIntervalMinutes: 0,
      }),
    );

    await new LaunchAutomation(target, () => 10 * MINUTE).run();

    expect(target.operations).toEqual([]);
  });

  it('still snapshots when an independently due refresh fails', async () => {
    const target = new AutomationTarget(settings(), true);

    await new LaunchAutomation(target, () => 10 * MINUTE).run();

    expect(target.operations).toEqual(['refresh', 'snapshot']);
  });

  it('serializes simultaneous lifecycle checks', async () => {
    let releaseRefresh!: () => void;
    const waitForRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const target = new AutomationTarget(settings(), false, waitForRefresh);
    const automation = new LaunchAutomation(target, () => 10 * MINUTE);

    const first = automation.run();
    const second = automation.run();
    releaseRefresh();
    await Promise.all([first, second]);

    expect(target.operations).toEqual(['refresh', 'snapshot']);
  });
});
