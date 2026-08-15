# Daily History, Scheduling, and Compact Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one-record-per-local-day portfolio and asset-price history, minute-based active-PWA automation, compact Assets/Accounts presentation, and direct Position editing from detail pages.

**Architecture:** Add pure daily-history normalization/upsert functions in the domain and make IndexedDB v2 plus backup v16 carry a separate `priceHistory` store. Keep automation as a serialized application service with a small browser lifecycle adapter. Reuse the existing position form as a detail-origin sheet and adjust the current renderer/CSS without changing allocation diagram markup.

**Tech Stack:** TypeScript 6, Vite 8, IndexedDB, Vitest/jsdom/fake-indexeddb, Playwright, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-08-15-daily-history-scheduling-and-compact-portfolio-design.md`

## Global Constraints

- Target release is `3.7.0-final`; backup version is `16`; IndexedDB version is `2`.
- Daily identity uses the device's local `YYYY-MM-DD` calendar day and keeps the newest observation in that day.
- Automatic prices are `0 | 5 | 15 | 30 | 60` minutes; automatic snapshots are `0 | 30 | 60` minutes; `0` is Off.
- Prices and snapshots are independent; a snapshot never forces a price request.
- iOS/PWA scheduling is best-effort while active and performs at most one catch-up operation of each kind.
- Allocation diagrams and their current single-column legend must remain unchanged.
- Use test-first red/green cycles for every behavior change.

---

### Task 1: Pure Daily History Rules

**Files:**

- Create: `src/domain/daily-history.ts`
- Create: `tests/domain/daily-history.test.ts`

**Interfaces:**

- Produces: `localDayKey(timestamp: number): string`
- Produces: `dailySnapshotId(dayKey: string): string`
- Produces: `dailyPriceHistoryId(assetId: string, dayKey: string): string`
- Produces: `upsertDailySnapshot(snapshots: readonly Snapshot[], snapshot: Snapshot): Snapshot[]`
- Produces: `upsertDailyPricePoint(points: readonly PriceHistoryPoint[], point: PriceHistoryPoint): PriceHistoryPoint[]`
- Produces: `compactDailyHistory(data: PortfolioData): PortfolioData`

- [ ] **Step 1: Write failing local-day and last-write-wins tests**

```ts
test('uses local calendar components instead of the UTC date', () => {
  const timestamp = new Date(2026, 7, 15, 0, 5).getTime();
  expect(localDayKey(timestamp)).toBe('2026-08-15');
});

test('replaces the same local day with the newest snapshot', () => {
  const result = upsertDailySnapshot(
    [{ id: 'old', createdAt: new Date(2026, 7, 15, 9).getTime(), total: 10 }],
    { id: 'new', createdAt: new Date(2026, 7, 15, 18).getTime(), total: 25 },
  );
  expect(result).toEqual([
    {
      id: 'daily-snapshot:2026-08-15',
      createdAt: new Date(2026, 7, 15, 18).getTime(),
      total: 25,
    },
  ]);
});

test('keeps one newest price per asset and local day', () => {
  const result = compactDailyHistory(fixtureWithTwoSameDayPrices);
  expect(result.priceHistory).toMatchObject([
    {
      id: 'daily-price:btc:2026-08-15',
      assetId: 'btc',
      usdPrice: 46_000,
    },
  ]);
});
```

- [ ] **Step 2: Verify the tests fail because the module and model do not exist**

Run: `npm test -- tests/domain/daily-history.test.ts`
Expected: FAIL resolving `src/domain/daily-history.ts` or `PriceHistoryPoint`.

- [ ] **Step 3: Implement local-day keys, canonical IDs, sorted upserts, and compaction**

```ts
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const part = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

export function upsertDailySnapshot(
  snapshots: readonly Snapshot[],
  snapshot: Snapshot,
): Snapshot[] {
  const dayKey = localDayKey(snapshot.createdAt);
  return [
    ...snapshots.filter((item) => localDayKey(item.createdAt) !== dayKey),
    {
      ...snapshot,
      id: dailySnapshotId(dayKey),
    },
  ].sort((left, right) => left.createdAt - right.createdAt);
}
```

Implement price upsert with the composite asset/day identity. `compactDailyHistory` must extract legacy snapshot asset prices, merge existing price points, retain greatest `createdAt`, canonicalize IDs, and return arrays sorted by `createdAt`.

- [ ] **Step 4: Run the focused domain tests**

Run: `npm test -- tests/domain/daily-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the pure domain behavior**

```bash
git add src/domain/daily-history.ts tests/domain/daily-history.test.ts
git commit -m "feat: compact portfolio history by local day"
```

### Task 2: Price History Storage and Backup Migration

**Files:**

- Modify: `src/domain/models.ts`
- Modify: `src/domain/normalize.ts`
- Modify: `src/application/ports.ts`
- Modify: `src/application/state.ts`
- Modify: `src/infrastructure/indexeddb/portfolio-repository.ts`
- Modify: `src/domain/backup.ts`
- Modify: `tests/infrastructure/portfolio-repository.test.ts`
- Modify: `tests/domain/backup.test.ts`
- Modify: `tests/domain/normalize.test.ts`
- Modify: `tests/fixtures/legacy-backups.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: `compactDailyHistory(data)` from Task 1.
- Produces: `PriceHistoryPoint`, `PortfolioData.priceHistory`, and `EntityByStore.priceHistory`.
- Produces: repository store list `['accounts', 'assets', 'positions', 'snapshots', 'priceHistory']` at `DB_VERSION = 2`.
- Produces: backup v16 that imports versions 1–16 and exports canonical daily data.

- [ ] **Step 1: Add failing repository upgrade and v15/v16 backup tests**

```ts
test('upgrades version 1 and creates priceHistory without deleting records', async () => {
  await seedVersionOneDatabase({ accounts: [account], snapshots: [snapshot] });
  const data = await new IndexedDbPortfolioRepository(indexedDB).load();
  expect(data.accounts).toHaveLength(1);
  expect(data.priceHistory).toHaveLength(1);
});

test('imports v15 and exports canonical v16 daily history', () => {
  const imported = validateBackup(v15WithSameDaySnapshots);
  const backup = createBackup(imported.data, settings, exportedAt);
  expect(backup.version).toBe(16);
  expect(backup.snapshots).toHaveLength(1);
  expect(backup.priceHistory).toHaveLength(1);
});
```

- [ ] **Step 2: Verify storage and backup tests fail on schema v1/v15**

Run: `npm test -- tests/infrastructure/portfolio-repository.test.ts tests/domain/backup.test.ts tests/domain/normalize.test.ts`
Expected: FAIL because `priceHistory` is missing and exported version is 15.

- [ ] **Step 3: Extend models, normalization, store mapping, and empty state**

```ts
export interface PriceHistoryPoint {
  id: EntityId;
  assetId: EntityId;
  dayKey: string;
  createdAt: number;
  usdPrice: number;
  source?: PriceSource;
}

export interface PortfolioData {
  accounts: Account[];
  assets: Asset[];
  positions: Position[];
  snapshots: Snapshot[];
  priceHistory: PriceHistoryPoint[];
}
```

Normalize invalid price-history rows out, preserve optional source metadata, and update every `PortfolioData` initializer/fixture with `priceHistory: []`.

- [ ] **Step 4: Upgrade IndexedDB and compact loaded records atomically**

Set `DB_VERSION = 2`; add `priceHistory` to `STORE_NAMES`; read/write all five stores. After the initial read, call `compactDailyHistory`. If canonical contents differ, replace all five stores in one transaction before returning the compacted data.

- [ ] **Step 5: Implement backup v16 with legacy settings acceptance**

```ts
export const BACKUP_VERSION = 16;
export const APP_VERSION = '3.7.0-final';
```

Parse optional legacy `priceHistory`, compact all imported data, and export cloned price points. Continue accepting old boolean/hour automation fields for conversion in Task 4.

- [ ] **Step 6: Run repository and backup suites**

Run: `npm test -- tests/infrastructure/portfolio-repository.test.ts tests/domain/backup.test.ts tests/domain/normalize.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit schema and backup migration**

```bash
git add src/domain src/application/ports.ts src/application/state.ts src/infrastructure/indexeddb tests/domain tests/infrastructure tests/fixtures tests/e2e/portfolio.spec.ts
git commit -m "feat: persist daily asset price history"
```

### Task 3: Daily Writes in Portfolio Service

**Files:**

- Modify: `src/application/portfolio-service.ts`
- Modify: `tests/application/portfolio-service.test.ts`

**Interfaces:**

- Consumes: daily upsert helpers from Task 1 and repository mapping from Task 2.
- Produces: manual and provider price changes that atomically write live Asset plus its daily price point.
- Produces: `saveSnapshot()` that replaces the same-day record.

- [ ] **Step 1: Write failing service tests for same-day snapshot and price replacement**

```ts
test('saveSnapshot replaces an earlier snapshot on the same local day', async () => {
  await service.saveSnapshot();
  clock.set(new Date(2026, 7, 15, 18).getTime());
  await service.saveSnapshot();
  expect(service.data.snapshots).toHaveLength(1);
  expect(service.data.snapshots[0]?.createdAt).toBe(clock.now());
});

test('successful quotes update one latest daily price point per asset', async () => {
  await service.refreshPrices('btc');
  prices.setQuote('btc', 46_000);
  await service.refreshPrices('btc');
  expect(service.data.priceHistory).toMatchObject([
    { assetId: 'btc', usdPrice: 46_000 },
  ]);
});
```

Also test manual edits, partial provider failures, and that snapshot writes do not invoke the provider.

- [ ] **Step 2: Verify focused tests fail with duplicate snapshots/missing price history**

Run: `npm test -- tests/application/portfolio-service.test.ts`
Expected: FAIL on record counts and missing price points.

- [ ] **Step 3: Implement daily snapshot and price-point upserts**

Use one `now` value per operation. Write the canonical record via `repository.put`; delete a legacy same-day ID only when it differs from the canonical ID. For a quote/manual edit, write the Asset first and its `PriceHistoryPoint` only for valid successful prices, then reload once after the batch.

- [ ] **Step 4: Run service tests**

Run: `npm test -- tests/application/portfolio-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit service writes**

```bash
git add src/application/portfolio-service.ts tests/application/portfolio-service.test.ts
git commit -m "feat: overwrite daily snapshots and prices"
```

### Task 4: Minute Interval Settings

**Files:**

- Modify: `src/domain/models.ts`
- Modify: `src/platform/browser/settings-store.ts`
- Modify: `src/domain/backup.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `index.html`
- Modify: `tests/platform/settings-store.test.ts`
- Modify: `tests/domain/backup.test.ts`
- Modify: `tests/ui/dom.test.ts`

**Interfaces:**

- Produces: `PriceRefreshIntervalMinutes = 0 | 5 | 15 | 30 | 60`.
- Produces: `SnapshotIntervalMinutes = 0 | 30 | 60`.
- Produces: `AppSettings.priceRefreshIntervalMinutes` and `snapshotIntervalMinutes`; removes runtime use of old booleans/hour fields.

- [ ] **Step 1: Write failing settings/default/migration tests**

```ts
test('defaults prices to 60 minutes and snapshots to off', () => {
  expect(new BrowserSettingsStore(storage).load()).toMatchObject({
    priceRefreshIntervalMinutes: 60,
    snapshotIntervalMinutes: 0,
  });
});

test('maps enabled legacy hourly settings to 60 minutes', () => {
  storage.setItem('worth-auto-price-refresh', '1');
  storage.setItem('worth-price-refresh-hours', '3');
  expect(
    new BrowserSettingsStore(storage).load().priceRefreshIntervalMinutes,
  ).toBe(60);
});
```

- [ ] **Step 2: Verify tests fail because minute settings do not exist**

Run: `npm test -- tests/platform/settings-store.test.ts tests/domain/backup.test.ts tests/ui/dom.test.ts`
Expected: FAIL on missing settings and old toggle DOM.

- [ ] **Step 3: Implement settings parsing and persistence**

Use new keys `worth-price-refresh-minutes` and `worth-snapshot-minutes`. Prefer valid new values; otherwise migrate old toggle/hour keys. Saving new settings writes only the new keys.

- [ ] **Step 4: Replace Settings toggles with two selectors**

Render exactly the allowed values, with `0` labeled `Нет`/`Off`. Remove checkbox enable/disable code and save the selected numeric interval directly. Freshness thresholds use the selected price interval, falling back to 60 minutes when Off so visual status remains meaningful.

- [ ] **Step 5: Run settings, backup, and DOM tests**

Run: `npm test -- tests/platform/settings-store.test.ts tests/domain/backup.test.ts tests/ui/dom.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit minute selectors**

```bash
git add src/domain/models.ts src/platform/browser/settings-store.ts src/domain/backup.ts src/i18n/messages.ts src/ui/render.ts src/ui/events.ts index.html tests/platform tests/domain/backup.test.ts tests/ui/dom.test.ts
git commit -m "feat: configure automation in minutes"
```

### Task 5: Active-PWA Scheduler and Independent Due Work

**Files:**

- Modify: `src/application/launch-automation.ts`
- Create: `src/platform/browser/active-pwa-scheduler.ts`
- Modify: `src/main.ts`
- Modify: `tests/application/launch-automation.test.ts`
- Create: `tests/platform/active-pwa-scheduler.test.ts`

**Interfaces:**

- Produces: `isAutomationDue(now, lastCompletedAt, intervalMinutes): boolean` where `0` is never due.
- Produces: serialized `LaunchAutomation.run()` that independently performs each due operation.
- Produces: `ActivePwaScheduler.start(): void`, `settingsChanged(): void`, and `dispose(): void`.

- [ ] **Step 1: Write failing independent-operation and catch-up tests**

```ts
test('saves a due snapshot without refreshing disabled prices', async () => {
  target.settings.priceRefreshIntervalMinutes = 0;
  target.settings.snapshotIntervalMinutes = 30;
  await automation.run();
  expect(events).toEqual(['snapshot']);
});

test('coalesces concurrent lifecycle checks into one run', async () => {
  scheduler.start();
  dispatchVisibleFocusAndPageshow();
  await flushPromises();
  expect(target.completedRuns).toBe(1);
});
```

- [ ] **Step 2: Verify automation tests fail on coupled refresh/snapshot behavior**

Run: `npm test -- tests/application/launch-automation.test.ts tests/platform/active-pwa-scheduler.test.ts`
Expected: FAIL because snapshot currently forces price refresh and no lifecycle scheduler exists.

- [ ] **Step 3: Separate due work and add operation diagnostics**

```ts
if (priceDue) await this.target.refreshPrices();
if (snapshotDue) await this.target.saveSnapshot();
```

Catch each operation independently, log configured interval/due/error, continue to the other operation, and keep the existing shared in-flight promise.

- [ ] **Step 4: Implement the lifecycle scheduler**

Register `visibilitychange`, `pageshow`, and `focus`; schedule the nearest enabled due time only while visible; reschedule after a run and after settings changes. `dispose()` removes listeners and clears the owned timer. Wire it once in `main.ts` after initial render.

- [ ] **Step 5: Run automation and lifecycle tests**

Run: `npm test -- tests/application/launch-automation.test.ts tests/platform/active-pwa-scheduler.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit active scheduling**

```bash
git add src/application/launch-automation.ts src/platform/browser/active-pwa-scheduler.ts src/main.ts tests/application/launch-automation.test.ts tests/platform/active-pwa-scheduler.test.ts
git commit -m "feat: schedule due work while pwa is active"
```

### Task 6: Daily Charts and Clean History Rows

**Files:**

- Modify: `src/ui/portfolio-view-model.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/ui/portfolio-view-model.test.ts`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: `PortfolioData.priceHistory` from Task 2.
- Produces: `assetPriceHistorySeries(assetId, priceHistory)` based only on daily points.
- Produces: History rows with no `.history-dot` and daily snapshot chart data.

- [ ] **Step 1: Write failing asset-series and History markup tests**

```ts
test('builds asset price history from priceHistory rather than snapshots', () => {
  expect(assetPriceHistorySeries('btc', points)).toEqual([
    { createdAt: dayOne, value: 45_000 },
    { createdAt: dayTwo, value: 46_000 },
  ]);
});

test('history rows do not render decorative status dots', () => {
  renderer.renderAll();
  expect(document.querySelector('.history-dot')).toBeNull();
});
```

- [ ] **Step 2: Verify tests fail on snapshot-derived prices and green dots**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts tests/ui/dom.test.ts`
Expected: FAIL.

- [ ] **Step 3: Switch asset detail series and remove green-dot markup/CSS**

Update `detailSeries()` to pass `service.data.priceHistory`. Keep portfolio/account/value charts on snapshots. Remove only `.history-dot`; retain dates, latest same-day time, difference, value, and overflow action.

- [ ] **Step 4: Run view-model and DOM tests**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts tests/ui/dom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit daily chart rendering**

```bash
git add src/ui/portfolio-view-model.ts src/ui/render.ts src/styles/app.css tests/ui/portfolio-view-model.test.ts tests/ui/dom.test.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: render daily price and portfolio history"
```

### Task 7: Position Sheet from Asset and Account Details

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/ui/routes.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/ui/routes.test.ts`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Produces: related rows with `data-position-open="<position-id>"`.
- Produces: position form detail context with Asset link, Account link, unit price, and calculated value.
- Produces: source route restoration after save/delete/close.

- [ ] **Step 1: Write a failing E2E regression for the navigation loop**

```ts
test('opens and edits a position from asset and account detail rows', async ({
  page,
}) => {
  await page.goto('#/assets/usdt');
  await page.locator('[data-position-open]').first().click();
  await expect(page.locator('#positionModal')).toBeVisible();
  await expect(page.locator('[data-position-asset-link]')).toContainText(
    'Tether',
  );
  await expect(page.locator('[data-position-account-link]')).toContainText(
    'Trust',
  );
  await page.locator('#positionForm [name="quantity"]').fill('2500');
  await page
    .locator('#positionForm')
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page).toHaveURL(/#\/assets\/usdt$/);
});
```

- [ ] **Step 2: Verify it fails because rows navigate to the opposite entity**

Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "opens and edits a position"`
Expected: FAIL because `[data-position-open]` does not exist.

- [ ] **Step 3: Render position identity and values in the existing form sheet**

Add compact Asset/Account identity buttons, current unit price, and calculated value to `positionModal`. `openPositionEdit(position, sourceRoute)` populates the existing selects/quantity/comment and updates read-only values; no duplicate form or validation is introduced.

- [ ] **Step 4: Route related rows to the position sheet and restore source**

Replace `data-account-open`/`data-asset-open` on detail holding rows with `data-position-open`. Store the current Asset/Account hash in form/dialog state. Close and successful save/delete call `goToRoute(sourceRoute)`; explicit identity buttons still open the linked Asset or Account.

- [ ] **Step 5: Run route, DOM, and focused E2E tests**

Run: `npm test -- tests/ui/routes.test.ts tests/ui/dom.test.ts`
Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "position"`
Expected: PASS.

- [ ] **Step 6: Commit position navigation**

```bash
git add index.html src/ui/render.ts src/ui/events.ts src/ui/routes.ts src/i18n/messages.ts src/styles/app.css tests/ui tests/e2e/portfolio.spec.ts
git commit -m "fix: edit positions from entity details"
```

### Task 8: Compact Assets and Accounts, Release, and Full Verification

**Files:**

- Modify: `src/ui/render.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Preserves: allocation bar/list markup and single-column legend.
- Produces: approximately 70 px separate rows, 46 px icons, 16 px names, 11–12 px secondary text, 15 px right values, and 9 px row gaps.
- Produces: release `3.7.0-final` (`package.json` version `3.7.0`).

- [ ] **Step 1: Add failing DOM/E2E assertions for compact row semantics**

```ts
test('keeps allocation legend unchanged and renders compact separate rows', () => {
  renderer.renderAll();
  expect(
    document.querySelectorAll('#assetAllocationList .compact-allocation-key'),
  ).toHaveLength(5);
  expect(
    document.querySelectorAll('#assetsList > .portfolio-row'),
  ).toHaveLength(assetCount);
  expect(
    document.querySelector('#assetsList > .portfolio-list-card'),
  ).toBeNull();
});
```

In Playwright assert row/icon computed sizes within a 2 px tolerance and verify both mobile and desktop projects.

- [ ] **Step 2: Verify focused tests fail on current row density**

Run: `npm test -- tests/ui/dom.test.ts`
Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "compact assets and accounts"`
Expected: FAIL on computed dimensions while diagram assertions remain green.

- [ ] **Step 3: Apply compact typography and spacing without touching allocation markup**

Scope CSS to Assets/Accounts overview and related detail lists. Keep every entity as a separate rounded button with 9 px spacing; do not wrap all rows in one rounded container. Preserve title/add controls and existing list contents while tightening hierarchy to the approved preview.

- [ ] **Step 4: Update release metadata**

Run: `npm version 3.7.0 --no-git-tag-version`
Expected: `package.json` and `package-lock.json` report `3.7.0`; application backup reports `3.7.0-final` from Task 2.

- [ ] **Step 5: Run focused UI tests and inspect mobile screenshots**

Run: `npm test -- tests/ui/dom.test.ts`
Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "compact assets and accounts"`
Expected: PASS with unchanged diagram/legend and compact independent rows.

- [ ] **Step 6: Run complete verification**

Run: `npm run check`
Expected: typecheck, lint, formatting check, all Vitest tests, and production PWA build pass.

Run: `npm run test:e2e`
Expected: all configured Playwright projects pass.

- [ ] **Step 7: Commit release and push branch**

```bash
git add src tests index.html package.json package-lock.json
git commit -m "feat: ship compact daily portfolio experience"
git push origin codex/daily-history-compact
```

- [ ] **Step 8: Verify remote branch identity**

Run: `git status -sb && git rev-parse HEAD && git rev-parse origin/codex/daily-history-compact`
Expected: clean branch and identical local/remote SHAs.
