import type {
  DiagnosticEntry,
  DiagnosticEvent,
  DiagnosticLevel,
  DiagnosticLog,
  DiagnosticValue,
} from '../../application/ports';

export const DIAGNOSTIC_LOG_KEY = 'worth-diagnostic-log';
const DEFAULT_LIMIT = 100;

interface DiagnosticLogOptions {
  limit?: number;
  now?: () => number;
  nextId?: () => string;
}

function isLevel(value: unknown): value is DiagnosticLevel {
  return value === 'info' || value === 'warn' || value === 'error';
}

function isContext(value: unknown): value is Record<string, DiagnosticValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (item) =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean',
  );
}

function isEntry(value: unknown): value is DiagnosticEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entry = value as Partial<DiagnosticEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt) &&
    isLevel(entry.level) &&
    typeof entry.scope === 'string' &&
    typeof entry.event === 'string' &&
    (entry.message === undefined || typeof entry.message === 'string') &&
    (entry.context === undefined || isContext(entry.context))
  );
}

function fallbackId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

export class BrowserDiagnosticLog implements DiagnosticLog {
  private readonly limit: number;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(
    private readonly storage: Storage = localStorage,
    options: DiagnosticLogOptions = {},
  ) {
    this.limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT));
    this.now = options.now ?? Date.now;
    this.nextId = options.nextId ?? fallbackId;
  }

  record(event: DiagnosticEvent): void {
    const entry: DiagnosticEntry = {
      ...event,
      id: this.nextId(),
      createdAt: this.now(),
    };
    try {
      const entries = [...this.read(), entry].slice(-this.limit);
      this.storage.setItem(DIAGNOSTIC_LOG_KEY, JSON.stringify(entries));
    } catch {
      // Diagnostics must never break the operation being observed.
    }
  }

  list(): DiagnosticEntry[] {
    return this.read().reverse();
  }

  clear(): void {
    try {
      this.storage.removeItem(DIAGNOSTIC_LOG_KEY);
    } catch {
      // Storage may be unavailable in private browsing or restricted PWAs.
    }
  }

  private read(): DiagnosticEntry[] {
    try {
      const raw = this.storage.getItem(DIAGNOSTIC_LOG_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isEntry).slice(-this.limit);
    } catch {
      return [];
    }
  }
}
