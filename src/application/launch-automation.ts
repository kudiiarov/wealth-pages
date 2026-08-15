import type { AppSettings } from '../domain/models';
import type { DiagnosticLog } from './ports';
import { NOOP_DIAGNOSTIC_LOG } from './ports';

const MINUTE_MS = 60 * 1_000;

export interface AutomationTarget {
  readonly settings: AppSettings;
  refreshPrices(): Promise<unknown>;
  saveSnapshot(): Promise<unknown>;
}

export function isAutomationDue(
  now: number,
  lastCompletedAt: number | undefined,
  intervalMinutes: number,
): boolean {
  if (intervalMinutes === 0) return false;
  if (
    lastCompletedAt === undefined ||
    !Number.isFinite(lastCompletedAt) ||
    lastCompletedAt < 0 ||
    lastCompletedAt > now
  ) {
    return true;
  }
  return now - lastCompletedAt >= intervalMinutes * MINUTE_MS;
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
    const priceDue = isAutomationDue(
      now,
      settings.lastPriceRefreshAt,
      settings.priceRefreshIntervalMinutes,
    );
    const snapshotDue = isAutomationDue(
      now,
      settings.lastSnapshotAt,
      settings.snapshotIntervalMinutes,
    );
    let priceExecuted = false;
    let snapshotExecuted = false;

    try {
      if (priceDue) {
        await this.target.refreshPrices();
        priceExecuted = true;
      }
    } catch (error) {
      this.recordFailure('prices', settings.priceRefreshIntervalMinutes, error);
    }
    try {
      if (snapshotDue) {
        await this.target.saveSnapshot();
        snapshotExecuted = true;
      }
    } catch (error) {
      this.recordFailure('snapshots', settings.snapshotIntervalMinutes, error);
    } finally {
      this.diagnostics.record({
        level: 'info',
        scope: 'automation',
        event: 'check.completed',
        context: { priceDue, priceExecuted, snapshotDue, snapshotExecuted },
      });
    }
  }

  private recordFailure(
    operation: 'prices' | 'snapshots',
    intervalMinutes: number,
    error: unknown,
  ): void {
    this.diagnostics.record({
      level: 'error',
      scope: 'automation',
      event: 'operation.failed',
      message: error instanceof Error ? error.message : String(error),
      context: { operation, intervalMinutes, due: true },
    });
  }
}
