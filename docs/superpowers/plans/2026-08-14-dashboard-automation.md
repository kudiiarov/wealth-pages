# Dashboard and Launch Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent launch schedules for prices and snapshots while simplifying Home, grouping Positions, and compacting mobile navigation.

**Architecture:** Persist normalized automation preferences in the existing settings port, evaluate due work in a focused coordinator, and keep portfolio mutations in `PortfolioService`. Build allocation and position grouping as pure view-model functions, then render them through the existing renderer/controller boundary.

**Tech Stack:** TypeScript, Vite, Vitest, DOM APIs, IndexedDB, localStorage, Playwright, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-08-14-dashboard-automation-design.md`

## Global Constraints

- Preserve the current visual language and all editing, history, diagnostics, offline, import/export, and GitHub Pages behavior.
- Schedule intervals are exactly `1 | 3 | 6 | 12 | 24` hours.
- Snapshot-due automation refreshes prices before saving the snapshot.
- All disclosure controls are keyboard accessible and at least 44 by 44 CSS pixels.
- Product version is `3.2.0`; UI and backup version is `3.2.0-final`; backup schema is 15.
- Do not add runtime dependencies.

---

### Task 1: Settings and backup schema 15

**Files:**

- Modify: `src/domain/models.ts`
- Modify: `src/platform/browser/settings-store.ts`
- Modify: `src/domain/backup.ts`
- Modify: `tests/platform/settings-store.test.ts`
- Modify: `tests/domain/backup.test.ts`
- Modify: `tests/fixtures/legacy-backups.ts`

**Interfaces:**

- Produces: `AutomationInterval = 1 | 3 | 6 | 12 | 24`, `PositionGrouping = 'accounts' | 'assets'`.
- Produces on `AppSettings`: `autoPriceRefresh`, `priceRefreshIntervalHours`, `lastPriceRefreshAt`, `autoSnapshot`, `snapshotIntervalHours`, `lastSnapshotAt`, and `positionGrouping`.
- Removes runtime use of `autoRefreshOnLaunch`; schema 1–14 imports still migrate it.

- [ ] **Step 1: Write failing settings-store tests**

Assert empty defaults, exact round-trip of all new settings, normalization of invalid intervals/timestamps, and migration of the legacy `worth-auto-refresh-launch` key. Expected defaults are price disabled/3 hours, snapshot disabled/6 hours, timestamps absent, and account grouping.

- [ ] **Step 2: Run the settings test and verify RED**

Run: `npm test -- --run tests/platform/settings-store.test.ts`

Expected: FAIL because the new `AppSettings` fields and storage keys are missing.

- [ ] **Step 3: Implement normalized browser settings**

Add exact constants and parsing helpers:

```ts
export type AutomationInterval = 1 | 3 | 6 | 12 | 24;
export type PositionGrouping = 'accounts' | 'assets';

const AUTOMATION_INTERVALS = [1, 3, 6, 12, 24] as const;
function interval(
  value: string | null,
  fallback: AutomationInterval,
): AutomationInterval;
function timestamp(value: string | null): number | undefined;
```

Use new `worth-auto-price-refresh`, `worth-price-refresh-hours`, `worth-last-price-refresh`, `worth-auto-snapshot`, `worth-snapshot-hours`, `worth-last-snapshot`, and `worth-position-grouping` keys. Read the legacy auto-refresh key only when the new key is absent.

- [ ] **Step 4: Run settings tests and verify GREEN**

Run: `npm test -- --run tests/platform/settings-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing backup migration tests**

Assert schema 15 exports all preferences, schema 14 migrates `autoRefreshOnLaunch` to `autoPriceRefresh`, invalid scheduling fields are ignored, and schema versions 1–14 remain accepted.

- [ ] **Step 6: Run backup tests and verify RED**

Run: `npm test -- --run tests/domain/backup.test.ts`

Expected: FAIL with schema 14/current settings mismatches.

- [ ] **Step 7: Implement schema 15 parsing and export**

Rename the current backup interface to `BackupV15`, set `BACKUP_VERSION = 15`, parse only valid scheduling values, and return migrated partial settings. Keep fixture 14 immutable as a legacy input.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm test -- --run tests/platform/settings-store.test.ts tests/domain/backup.test.ts`

Commit: `feat: add automation schedule settings`

### Task 2: Launch automation coordinator

**Files:**

- Create: `src/application/launch-automation.ts`
- Create: `tests/application/launch-automation.test.ts`
- Modify: `src/application/portfolio-service.ts`
- Modify: `tests/application/portfolio-service.test.ts`
- Modify: `src/main.ts`

**Interfaces:**

- Consumes: scheduling fields from Task 1.
- Produces: `LaunchAutomation.run(): Promise<void>` with an internal in-flight guard.
- Produces: service methods `refreshPrices(options?: { recordCompletion?: boolean })` and `saveSnapshot(options?: { recordCompletion?: boolean })`, with manual operations recording completion by default.

- [ ] **Step 1: Write failing service timestamp tests**

Verify manual price refresh stores `lastPriceRefreshAt`, manual snapshot stores `lastSnapshotAt`, a thrown refresh stores neither, and partial provider failures still store the price completion timestamp.

- [ ] **Step 2: Run service tests and verify RED**

Run: `npm test -- --run tests/application/portfolio-service.test.ts`

Expected: FAIL because completion timestamps are not saved.

- [ ] **Step 3: Implement service completion timestamps**

Update timestamps only after normal method completion using `saveSettings`. Preserve existing return types and diagnostic summaries.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm test -- --run tests/application/portfolio-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing coordinator tests**

Cover these exact cases with a fake service and fixed clock:

```ts
// prices=3h, snapshots=6h, elapsed=4h => ['refresh']
// snapshots due while prices not due => ['refresh', 'snapshot']
// both disabled => []
// invalid/future completion => due
// two simultaneous run() calls => one operation sequence
// refresh throws while snapshot due => refresh only
```

- [ ] **Step 6: Run coordinator tests and verify RED**

Run: `npm test -- --run tests/application/launch-automation.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 7: Implement due evaluation and serialization**

Use a pure helper:

```ts
export function isAutomationDue(
  now: number,
  lastCompletedAt: number | undefined,
  intervalHours: AutomationInterval,
): boolean;
```

`run()` evaluates both schedules once. If snapshot is due it calls refresh then snapshot; otherwise it refreshes only when price is due. Record `automation.check.completed` diagnostics with due/executed context.

- [ ] **Step 8: Wire launch and foreground lifecycle**

After `service.initialize()` and controller binding, call the coordinator once. Add `visibilitychange`; when the document becomes visible call the same guarded coordinator and re-render after completion.

- [ ] **Step 9: Run focused tests and commit**

Run: `npm test -- --run tests/application/portfolio-service.test.ts tests/application/launch-automation.test.ts`

Commit: `feat: automate prices and snapshots on launch`

### Task 3: Automation settings UI

**Files:**

- Modify: `index.html`
- Modify: `src/i18n/messages.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/i18n/messages.test.ts`
- Modify: `tests/legacy/static-shell.characterization.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: Task 1 settings.
- Produces controls `autoPriceRefresh`, `priceRefreshIntervalHours`, `autoSnapshot`, `snapshotIntervalHours`.

- [ ] **Step 1: Write failing shell and message tests**

Assert both switches and both five-option selects exist, legacy `autoRefreshOnLaunch` is absent, and all RU/EN labels resolve.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/i18n/messages.test.ts tests/legacy/static-shell.characterization.test.ts`

Expected: FAIL for missing controls/messages.

- [ ] **Step 3: Add accessible settings controls**

Replace the old toggle with two rows. Each row contains a checkbox and an interval select disabled when its checkbox is off. Add localized labels for automation, intervals, and hours.

- [ ] **Step 4: Bind and render settings**

On checkbox/select change call `service.saveSettings` with typed values, update disabled state, and keep the existing manual Refresh Prices setting action.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --run tests/i18n/messages.test.ts tests/legacy/static-shell.characterization.test.ts`

Commit: `feat: add automation controls to settings`

### Task 4: Dashboard progressive disclosure

**Files:**

- Create: `src/ui/portfolio-view-model.ts`
- Create: `tests/ui/portfolio-view-model.test.ts`
- Modify: `index.html`
- Modify: `src/application/state.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/legacy/static-shell.characterization.test.ts`

**Interfaces:**

- Produces: `allocationRows(data): AllocationRow[]`, sorted by descending absolute value.
- Adds ephemeral renderer state `allocationExpanded`, `accountsSectionExpanded`, and `assetsSectionExpanded`.

- [ ] **Step 1: Write failing allocation view-model tests**

Assert liabilities sort by absolute value, the first three are identified as initially visible, and the hidden count is total minus three.

- [ ] **Step 2: Run view-model tests and verify RED**

Run: `npm test -- --run tests/ui/portfolio-view-model.test.ts`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement the pure allocation model**

Return rows with `asset`, `quantity`, and `value`; never truncate in the helper so the allocation bar can use every row.

- [ ] **Step 4: Remove dashboard quick actions and add disclosure shells**

Delete Position, Update, and Snapshot buttons from Home. Convert Accounts and Assets title rows to buttons with `aria-expanded` and `aria-controls`; retain separate Add buttons whose clicks do not toggle the section.

- [ ] **Step 5: Render top-three allocation and collapsible sections**

Render three rows unless expanded, followed by a `Show N more`/`Show less` button. Keep all allocation segments. Default Accounts and Assets bodies to collapsed and update accessibility attributes on every render.

- [ ] **Step 6: Remove obsolete quick-update bindings safely**

Remove direct bindings for deleted Home controls. Keep the quick-update modal only if referenced elsewhere; otherwise remove its markup, renderer, form binding, and dead styles as one dependency-cleanup change.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- --run tests/ui/portfolio-view-model.test.ts tests/legacy/static-shell.characterization.test.ts tests/i18n/messages.test.ts`

Commit: `feat: simplify portfolio dashboard`

### Task 5: Grouped Positions

**Files:**

- Create: `src/ui/position-groups.ts`
- Create: `tests/ui/position-groups.test.ts`
- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: `PositionGrouping` from Task 1.
- Produces: `buildPositionGroups(data, grouping): PositionGroup[]` with group identity, title, total, count, and sorted rows.
- Adds ephemeral renderer state `collapsedPositionGroups: Set<string>`.

- [ ] **Step 1: Write failing grouping tests**

Use two accounts, two assets, a liability, and duplicate positions. Assert account and asset group membership, absolute-total group order, and absolute-value row order.

- [ ] **Step 2: Run grouping tests and verify RED**

Run: `npm test -- --run tests/ui/position-groups.test.ts`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement position group view models**

Build groups from current entities, retain every position, calculate totals with existing portfolio helpers, and provide stable keys prefixed with `account:` or `asset:`.

- [ ] **Step 4: Replace the account carousel with grouping controls**

Remove `positionsSummary`. Add a two-button segmented control with `aria-pressed`. Render group buttons and nested position lists; reuse existing row menus and editing behavior.

- [ ] **Step 5: Bind grouping and group disclosure**

Grouping buttons persist `positionGrouping`; group-header buttons only toggle the ephemeral collapsed set. Switching grouping clears stale collapsed keys.

- [ ] **Step 6: Run focused and E2E tests, then commit**

Run: `npm test -- --run tests/ui/position-groups.test.ts tests/i18n/messages.test.ts && npm run test:e2e`

Commit: `feat: group positions by account or asset`

### Task 6: Compact responsive navigation

**Files:**

- Modify: `src/styles/app.css`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: existing `.tab-bar` and `.tab` markup.
- Produces: navigation with reduced visual height and >=44-pixel tab hit areas.

- [ ] **Step 1: Add failing mobile E2E assertions**

At the configured mobile viewport, assert each tab bounding box height is at least 44 pixels, the bar is shorter than its previous 74-pixel visual footprint, and the page has no horizontal overflow after expanding each new disclosure.

- [ ] **Step 2: Run the mobile E2E and verify RED**

Run: `npm run test:e2e -- --project=mobile-chromium`

Expected: FAIL on old navigation height or missing new disclosure interactions.

- [ ] **Step 3: Compact navigation and content inset**

Reduce bar padding, icon size, and label gap; preserve `env(safe-area-inset-bottom)` and a 44-pixel minimum tab height. Update the shell's bottom padding and verify 320-pixel and landscape media rules do not clip controls.

- [ ] **Step 4: Run E2E and commit**

Run: `npm run test:e2e`

Commit: `style: compact mobile navigation`

### Task 7: Release 3.2.0 and full verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/domain/backup.ts`
- Modify: `index.html`
- Modify: `README.md`
- Modify: version assertions in tests

**Interfaces:**

- Produces version `3.2.0`, UI/backup label `3.2.0-final`, backup schema 15.

- [ ] **Step 1: Update version references and compatibility documentation**

Change only current product references; do not rewrite historical fixture versions.

- [ ] **Step 2: Run the full quality gate**

Run:

```sh
npm run check
npm run test:e2e
GITHUB_ACTIONS=true npm run build
npm audit --audit-level=high
git diff --check
```

Expected: all commands exit 0, unit/integration and both E2E projects pass, GitHub Pages assets use the repository base path, and audit reports zero high-severity vulnerabilities.

- [ ] **Step 3: Review changed files and commit**

Run: `git status --short && git diff --stat`

Commit: `release: Worth 3.2.0`

- [ ] **Step 4: Push and verify remote main**

Run: `git push origin main` and compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/main`.
