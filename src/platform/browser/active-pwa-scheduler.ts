import type { AppSettings } from '../../domain/models';

const MINUTE_MS = 60 * 1_000;

interface AutomationRunner {
  run(): Promise<void>;
}

function operationDelay(
  intervalMinutes: number,
  lastCompletedAt: number | undefined,
  now: number,
  lastAttemptAt?: number,
): number | undefined {
  if (intervalMinutes === 0) return;
  const validCompletion =
    lastCompletedAt !== undefined &&
    Number.isFinite(lastCompletedAt) &&
    lastCompletedAt >= 0 &&
    lastCompletedAt <= now
      ? lastCompletedAt
      : undefined;
  const baseline = Math.max(validCompletion ?? 0, lastAttemptAt ?? 0);
  if (baseline === 0) return 0;
  return Math.max(0, baseline + intervalMinutes * MINUTE_MS - now);
}

export function nextAutomationDelay(
  settings: AppSettings,
  now: number,
  lastAttemptAt?: number,
): number | undefined {
  const delays = [
    operationDelay(
      settings.priceRefreshIntervalMinutes,
      settings.lastPriceRefreshAt,
      now,
      lastAttemptAt,
    ),
    operationDelay(
      settings.snapshotIntervalMinutes,
      settings.lastSnapshotAt,
      now,
      lastAttemptAt,
    ),
  ].filter((delay): delay is number => delay !== undefined);
  return delays.length ? Math.min(...delays) : undefined;
}

export class ActivePwaScheduler {
  private started = false;
  private disposed = false;
  private inFlight: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastAttemptAt: number | undefined;

  private readonly onVisibilityChange = (): void => {
    if (this.documentRef.visibilityState === 'visible') this.requestRun();
    else this.clearTimer();
  };

  private readonly onActive = (): void => this.requestRun();

  constructor(
    private readonly automation: AutomationRunner,
    private readonly getSettings: () => AppSettings,
    private readonly afterRun: () => void,
    private readonly now: () => number = Date.now,
    private readonly documentRef: Document = document,
    private readonly windowRef: Window = window,
  ) {}

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.documentRef.addEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
    this.windowRef.addEventListener('focus', this.onActive);
    this.windowRef.addEventListener('pageshow', this.onActive);
    this.requestRun();
  }

  settingsChanged(): void {
    if (!this.started || this.disposed) return;
    this.lastAttemptAt = undefined;
    this.clearTimer();
    this.requestRun();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    this.documentRef.removeEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
    this.windowRef.removeEventListener('focus', this.onActive);
    this.windowRef.removeEventListener('pageshow', this.onActive);
  }

  private requestRun(): void {
    if (
      this.disposed ||
      this.documentRef.visibilityState !== 'visible' ||
      this.inFlight
    ) {
      return;
    }
    this.clearTimer();
    this.lastAttemptAt = this.now();
    this.inFlight = this.automation
      .run()
      .then(() => this.afterRun())
      .catch((error: unknown) => console.error(error))
      .finally(() => {
        this.inFlight = undefined;
        this.scheduleNext();
      });
  }

  private scheduleNext(): void {
    if (this.disposed || this.documentRef.visibilityState !== 'visible') return;
    const delay = nextAutomationDelay(
      this.getSettings(),
      this.now(),
      this.lastAttemptAt,
    );
    if (delay === undefined) return;
    this.timer = setTimeout(() => this.requestRun(), delay);
  }

  private clearTimer(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
