import type { AppSettings, AutomationInterval } from '../domain/models';
import type { DiagnosticLog } from './ports';
import { NOOP_DIAGNOSTIC_LOG } from './ports';

const HOUR_MS = 60 * 60 * 1_000;

export interface AutomationTarget {
  readonly settings: AppSettings;
  refreshPrices(): Promise<unknown>;
  saveSnapshot(): Promise<unknown>;
}

export function isAutomationDue(
  now: number,
  lastCompletedAt: number | undefined,
  intervalHours: AutomationInterval,
): boolean {
  if (
    lastCompletedAt === undefined ||
    !Number.isFinite(lastCompletedAt) ||
    lastCompletedAt < 0 ||
    lastCompletedAt > now
  ) {
    return true;
  }
  return now - lastCompletedAt >= intervalHours * HOUR_MS;
}

export class LaunchAutomation {
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly target: AutomationTarget,
    private readonly now: () => number = Date.now,
    private readonly diagnostics: DiagnosticLog = NOOP_DIAGNOSTIC_LOG,
  ) {}

  run(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.execute().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async execute(): Promise<void> {
    const settings = this.target.settings;
    const now = this.now();
    const priceDue =
      settings.autoPriceRefresh &&
      isAutomationDue(
        now,
        settings.lastPriceRefreshAt,
        settings.priceRefreshIntervalHours,
      );
    const snapshotDue =
      settings.autoSnapshot &&
      isAutomationDue(
        now,
        settings.lastSnapshotAt,
        settings.snapshotIntervalHours,
      );
    let priceExecuted = false;
    let snapshotExecuted = false;

    try {
      if (priceDue || snapshotDue) {
        await this.target.refreshPrices();
        priceExecuted = true;
      }
      if (snapshotDue) {
        await this.target.saveSnapshot();
        snapshotExecuted = true;
      }
    } finally {
      this.diagnostics.record({
        level: 'info',
        scope: 'automation',
        event: 'check.completed',
        context: { priceDue, priceExecuted, snapshotDue, snapshotExecuted },
      });
    }
  }
}
