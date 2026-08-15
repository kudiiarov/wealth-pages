# Daily history, active-PWA scheduling, and compact portfolio design

**Status:** Approved in conversation; awaiting written-spec review  
**Date:** 2026-08-15  
**Target release:** 3.7.0-final

## Purpose

Worth should retain enough history to explain daily portfolio and asset-price movement without accumulating redundant intraday records. Automatic work must use compact interval selectors, catch up when the PWA becomes active, and keep price refreshes independent from snapshots. Assets and Accounts should adopt the approved compact typography while preserving their current allocation diagrams. Position rows must provide a direct route to editing the underlying position.

## Goals

- Store at most one portfolio snapshot per local calendar day.
- Store at most one price-history point per asset per local calendar day.
- Keep the latest observation within each day, not the first.
- Compact existing local and imported history without losing the latest daily values.
- Replace automation toggles with interval selectors containing an explicit disabled state.
- Run due work while the PWA is active and perform one catch-up check on launch or return from the background.
- Remove the decorative green dots from History.
- Apply the approved compact information hierarchy to Assets and Accounts without changing their allocation diagrams.
- Make every related holding row open the underlying Position editor and preserve navigation to its Asset and Account.

## Non-goals

- Background execution while iOS has suspended or terminated the PWA.
- Intraday charts or intraday price points.
- Cloud sync, user accounts, or server-side scheduling.
- Changing how market-data providers calculate prices.
- Redesigning the allocation diagrams or their current single-column legend.

## Daily identity and time rules

A **local day key** is generated from the device's local calendar at the moment an observation is written, using `YYYY-MM-DD` calendar components rather than slicing a UTC ISO timestamp. The key intentionally follows the user's local day.

- Snapshot ID: `daily-snapshot:<day-key>`
- Price-history ID: `daily-price:<asset-id>:<day-key>`

Writing the same ID replaces the existing IndexedDB record atomically. The replacement receives the newest `createdAt`, price, totals, positions, and metadata, so charts and History represent the last known state of that day.

Changing time zones does not rewrite already migrated day keys. New observations use the new local calendar. This avoids repeatedly moving historical records as the device travels.

## Data model

Add a `PriceHistoryPoint` entity:

```ts
interface PriceHistoryPoint {
  id: string;
  assetId: string;
  dayKey: string;
  createdAt: number;
  usdPrice: number;
  source?: PriceSource;
}
```

Extend `PortfolioData` with `priceHistory: PriceHistoryPoint[]` and `StoreName` with `priceHistory`. IndexedDB moves from version 1 to version 2 and creates the new object store without deleting existing stores.

Snapshots remain full portfolio records because daily portfolio, account, asset-value, position, and P&L histories depend on their contents. Price charts stop reading prices from snapshots and read `priceHistory` instead.

## Migration and compaction

Migration runs once after the version-2 database is opened and before the first render:

1. Group existing snapshots by local day.
2. Keep the snapshot with the greatest `createdAt` in each day.
3. Canonicalize its ID to `daily-snapshot:<day-key>`.
4. For every asset price embedded in every legacy snapshot, group by asset and local day.
5. Keep the price from the greatest `createdAt` for that asset/day and write it as a canonical `PriceHistoryPoint`.
6. Merge any already existing `priceHistory` points with the same rule, allowing migration to be safely re-run.
7. Replace repository contents only when the normalized result differs from stored data.

Backup schema version 16 includes `priceHistory` and the new interval settings. Versions up to 15 remain importable. Import applies the same daily compaction before replacing IndexedDB contents. Export always emits canonical daily records.

## Price-history writes

Every successful automatic quote updates both:

- the live `Asset.price` and freshness metadata;
- that asset's canonical daily `PriceHistoryPoint`.

A manual price edit performs the same daily history upsert using the manual timestamp and source metadata when available. Failed or skipped provider requests do not create history points. A partial refresh records history only for successful quotes.

Price history is independent from snapshots. Saving a snapshot never triggers a price request and does not create price-history points by itself.

## Snapshot writes

`saveSnapshot()` builds the current full portfolio state and writes it using the canonical daily snapshot ID. If today's record exists it is replaced; otherwise a new day is created. Manual and automatic saves follow exactly the same rule.

Deleting today's snapshot removes it. A later save on the same day recreates the canonical record.

## Automation settings

Replace the boolean-plus-hours pairs with two values:

```ts
type PriceRefreshIntervalMinutes = 0 | 5 | 15 | 30 | 60;
type SnapshotIntervalMinutes = 0 | 30 | 60;
```

`0` means **Нет / Off**. Settings UI exposes a single selector for each operation:

- Price refresh: `Нет`, `5 минут`, `15 минут`, `30 минут`, `60 минут`.
- Snapshots: `Нет`, `30 минут`, `60 минут`.

Legacy settings migrate as follows:

- disabled toggle → `0`;
- enabled price refresh at any legacy hourly interval → `60`;
- enabled snapshots at any legacy hourly interval → `60`.

The obsolete booleans and hour fields are accepted on old backup import but are not written to new settings or exports.

For a new installation, price refresh defaults to `60` minutes and snapshots default to `0` (Off). This preserves the existing behavior: market prices update automatically, while portfolio-history recording remains an explicit user choice.

## Active-PWA scheduler

The scheduler has one serialized `runDueWork()` entry point and never allows overlapping runs.

It is invoked:

- after application initialization;
- when `visibilitychange` makes the document visible;
- on `pageshow`;
- on window `focus`;
- by a timer while the document remains visible.

The timer targets the nearest next due operation and is recalculated after each run or settings change. Event listeners and timers have an explicit disposal path so application remounts cannot create duplicate schedulers. When the app returns after several missed intervals, it performs at most one price refresh and at most one snapshot save. It never replays every missed interval.

Due checks compare `now` against `lastPriceRefreshAt` and `lastSnapshotAt`. A successful or partially successful price batch updates its completion timestamp according to the existing logging rules. A successful daily snapshot upsert updates `lastSnapshotAt` even when it replaced today's record.

Price refresh and snapshot execution are independent:

- Price interval `0` prevents every automatic price request.
- A due snapshot saves the currently known prices without forcing a refresh.
- One failing operation does not suppress the other due operation.
- Manual actions remain available regardless of automatic interval settings.

Because iOS can suspend a PWA, minute intervals are best-effort while active. The launch/visibility checks guarantee catch-up when execution resumes.

## History screen

History remains the portfolio's daily history. Each record contains:

- date as the primary label;
- time of the latest overwrite that day;
- change from the previous retained day;
- portfolio total;
- existing overflow actions.

Remove `.history-dot` from markup and CSS. It currently has no semantic meaning and must not be replaced with another decorative status indicator.

The portfolio chart consumes the compacted daily snapshots. Asset price charts consume daily `priceHistory`. Account and asset holding-value histories continue to consume daily snapshots.

## Compact Assets and Accounts

Preserve the existing allocation diagrams and their current single-column legend exactly. Only the page typography, row density, and text organization change.

### Overview pages

- Page title: approximately 31 px with tight tracking.
- Portfolio summary: 12 px secondary line.
- Item row: approximately 70 px high with a minimum 44 px touch target.
- Entity icon: 46 px rounded square.
- Entity name: 16 px semibold.
- Asset code: muted 11–12 px inline with the full name.
- Secondary line: 11–12 px, containing quantity/category for assets or type/position count for accounts.
- Right-side value: 15 px tabular number.
- Change: 11–12 px below the value.
- Rows remain separate rounded surfaces with consistent 9 px vertical gaps.

### Asset detail

- Compact identity row: icon, full name with inline code, unit label, and freshness at the right.
- Unit price remains the primary number; price movement stays on one compact line.
- Keep the angular price chart and period control.
- Keep the combined **Your portfolio** summary and position rows, using the same compact typography.

### Account detail

- Compact identity row with account icon, name, type, and position count.
- Account value and all-time movement form the primary summary.
- No account chart.
- Related asset positions use the same compact row metrics as Asset holdings.

## Position navigation and editing

Every related row on Asset and Account detail represents a Position and opens a compact Position sheet instead of directly opening the opposite entity.

The Position sheet contains:

- Asset identity and a link to open the Asset detail.
- Account identity and a link to open the Account detail.
- Editable quantity.
- Editable comment.
- Read-only current unit price and calculated position value.
- Primary Save action.
- Secondary Delete action with the existing confirmation behavior.

The sheet reuses the current position form and validation rather than creating a second editing implementation. Opening it records the source detail route so closing or saving returns to the same Asset or Account screen. This removes the Asset → Account → Asset loop while retaining deliberate cross-entity navigation.

## Error handling and diagnostics

- Scheduler failures use the existing diagnostic log with operation, configured interval, due state, and failure message.
- The IndexedDB schema upgrade only adds the new store. Daily compaction then uses the repository's atomic replacement transaction; if compaction fails, the pre-compaction records remain intact even though the database schema may already be version 2.
- Invalid legacy price points are skipped rather than preventing the rest of the migration.
- Empty histories preserve the existing empty states.
- A missing Asset or Account referenced by an old Position is shown with the existing deleted-entity fallback and remains deletable.

## Testing

### Unit tests

- Local day-key creation at midnight boundaries.
- Snapshot upsert replaces today's record and creates tomorrow's record.
- Price-history upsert is last-write-wins per asset/day.
- Migration retains only the newest snapshot and price per day.
- Backup v16 round-trip and v15 compatibility.
- Legacy setting migration to minute intervals.
- Independent due checks for price refresh and snapshots.
- Catch-up runs once after multiple missed intervals.
- Scheduler serialization prevents duplicate concurrent writes.
- Asset price series reads `priceHistory`, not snapshot prices.

### Repository tests

- IndexedDB version 2 creates `priceHistory` without losing existing data.
- `replaceAll`, `clearAll`, import, and export include the new store.

### E2E tests

- Repeated same-day manual snapshots render one History row with the latest time and value.
- A next-day save creates a second row.
- Repeated same-day price refreshes render one latest asset-price point.
- Interval selectors persist their values and contain no toggle.
- Disabled price refresh remains disabled when snapshots are due.
- Visibility/focus catch-up performs one due operation.
- History contains no decorative green dots.
- Allocation diagrams remain unchanged.
- Assets and Accounts match the approved compact row metrics on mobile and desktop.
- Related holding rows open Position editing; save/delete work; explicit Asset and Account links navigate correctly.

## Release and deployment

- Release version becomes `3.7.0-final` because the backup schema and IndexedDB schema change.
- Run typecheck, lint, formatting, all unit/integration tests, production PWA build, and mobile/desktop Playwright suites.
- Deploy through the existing GitHub Pages workflow, which is configured as the repository's Pages source.
- Verify the published HTML version, hashed assets, service worker precache, and remote commit SHA.
