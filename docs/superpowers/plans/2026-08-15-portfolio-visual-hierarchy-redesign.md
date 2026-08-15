# Portfolio Visual Hierarchy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated portfolio UI with configurable asset pairs, compact four-plus-Other summaries, an asset-first price detail, and aggregation-only account details.

**Architecture:** Keep USD as the normalized storage currency and persist an ordered `RatePair[]` in settings. Put pair normalization, conversion, top-four aggregation, and snapshot price-series derivation in the pure portfolio view-model; keep DOM generation and chart presentation in the existing renderer/controller boundary. Reuse hash routes and the existing canvas inspection engine so the feature remains compatible with GitHub Pages and the installed PWA.

**Tech Stack:** TypeScript, vanilla DOM, IndexedDB, localStorage settings, Vitest/jsdom, Playwright, Vite, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-08-15-portfolio-visual-hierarchy-redesign.md`

## Global Constraints

- One to three ordered rate pairs; any existing asset is allowed on either side.
- Pair conversion is `source.price / quote.price`; invalid quote prices render unavailable.
- Asset price history comes only from prices already stored in portfolio snapshots.
- Asset detail contains one price chart; its portfolio aggregation has no chart.
- Account detail is aggregation-only and has no chart.
- Assets and Accounts summaries show the four largest entities plus Other.
- Search, tag filters, account search, and Home Exposures are removed.
- All interactive targets remain at least 44 CSS pixels.
- Hash routing, manifest generation, service-worker generation, and GitHub Pages deployment remain supported.

---

### Task 1: Persist ordered rate pairs with backward compatibility

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/platform/browser/settings-store.ts`
- Modify: `src/domain/backup.ts`
- Modify: `src/application/state.ts`
- Modify: `tests/platform/settings-store.test.ts`
- Modify: `tests/domain/backup.test.ts`
- Modify: `tests/application/portfolio-service.test.ts`
- Modify: `tests/application/launch-automation.test.ts`

**Interfaces:**
- Produces: `interface RatePair { sourceAssetId: string; quoteAssetId: string }`
- Produces: `AppSettings.ratePairs: RatePair[]`
- Retains: legacy `selectedRateAssetIds` parsing only as an import/migration input.

- [ ] **Step 1: Write failing settings tests**

Add tests proving pairs preserve order, deduplicate by source, reject malformed records, and cap at three:

```ts
store.save({
  ratePairs: [
    { sourceAssetId: 'usd', quoteAssetId: 'rub' },
    { sourceAssetId: 'btc', quoteAssetId: 'usd' },
    { sourceAssetId: 'usd', quoteAssetId: 'btc' },
  ],
});
expect(store.load().ratePairs).toEqual([
  { sourceAssetId: 'usd', quoteAssetId: 'rub' },
  { sourceAssetId: 'btc', quoteAssetId: 'usd' },
]);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/platform/settings-store.test.ts tests/domain/backup.test.ts`

Expected: TypeScript/test failures because `ratePairs` does not exist.

- [ ] **Step 3: Implement model, settings, and backup migration**

Add the domain type and normalize JSON records with:

```ts
export interface RatePair {
  sourceAssetId: string;
  quoteAssetId: string;
}

function normalizeRatePairs(value: unknown): RatePair[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!isRatePair(item) || seen.has(item.sourceAssetId)) return [];
    seen.add(item.sourceAssetId);
    return [{ ...item }];
  }).slice(0, 3);
}
```

Read legacy selected IDs when no pair list exists; map each legacy source to the saved display-currency code during validated backup migration. Deep-clone pair records in `createBackup`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/platform/settings-store.test.ts tests/domain/backup.test.ts tests/application/portfolio-service.test.ts tests/application/launch-automation.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/platform/browser/settings-store.ts src/application/state.ts tests
git commit -m "feat: persist configurable rate pairs"
```

### Task 2: Add pair conversion, price history, and compact allocation selectors

**Files:**
- Modify: `src/ui/portfolio-view-model.ts`
- Modify: `tests/ui/portfolio-view-model.test.ts`

**Interfaces:**
- Produces: `normalizeRatePairs(data, configured, fallbackQuoteCode?, limit?): RatePair[]`
- Produces: `ratePairRows(data, pairs): RatePairRow[]`
- Produces: `assetPriceHistorySeries(assetId, snapshots): HistoryDatum[]`
- Produces: `compactAssetAllocation(data, limit?): CompactAllocationRow[]`
- Produces: `compactAccountAllocation(data, limit?): CompactAllocationRow[]`

- [ ] **Step 1: Write failing pure-function tests**

Cover arbitrary pair conversion, a zero quote price, deleted IDs, fallback pairs, snapshot price extraction, descending top-four order, and exact Other totals:

```ts
expect(ratePairRows(data, [{ sourceAssetId: 'usd', quoteAssetId: 'rub' }]))
  .toMatchObject([{ value: 86 }]);
expect(assetPriceHistorySeries('btc', snapshots)).toEqual([
  { createdAt: 100, value: 44_000 },
  { createdAt: 200, value: 45_000 },
]);
expect(compactAssetAllocation(data, 4).at(-1)).toMatchObject({
  kind: 'other', count: 7,
});
```

- [ ] **Step 2: Run the view-model test and verify RED**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts`

Expected: imports fail because the new selectors are absent.

- [ ] **Step 3: Implement the pure selectors**

Use absolute entity values for allocation percentages, preserve configured pair order, and return `value: undefined` when conversion cannot be computed. Extract `snapshot.assets[].price`, never the holding `value`, for asset price history.

- [ ] **Step 4: Run the view-model test and verify GREEN**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts`

Expected: all view-model tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/portfolio-view-model.ts tests/ui/portfolio-view-model.test.ts
git commit -m "feat: derive rate pairs and compact allocations"
```

### Task 3: Redesign Home rates and the pair configuration sheet

**Files:**
- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: `tests/legacy/static-shell.characterization.test.ts`

**Interfaces:**
- Consumes: `AppSettings.ratePairs`, `normalizeRatePairs`, and `ratePairRows` from Tasks 1–2.
- Produces: pair form controls named `rateSource` and `rateQuote` with a stable row index.

- [ ] **Step 1: Write a failing Home E2E scenario**

Assert that Exposures and asset codes are absent; `Настроить` is an unfilled text action; the sheet changes Dollar to RUB and Bitcoin to USD; converted values persist after reload; and rate rows open source-asset details.

- [ ] **Step 2: Run the focused E2E test and verify RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "configurable asset pairs"`

Expected: the old checkbox sheet and Exposures UI violate the assertions.

- [ ] **Step 3: Implement pair rendering and form behavior**

Replace checkbox state with three ordered pair rows. On submit read both selects, normalize through the view-model, persist `ratePairs`, and render:

```html
<button class="rate-row" data-rate-asset="btc">
  <span class="driver-icon">₿</span>
  <span class="rate-identity"><strong>Bitcoin</strong><em>Цена актуальна</em></span>
  <span class="rate-value">$45,000</span><i>›</i>
</button>
```

Remove `exposureList` and its section from the shell and renderer. Keep a visible text label for the configure action with no filled surface.

- [ ] **Step 4: Run focused E2E and static-shell tests and verify GREEN**

Run: `npm test -- tests/legacy/static-shell.characterization.test.ts && npm run test:e2e -- --project=mobile-chromium --grep "configurable asset pairs"`

Expected: focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui src/i18n/messages.ts src/styles/app.css tests
git commit -m "feat: add configurable currency pairs"
```

### Task 4: Replace Assets and Accounts controls with four-plus-Other summaries

**Files:**
- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/messages.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**
- Consumes: `compactAssetAllocation` and `compactAccountAllocation` from Task 2.
- Produces DOM containers: `assetAllocationBar`, `assetAllocationList`, `accountAllocationBar`, and `accountAllocationList`.

- [ ] **Step 1: Write failing Assets/Accounts E2E assertions**

Assert no search inputs or filters exist; each allocation legend has exactly five rows for seeded data; Other contains the correct remaining count; and list rows contain value plus change but not allocation percentages.

- [ ] **Step 2: Run the focused E2E scenario and verify RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "compact asset and account allocation"`

Expected: old search/filter DOM is still present and summaries are missing.

- [ ] **Step 3: Implement overview summaries and simplified rows**

Remove asset/account query state and related event listeners. Render top-four segments plus Other with stable colors. Keep every actual asset/account in the list below; row secondary values contain only period change.

- [ ] **Step 4: Run focused E2E and verify GREEN**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "compact asset and account allocation"`

Expected: focused scenario passes at mobile width.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui src/styles/app.css src/i18n/messages.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: simplify portfolio overview tabs"
```

### Task 5: Make asset details price-first and account details aggregation-only

**Files:**
- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/ui/chart.ts`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/messages.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**
- Consumes: `assetPriceHistorySeries` from Task 2 and existing `homePnl` filtering.
- Produces: asset price chart inspection through existing detail chart handlers.
- Produces: account detail without any active chart canvas.

- [ ] **Step 1: Write failing detail E2E assertions**

For an asset, assert icon/name/current rate/freshness appear before an inspectable price chart; tooltip shows the snapshot unit price; Your portfolio has no second canvas and lists related accounts. For an account, assert no chart canvas is visible and all related assets appear inside the aggregate.

- [ ] **Step 2: Run focused detail E2E and verify RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "price-first asset detail|aggregation-only account detail"`

Expected: current detail chart uses holding value and account detail still draws history.

- [ ] **Step 3: Implement entity-specific detail structures**

Render the asset header as icon/name/rate on the left and freshness on the right. Feed `assetPriceHistorySeries` into the chart, compute price change from the selected endpoints, and render holding/account aggregation beneath it. For account routes, hide the chart section and render only balance/change plus related assets. Preserve visible header Add and overflow actions.

- [ ] **Step 4: Run focused detail E2E and verify GREEN**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "price-first asset detail|aggregation-only account detail"`

Expected: both scenarios pass, including touch/keyboard chart inspection for the asset.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui src/styles/app.css src/i18n/messages.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: redesign portfolio entity details"
```

### Task 6: Version, responsive polish, and production verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/domain/backup.ts`
- Modify: `tests/e2e/portfolio.spec.ts`

**Interfaces:**
- Produces: application version `3.6.0` and backup-visible `3.6.0-final`.

- [ ] **Step 1: Extend responsive E2E coverage**

Assert four bottom tabs fit at mobile and desktop widths, direct detail hashes render, browser Back works, configure touch target is at least 44 pixels high, and no horizontal overflow exists on Home, Assets, Accounts, or detail screens.

- [ ] **Step 2: Run full E2E and verify any new assertion fails before polish**

Run: `npm run test:e2e`

Expected: any remaining layout/version assertions fail for the missing final changes.

- [ ] **Step 3: Apply version and final CSS polish**

Set package versions to `3.6.0`, `APP_VERSION` to `3.6.0-final`, and fix only the responsive issues exposed by the tests.

- [ ] **Step 4: Run complete verification**

Run: `npm run check && npm run test:e2e && git diff --check`

Expected: TypeScript, ESLint, Prettier, 23+ unit test files, production PWA build, all mobile/desktop E2E scenarios, and whitespace checks pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src tests index.html
git commit -m "chore: release portfolio redesign 3.6.0"
```
