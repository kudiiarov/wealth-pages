# Portfolio Navigation and Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline portfolio expansion with separate Assets and Accounts tabs, add routable entity detail screens with charts, turn Home drivers into three configurable rates, and make History portfolio-only.

**Architecture:** Add a small hash-router boundary and pure view-model selectors for chosen rates and entity snapshot history. Keep the existing IndexedDB portfolio schema and chart renderer, store only the optional selected rate asset IDs in browser settings, and render entity details as an in-app pushed screen that reuses existing forms and actions.

**Tech Stack:** TypeScript 6, DOM APIs, IndexedDB, Vitest/jsdom, Playwright, Vite 8, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-08-15-portfolio-navigation-and-detail-design.md`

## Global Constraints

- Preserve all existing portfolio and backup data without a backup schema bump.
- Use hash routes so deep links work on GitHub Pages under the repository base path.
- Keep Russian and English translations complete.
- Keep monetary values masked in privacy mode.
- Keep chart pointer, touch, and keyboard inspection accessible.
- Use test-first red-green-refactor for every behavior change.
- Bump the application version to `3.5.0-final` after the feature is complete.

## File Structure

- Create `src/ui/routes.ts`: parse and format the finite set of application routes.
- Create `tests/ui/routes.test.ts`: pure route behavior and invalid hash coverage.
- Modify `src/domain/models.ts`: add optional presentation setting for chosen rate IDs.
- Modify `src/platform/browser/settings-store.ts`: normalize and persist chosen rate IDs.
- Modify `tests/platform/settings-store.test.ts`: settings round-trip and malformed storage coverage.
- Modify `src/ui/portfolio-view-model.ts`: rate selection and entity history selectors.
- Modify `tests/ui/portfolio-view-model.test.ts`: selection, deletion, ordering, and snapshot-series coverage.
- Modify `index.html`: split Assets and Accounts views, add detail view and rate selection dialog, simplify History, expand bottom navigation.
- Modify `src/ui/render.ts`: render flat lists, rates, details, and portfolio-only history.
- Modify `src/ui/events.ts`: route navigation, rate configuration, detail chart inspection, and prefilled position actions.
- Modify `src/i18n/messages.ts`: all new labels, statuses, and accessible names in both locales.
- Modify `src/styles/app.css`: four-item navigation, rate rows, detail surfaces, related rows, and responsive states.
- Modify `tests/ui/dom.test.ts`, `tests/i18n/messages.test.ts`, and `tests/legacy/static-shell.characterization.test.ts`: shell and translation assertions.
- Modify `tests/e2e/portfolio.spec.ts`: replace expandable-row flows with route/detail flows and verify charts/history/rate configuration.
- Modify `package.json`, `package-lock.json`, and `index.html`: version `3.5.0-final` metadata.

---

### Task 1: Pure routes and portfolio selectors

**Files:**

- Create: `src/ui/routes.ts`
- Create: `tests/ui/routes.test.ts`
- Modify: `src/ui/portfolio-view-model.ts`
- Modify: `tests/ui/portfolio-view-model.test.ts`

**Interfaces:**

- Produces: `AppRoute`, `parseAppRoute(hash: string): AppRoute`, `formatAppRoute(route: AppRoute): string`.
- Produces: `selectedRateAssets(data, selectedIds, limit?)`, `assetHistorySeries(assetId, snapshots)`, and `accountHistorySeries(accountId, snapshots)`.
- History selectors return `HistoryDatum[]` sorted by `createdAt` and omit snapshots without the requested entity value.

- [ ] **Step 1: Write failing route tests**

```ts
expect(parseAppRoute('#/assets/btc')).toEqual({ kind: 'asset', id: 'btc' });
expect(parseAppRoute('#/accounts/vault')).toEqual({
  kind: 'account',
  id: 'vault',
});
expect(parseAppRoute('#/unknown')).toEqual({ kind: 'home' });
expect(formatAppRoute({ kind: 'history' })).toBe('#/history');
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `npm test -- tests/ui/routes.test.ts`

Expected: FAIL because `src/ui/routes.ts` does not exist.

- [ ] **Step 3: Implement the finite hash route parser/formatter**

```ts
export type AppRoute =
  | { kind: 'home' }
  | { kind: 'assets' }
  | { kind: 'asset'; id: string }
  | { kind: 'accounts' }
  | { kind: 'account'; id: string }
  | { kind: 'history' }
  | { kind: 'settings' };
```

Decode IDs safely; malformed URI components must resolve to Home rather than throw.

- [ ] **Step 4: Run the route test and verify GREEN**

Run: `npm test -- tests/ui/routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing selector tests**

```ts
expect(selectedRateAssets(data, []).map(({ id }) => id)).toEqual([
  'largest',
  'second',
  'third',
]);
expect(
  selectedRateAssets(data, ['small', 'largest']).map(({ id }) => id),
).toEqual(['small', 'largest']);
expect(selectedRateAssets(data, ['deleted']).map(({ id }) => id)).toEqual([
  'largest',
  'second',
  'third',
]);
expect(assetHistorySeries('btc', snapshots)).toEqual([
  { createdAt: 100, total: 12.34 },
  { createdAt: 200, total: 18.9 },
]);
expect(accountHistorySeries('vault', snapshots)).toEqual([
  { createdAt: 100, total: 20 },
]);
```

- [ ] **Step 6: Run selector tests and verify RED**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts`

Expected: FAIL because the selectors are not exported.

- [ ] **Step 7: Implement selection and history selectors**

Explicit valid IDs retain stored order and are capped at three. If none remain valid, use the three largest assets by absolute current value. Snapshot selectors read `snapshot.assets[].value` and `snapshot.accounts[].total`, accept finite numbers including zero, omit absent/invalid points, and sort ascending.

- [ ] **Step 8: Run selector and route tests**

Run: `npm test -- tests/ui/routes.test.ts tests/ui/portfolio-view-model.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/routes.ts src/ui/portfolio-view-model.ts tests/ui/routes.test.ts tests/ui/portfolio-view-model.test.ts
git commit -m "feat: add portfolio routes and detail selectors"
```

### Task 2: Persist selected rate assets safely

**Files:**

- Modify: `src/domain/models.ts`
- Modify: `src/platform/browser/settings-store.ts`
- Modify: `tests/platform/settings-store.test.ts`

**Interfaces:**

- Adds `selectedRateAssetIds: string[]` to `AppSettings` with default `[]`.
- Adds `SETTINGS_KEYS.selectedRateAssetIds = 'worth-selected-rate-assets'`.

- [ ] **Step 1: Write failing storage tests**

```ts
store.save({ selectedRateAssetIds: ['btc', 'usd', 'xaut'] });
expect(store.load().selectedRateAssetIds).toEqual(['btc', 'usd', 'xaut']);

storage.setItem(
  SETTINGS_KEYS.selectedRateAssetIds,
  '["btc",42,"btc","", "eth", "sol"]',
);
expect(store.load().selectedRateAssetIds).toEqual(['btc', 'eth', 'sol']);
```

Also assert invalid JSON returns `[]` and existing defaults include `selectedRateAssetIds: []`.

- [ ] **Step 2: Run the storage test and verify RED**

Run: `npm test -- tests/platform/settings-store.test.ts`

Expected: FAIL because the setting and key are absent.

- [ ] **Step 3: Implement normalization and persistence**

Parse JSON in a guarded helper, keep unique non-empty strings, preserve order, and cap at three. Save arrays with `JSON.stringify` without changing unrelated settings.

- [ ] **Step 4: Run storage and application service tests**

Run: `npm test -- tests/platform/settings-store.test.ts tests/application/portfolio-service.test.ts`

Expected: PASS after any settings fixture is updated with the safe default.

- [ ] **Step 5: Commit**

```bash
git add src/domain/models.ts src/platform/browser/settings-store.ts tests/platform/settings-store.test.ts tests/application/portfolio-service.test.ts
git commit -m "feat: persist selected portfolio rates"
```

### Task 3: Split Assets and Accounts into flat tab views

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/i18n/messages.test.ts`
- Modify: `tests/legacy/static-shell.characterization.test.ts`

**Interfaces:**

- Replaces `positionsView` with `assetsView` and `accountsView`.
- Replaces `renderPortfolioExplorer()` with `renderAssetsView()` and `renderAccountsView()`.
- Rows expose `data-asset-open="<id>"` or `data-account-open="<id>"`; there are no `data-portfolio-expand` controls.

- [ ] **Step 1: Write failing shell and DOM tests**

Assert the shell has four bottom navigation controls in Home/Assets/Accounts/History order, separate list containers, no portfolio mode segment, and no history scope selector. Add translation-key assertions for both locales.

- [ ] **Step 2: Run shell tests and verify RED**

Run: `npm test -- tests/ui/dom.test.ts tests/i18n/messages.test.ts tests/legacy/static-shell.characterization.test.ts`

Expected: FAIL against the three-tab combined Portfolio shell.

- [ ] **Step 3: Replace the HTML shell**

Add `assetsView` with search, tag filters, summary, list, and asset add button. Add `accountsView` with search, summary, list, and account add button. Render four compact tabs and remove the segmented control.

- [ ] **Step 4: Render independent flat lists**

Keep the current row visual information but remove expanded child markup and sets. Asset rows navigate through `data-asset-open`; account rows navigate through `data-account-open`. Keep filtering only in Assets and use separate query state for each collection.

- [ ] **Step 5: Bind search, filters, add actions, and tab navigation**

Asset add opens `assetModal`; account add opens `accountModal`. Existing category and exposure links route to Assets with the correct filter. Remove dead portfolio-mode and expansion event branches.

- [ ] **Step 6: Add four-tab and list styling**

Use `grid-template-columns: repeat(4, minmax(0, 1fr))`, preserve the compact height, keep labels legible at 320 CSS pixels, and give rows a minimum 44-pixel target.

- [ ] **Step 7: Run focused and full unit tests**

Run: `npm test -- tests/ui/dom.test.ts tests/i18n/messages.test.ts tests/legacy/static-shell.characterization.test.ts tests/ui/portfolio-view-model.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html src/ui/render.ts src/ui/events.ts src/i18n/messages.ts src/styles/app.css tests/ui/dom.test.ts tests/i18n/messages.test.ts tests/legacy/static-shell.characterization.test.ts
git commit -m "feat: split assets and accounts navigation"
```

### Task 4: Add routable asset and account detail screens

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/ui/routes.ts`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/messages.ts`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/ui/routes.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Adds a reusable `entityDetailView` shell with `entityDetailChart`, tooltip, header, metadata, related list, and action controls.
- Adds `navigate(route: AppRoute, options?: { replace?: boolean }): void` and route rendering driven by `hashchange`.
- Extends chart inspection kind to `'detail'` and draws the current entity series.

- [ ] **Step 1: Write failing route/detail integration tests**

Test that clicking an Asset row changes the hash to `#/assets/:id`, displays the correct entity heading, hides the tab bar, and browser back restores Assets. Mirror for Accounts. Test a missing ID falls back to the corresponding list.

- [ ] **Step 2: Run the detail E2E test and verify RED**

Run: `npm run test:e2e -- --grep "opens asset and account details"`

Expected: FAIL because the detail view and routes are absent.

- [ ] **Step 3: Add the reusable detail shell and route lifecycle**

Initialize an empty hash with `#/home` using replacement, listen for `hashchange`, activate exactly one view, hide tabs on detail routes, focus the detail heading, and fall back safely when an entity is missing.

- [ ] **Step 4: Render Asset detail**

Show icon/name/code, value, aggregate quantity, unit price, P&L, freshness, category/tags, chart, and related account rows. Bind edit, price, and add-position actions; preselect `assetId` before opening the existing position form.

- [ ] **Step 5: Render Account detail**

Show icon/name/type, value, position count, P&L, chart, and related asset rows. Bind edit and add-position actions; preselect `accountId` before opening the existing position form.

- [ ] **Step 6: Reuse chart inspection for the detail chart**

Pointer/touch selects nearest points, left/right keys move the selection, focus selects the latest point, blur/cancel clears it, and the tooltip uses `formatExactMoney` plus localized date/time. Privacy mode renders `••••`.

- [ ] **Step 7: Run detail, chart, and route tests**

Run: `npm test -- tests/ui/routes.test.ts tests/ui/chart.test.ts tests/ui/dom.test.ts && npm run test:e2e -- --grep "opens asset and account details|exact"`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html src/ui/render.ts src/ui/events.ts src/ui/routes.ts src/styles/app.css src/i18n/messages.ts tests/ui/dom.test.ts tests/ui/routes.test.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: add asset and account detail screens"
```

### Task 5: Replace Home drivers with configurable rates

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/ui/dom.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- `portfolioRates` contains one to three `data-rate-asset` rows.
- `rateSelectionModal` contains ordered checkboxes keyed by `data-rate-choice` and an inline `rateSelectionError` status.
- Saving calls `service.saveSettings({ selectedRateAssetIds })`.

- [ ] **Step 1: Write failing E2E tests for rates**

Seed four assets with distinct values and prices. Assert the default list contains the top three, each row displays a two-decimal unit price under its percentage, clicking BTC routes to `#/assets/btc`, and selecting a fourth checkbox exposes localized limit feedback.

- [ ] **Step 2: Run the rates E2E test and verify RED**

Run: `npm run test:e2e -- --grep "configures home rates"`

Expected: FAIL because Home still renders portfolio drivers.

- [ ] **Step 3: Replace Home markup and copy**

Rename the section to `Курсы` / `Rates`, add a compact configure action, add the selection sheet, and remove driver-specific controls and copy.

- [ ] **Step 4: Render the rate rows**

Use `selectedRateAssets`, existing Home-period P&L, `asset.price`, display-currency conversion, and `priceUpdatedAt`. Make the whole row a navigable button. Mask absolute change and unit price when privacy mode is enabled.

- [ ] **Step 5: Implement selection behavior**

Initialize choices from the effective selection, preserve click order, allow one to three, prevent the fourth, save only on confirmation, and keep the modal open with an error if the user tries to save zero selections.

- [ ] **Step 6: Run focused unit and E2E tests**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts tests/platform/settings-store.test.ts tests/i18n/messages.test.ts && npm run test:e2e -- --grep "configures home rates"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html src/ui/render.ts src/ui/events.ts src/i18n/messages.ts src/styles/app.css tests/ui/dom.test.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: add configurable home rates"
```

### Task 6: Make History portfolio-only and remove dead scope code

**Files:**

- Modify: `src/application/state.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `index.html`
- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: affected unit fixtures and tests under `tests/`

**Interfaces:**

- Removes `historyScope`, `refreshHistoryScope()`, position history branches, and `#historyScope`.
- `historyData()` always maps snapshots to `snapshot.total`.

- [ ] **Step 1: Write a failing History E2E assertion**

```ts
await page.locator('[data-nav="historyView"]').click();
await expect(page.locator('#historyScope')).toHaveCount(0);
await expect(page.locator('#historyRangeLabel')).toHaveText('Вся история');
```

Also assert snapshot cards and exact chart inspection still use whole-portfolio totals.

- [ ] **Step 2: Run the History test and verify RED**

Run: `npm run test:e2e -- --grep "portfolio-only history"`

Expected: FAIL because the scope select is present.

- [ ] **Step 3: Remove scope UI, events, state, and rendering branches**

Keep snapshot creation and the whole-portfolio empty state. Delete no-longer-used position-history copy only when no remaining action references it.

- [ ] **Step 4: Run History and chart tests**

Run: `npm test -- tests/domain/pnl.test.ts tests/ui/chart.test.ts tests/ui/dom.test.ts && npm run test:e2e -- --grep "portfolio-only history|exact"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/state.ts src/ui/render.ts src/ui/events.ts index.html src/i18n/messages.ts tests
git commit -m "refactor: keep history portfolio-wide"
```

### Task 7: Version, responsive polish, migration verification, and release

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `index.html`
- Modify: `src/styles/app.css`
- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: any test fixtures affected by the new default setting.

**Interfaces:**

- Application package version is `3.5.0`; visible build label is `3.5.0-final`.
- No backup schema or IndexedDB database version change.

- [ ] **Step 1: Add final mobile and desktop E2E coverage**

Cover a 320-pixel-wide four-tab bar, rate-to-asset navigation, Assets/Accounts detail back flows, both detail charts, privacy masking, EN/RU labels, page reload on a hash detail route, import/export compatibility, and restored navigation after deleting an entity.

- [ ] **Step 2: Run the new tests and verify any missing polish fails**

Run: `npm run test:e2e`

Expected: any remaining layout, navigation, or migration gaps fail before final corrections.

- [ ] **Step 3: Apply scoped responsive/accessibility corrections**

Keep four labels readable without horizontal scrolling, constrain detail content to the existing application width, preserve safe-area padding, maintain 44-pixel targets, and verify headings, back buttons, charts, dialogs, and live errors have useful accessible names.

- [ ] **Step 4: Bump version metadata**

Run: `npm version 3.5.0 --no-git-tag-version`

Update the visible `index.html` build note to `Worth · 3.5.0-final`.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm run check
npm run test:e2e
git diff --check
```

Expected: TypeScript, ESLint, Prettier, all Vitest suites, Vite/PWA build, all Playwright projects, and whitespace checks pass with no warnings caused by the change.

- [ ] **Step 6: Inspect both principal screens visually**

Capture mobile screenshots of Home, Assets, Accounts, one Asset detail, one Account detail, and History. Confirm the selected rate values, four-tab layout, back affordance, related-entity rows, charts, safe-area spacing, and dark/light contrast match the approved direction.

- [ ] **Step 7: Review compatibility and repository state**

Confirm existing backups import, `git status --short` contains only intended changes, `git diff --check` is empty, and the PWA precache includes the rebuilt entry assets under the configured GitHub Pages base.

- [ ] **Step 8: Commit and push**

```bash
git add package.json package-lock.json index.html src tests
git commit -m "release: finalize portfolio detail experience"
git push origin main
```

Confirm remote `main` resolves to the final local commit before reporting completion.
