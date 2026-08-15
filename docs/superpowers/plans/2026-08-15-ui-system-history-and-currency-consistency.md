# UI System, History Repair, and Currency Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the affected UI patterns, repair History, remove redundant freshness copy, and calculate asset history in date-aligned display currencies.

**Architecture:** Add a pure date-aligned cross-rate series function to the existing portfolio view-model, then make the renderer consume already-converted detail-chart values. Establish semantic CSS tokens and reusable presentation classes in the existing stylesheet and migrate Home, Accounts, History, and Asset Detail without changing event data attributes.

**Tech Stack:** TypeScript 6, DOM-rendered HTML, CSS custom properties, Vitest/JSDOM, Playwright, Vite PWA

**Spec:** `docs/superpowers/specs/2026-08-15-ui-system-history-and-currency-consistency-design.md`

## Global Constraints

- Keep USD as the canonical stored price currency and retain daily `PriceHistoryPoint` records.
- Match historical non-USD source and quote prices by canonical `dayKey`; never apply today's quote to an older point.
- Source and quote representing the same asset must always produce `1` and zero movement.
- Remove healthy-state `Price current` copy only; stale and manual states remain explicit.
- Preserve all existing event `data-*` attributes and minimum 44 px interactive targets.
- Do not add dependencies, storage migrations, or backup-version changes.

---

### Task 1: Date-aligned historical cross-rates

**Files:**

- Modify: `src/ui/portfolio-view-model.ts`
- Test: `tests/ui/portfolio-view-model.test.ts`

**Interfaces:**

- Consumes: `PortfolioData`, source asset ID, quote asset ID or `USD`, and existing `PriceHistoryPoint.dayKey` records.
- Produces: `assetPriceHistoryInQuote(sourceAssetId: string, quoteAssetId: string | undefined, data: PortfolioData): HistoryDatum[]`.

- [ ] **Step 1: Write failing unit tests**

Add tests asserting that RUB/RUB history with changing USD observations returns values `[1, 1]`, BTC/USD preserves BTC's USD values, BTC/RUB divides same-day BTC USD by RUB USD, and unmatched/zero quote days are omitted.

```ts
expect(
  assetPriceHistoryInQuote('rub', 'rub', data).map(({ value }) => value),
).toEqual([1, 1]);
expect(
  assetPriceHistoryInQuote('btc', 'rub', data).map(({ value }) => value),
).toEqual([4_000_000, 4_300_000]);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts`  
Expected: FAIL because `assetPriceHistoryInQuote` is not exported.

- [ ] **Step 3: Implement the pure converter**

Index quote points by `dayKey`; special-case USD and identical IDs; validate finite positive quote values; preserve source timestamps; sort chronologically.

```ts
export function assetPriceHistoryInQuote(
  sourceAssetId: string,
  quoteAssetId: string | undefined,
  data: PortfolioData,
): HistoryDatum[];
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/ui/portfolio-view-model.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/portfolio-view-model.ts tests/ui/portfolio-view-model.test.ts
git commit -m "fix: calculate historical cross rates by day"
```

### Task 2: Render corrected detail history and zero self-currency movement

**Files:**

- Modify: `src/ui/render.ts`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: `assetPriceHistoryInQuote(...)` from Task 1.
- Produces: detail series already expressed in the display currency; chart formatter uses identity conversion for this series.

- [ ] **Step 1: Write failing browser regression**

Seed two RUB price-history days with different USD values, select RUB as display currency, open RUB, and assert the hero shows unit price `1 ₽`, change `0 ₽ · 0.0%`, and a flat chart series.

- [ ] **Step 2: Verify RED**

Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "self currency"`  
Expected: FAIL because the current renderer compares USD observations and converts them through the live RUB price.

- [ ] **Step 3: Connect the converted series**

Change `detailSeries()` to call `assetPriceHistoryInQuote` with the routed source asset and selected display asset. Return values in display units, calculate the hero's current cross-rate as `source.price / quote.price` (or source USD price for USD display), and pass identity `displayValue`/display-aware formatting into the detail chart.

- [ ] **Step 4: Verify GREEN**

Run the focused Playwright test and `npm test -- tests/ui/portfolio-view-model.test.ts`.  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.ts tests/e2e/portfolio.spec.ts
git commit -m "fix: keep self-currency history flat"
```

### Task 3: Simplify freshness and Accounts metadata

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/i18n/messages.ts`
- Test: `tests/legacy/static-shell.characterization.test.ts`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: existing asset freshness classification and `formatRelativeTime`.
- Produces: `.ui-freshness` markup with current/stale/manual variants and account-count-only metadata.

- [ ] **Step 1: Write failing shell and E2E assertions**

Assert `#priceTrust` is absent; Accounts metadata equals only the localized count; Exchange Rates and Asset Detail do not contain `Price current`; current automatic prices expose one `.ui-freshness.current` containing a time value.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/legacy/static-shell.characterization.test.ts` and the focused freshness Playwright test.  
Expected: FAIL on existing Home markup and healthy-state copy.

- [ ] **Step 3: Implement semantic freshness rendering**

Remove `#priceTrust` from `index.html` and its unconditional renderer lookup. Add a renderer helper returning freshness state/time markup, use it in rate rows and asset hero, and make Accounts metadata only `this.t('accountsCount', rows.length)`. Remove message keys only after TypeScript confirms no consumers remain.

- [ ] **Step 4: Verify GREEN**

Run both focused suites and `npm run typecheck`.  
Expected: PASS with no missing DOM element or message-key failures.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/render.ts src/i18n/messages.ts tests/legacy/static-shell.characterization.test.ts tests/e2e/portfolio.spec.ts
git commit -m "refactor: simplify portfolio freshness metadata"
```

### Task 4: Shared UI tokens and History repair

**Files:**

- Modify: `src/styles/app.css`
- Modify: `src/ui/render.ts`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: current CSS theme variables and existing renderer event attributes.
- Produces: `--ui-*` metric tokens plus `.ui-icon-button`, `.ui-icon-tile`, `.ui-list-row`, `.ui-surface`, `.ui-segmented`, and `.ui-freshness` primitives.

- [ ] **Step 1: Write failing layout assertions**

At mobile and desktop viewports, assert History rows have date, time/delta, value, visible 44 px menu action, no horizontal overflow, and primitive classes. Assert affected icon buttons, rows, period controls, and freshness elements use the shared classes.

- [ ] **Step 2: Verify RED**

Run: `npm run test:e2e -- tests/e2e/portfolio.spec.ts --grep "shared UI|history layout"`  
Expected: FAIL because primitive classes/tokens and repaired History grid are absent.

- [ ] **Step 3: Add tokens and migrate affected markup**

Define semantic custom properties at `:root`, implement the six primitive classes, alias existing screen selectors where useful, and update renderer markup for History and affected rows. Give History its own `minmax(0, 1fr) minmax(0, auto) 44px` grid so portfolio-row compaction cannot distort it.

- [ ] **Step 4: Verify GREEN**

Run the focused Playwright tests in mobile and desktop projects.  
Expected: PASS without overflow or touch-target regressions.

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css src/ui/render.ts tests/e2e/portfolio.spec.ts
git commit -m "refactor: unify portfolio UI primitives"
```

### Task 5: Full verification and cleanup

**Files:**

- Modify only files required by formatter or test-discovered regressions.

**Interfaces:**

- Consumes: deliverables from Tasks 1–4.
- Produces: a release-ready working tree with all quality gates passing.

- [ ] **Step 1: Run static and unit gates**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`  
Expected: all commands exit 0 with no test failures.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: TypeScript and Vite production build exit 0.

- [ ] **Step 3: Run Playwright**

Run: `npm run test:e2e`  
Expected: all configured browser projects pass.

- [ ] **Step 4: Inspect final diff**

Run: `git diff --check && git status --short && git diff --stat`  
Expected: no whitespace errors and only files named in this plan are modified.

- [ ] **Step 5: Commit final cleanup if needed**

```bash
git add <only formatter-or-regression files>
git commit -m "test: verify unified portfolio UI"
```
