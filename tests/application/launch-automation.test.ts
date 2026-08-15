import { describe, expect, it } from 'vitest';

import {
  isAutomationDue,
  LaunchAutomation,
} from '../../src/application/launch-automation';
import type { AppSettings } from '../../src/domain/models';

const HOUR = 60 * 60 * 1_000;

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    language: 'ru',
    theme: 'light',
    displayCurrency: 'USD',
    pnlPeriod: 'all',
    autoPriceRefresh: true,
    priceRefreshIntervalHours: 3,
    autoSnapshot: true,
    snapshotIntervalHours: 6,
    positionGrouping: 'accounts',
    balancesHidden: false,
    selectedRateAssetIds: [],
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
    expect(isAutomationDue(10 * HOUR, undefined, 3)).toBe(true);
    expect(isAutomationDue(10 * HOUR, -1, 3)).toBe(true);
    expect(isAutomationDue(10 * HOUR, 11 * HOUR, 3)).toBe(true);
    expect(isAutomationDue(10 * HOUR, 7 * HOUR, 3)).toBe(true);
    expect(isAutomationDue(10 * HOUR, 7 * HOUR + 1, 3)).toBe(false);
  });

  it('refreshes prices without a snapshot when only the price timer is due', async () => {
    const target = new AutomationTarget(
      settings({
        lastPriceRefreshAt: 6 * HOUR,
        lastSnapshotAt: 6 * HOUR,
      }),
    );

    await new LaunchAutomation(target, () => 10 * HOUR).run();

    expect(target.operations).toEqual(['refresh']);
  });

  it('refreshes prices before every due snapshot', async () => {
    const target = new AutomationTarget(
      settings({
        priceRefreshIntervalHours: 12,
        lastPriceRefreshAt: 6 * HOUR,
        lastSnapshotAt: 3 * HOUR,
      }),
    );

    await new LaunchAutomation(target, () => 10 * HOUR).run();

    expect(target.operations).toEqual(['refresh', 'snapshot']);
  });

  it('does nothing when both schedules are disabled', async () => {
    const target = new AutomationTarget(
      settings({ autoPriceRefresh: false, autoSnapshot: false }),
    );

    await new LaunchAutomation(target, () => 10 * HOUR).run();

    expect(target.operations).toEqual([]);
  });

  it('does not snapshot when the required refresh fails', async () => {
    const target = new AutomationTarget(settings(), true);

    await expect(
      new LaunchAutomation(target, () => 10 * HOUR).run(),
    ).rejects.toThrow('offline');

    expect(target.operations).toEqual(['refresh']);
  });

  it('serializes simultaneous lifecycle checks', async () => {
    let releaseRefresh!: () => void;
    const waitForRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const target = new AutomationTarget(settings(), false, waitForRefresh);
    const automation = new LaunchAutomation(target, () => 10 * HOUR);

    const first = automation.run();
    const second = automation.run();
    releaseRefresh();
    await Promise.all([first, second]);

    expect(target.operations).toEqual(['refresh', 'snapshot']);
  });
});
