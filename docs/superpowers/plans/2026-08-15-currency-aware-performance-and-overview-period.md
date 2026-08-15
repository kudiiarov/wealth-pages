# Currency-Aware Performance and Overview Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate portfolio performance in the selected currency with date-aligned quotes, add strict 24-hour/all-time controls to Assets and Accounts, and finish the requested overview UI fixes.

**Architecture:** Add pure quote-normalization and overview-period selection functions beside the existing flow-adjusted P&L domain code. The renderer builds normalized historical series and reuses them for portfolio, account, asset, detail, and chart output; HTML/CSS/events expose a shared session-only overview period without changing persistence.

**Tech Stack:** TypeScript 6, Vitest, Vite 8, Playwright, IndexedDB, vanilla DOM/CSS, GitHub Pages PWA

**Spec:** `docs/superpowers/specs/2026-08-15-currency-aware-performance-and-overview-period-design.md`

## Global Constraints

- Keep IndexedDB authoritative and make no schema or backup-version change.
- Keep domain rules browser-independent; pass timestamps and history into domain functions explicitly.
- Keep USD as the canonical stored price unit and normalize historical values on demand.
- Never substitute today's quote for missing historical quote data.
- `24h` uses the newest compatible snapshot at or before `now - 24 hours` and excludes the current local day.
- Assets and Accounts share one session-level period, defaulting to `all`.
- Preserve RU/EN, light/dark, privacy mode, offline use, iPhone Safari/PWA, and GitHub Pages under `/wealth-pages/`.
- Follow red-green-refactor and avoid unrelated refactors.

## File Structure

- `src/domain/pnl.ts`: quote-normalize `PnlPoint` values, total points, and select strict overview baselines.
- `tests/domain/pnl.test.ts`: mathematical, missing-data, self-quote, cash-flow, aggregation, and period-boundary tests.
- `src/i18n/format.ts`, `tests/i18n/format.test.ts`: format amounts already expressed in the selected unit without converting twice.
- `src/ui/render.ts`: construct normalized series, render summaries/controls, and remove asset codes.
- `src/ui/events.ts`: change the shared overview period.
- `src/i18n/messages.ts`, `tests/i18n/messages.test.ts`: localize new labels and accessibility copy.
- `index.html`, `src/styles/app.css`: allocation metrics, list headers, period controls, and freshness alignment.
- `tests/legacy/static-shell.characterization.test.ts`: characterize required static IDs and data attributes.
- `tests/e2e/portfolio.spec.ts`: verify calculations, interactions, regressions, responsiveness, theme, language, and privacy.

---

### Task 1: Date-Aligned P&L Domain Series

**Files:**

- Modify: `src/domain/pnl.ts`
- Test: `tests/domain/pnl.test.ts`

**Interfaces:**

- Consumes: existing `PnlPoint`, `flowAdjustedPnl()`, `PriceHistoryPoint`, and `localDayKey()`.
- Produces: `normalizePnlPointInQuote()`, `normalizePnlSeriesInQuote()`, `pnlPointTotal()`, `selectOverviewPnlSeries()`, and `OverviewPnlPeriod`.

- [ ] **Step 1: Write failing normalization tests**

Add imports and fixtures to `tests/domain/pnl.test.ts`, then assert:

```ts
expect(normalizePnlPointInQuote(eurPoint, 'rub', [])).toMatchObject({
  positions: [{ assetId: 'eur', price: 96.8, value: 4_840 }],
  assets: expect.arrayContaining([{ assetId: 'rub', price: 1 }]),
});
expect(
  normalizePnlPointInQuote(rubPoint, 'rub', [])?.positions[0],
).toMatchObject({
  price: 1,
  value: 50,
});
expect(
  normalizePnlPointInQuote(pointWithoutRub, 'rub', sameDayRubHistory),
).not.toBeNull();
expect(
  normalizePnlPointInQuote(pointWithoutRub, 'rub', nextDayRubHistory),
).toBeNull();
```

Use unchanged 50 EUR and cross-rates `96.4904` then `96.8`; assert normalized `flowAdjustedPnl()` is close to `15.48 RUB`. Assert unchanged RUB quoted in RUB returns zero P&L.

- [ ] **Step 2: Run normalization tests and verify red**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/domain/pnl.test.ts
```

Expected: FAIL because normalization exports do not exist.

- [ ] **Step 3: Implement point and series normalization**

In `src/domain/pnl.ts`, add:

```ts
export type OverviewPnlPeriod = '24h' | 'all';

export function normalizePnlPointInQuote(
  point: PnlPoint,
  quoteAssetId: string | undefined,
  priceHistory: readonly PriceHistoryPoint[],
): PnlPoint | null;

export function normalizePnlSeriesInQuote(
  points: readonly PnlPoint[],
  quoteAssetId: string | undefined,
  priceHistory: readonly PriceHistoryPoint[],
): PnlPoint[];

export function pnlPointTotal(point: PnlPoint): number;
```

Undefined quote means USD price `1`. For a non-USD quote, prefer a positive finite price in `point.assets`; otherwise match `priceHistory` by quote ID and `localDayKey(point.createdAt)`. Return `null` without a valid quote. Normalize each stored/fallback position price, force self-quoted prices to `1`, recalculate `value`, and preserve metadata. `pnlPointTotal()` sums normalized position values.

- [ ] **Step 4: Run normalization tests and verify green**

Run the Task 1 test command again. Expected: new and existing P&L tests PASS.

- [ ] **Step 5: Write failing strict-period tests**

With `now = new Date(2026, 7, 15, 21).getTime()`, add:

```ts
expect(
  selectOverviewPnlSeries(points, current, '24h', now, localDayKey(now)).map(
    ({ createdAt }) => createdAt,
  ),
).toEqual([august14BeforeCutoff, current.createdAt]);
expect(
  selectOverviewPnlSeries([todayPoint], current, '24h', now, localDayKey(now)),
).toEqual([]);
expect(
  selectOverviewPnlSeries(points, current, 'all', now, localDayKey(now)).map(
    ({ createdAt }) => createdAt,
  ),
).toEqual([august13, august14BeforeCutoff, august15, current.createdAt]);
```

Also prove an August 14 point newer than the cutoff cannot become the baseline.

- [ ] **Step 6: Run strict-period tests and verify red**

Run the Task 1 test command. Expected: FAIL because `selectOverviewPnlSeries()` does not exist.

- [ ] **Step 7: Implement strict period selection**

```ts
export function selectOverviewPnlSeries(
  snapshots: readonly PnlPoint[],
  current: PnlPoint,
  period: OverviewPnlPeriod,
  now: number,
  currentDayKey: string,
): PnlPoint[];
```

Sort without mutating input. `all` returns all snapshots plus current when a snapshot exists. `24h` finds the last snapshot at or before `now - 86_400_000` whose day differs from `currentDayKey`; without it return `[]`. Return that baseline, later compatible non-current-day snapshots, and current.

- [ ] **Step 8: Run tests and commit**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/domain/pnl.test.ts
git add src/domain/pnl.ts tests/domain/pnl.test.ts
git commit -m "fix: normalize portfolio performance by quote date"
```

Expected: all domain P&L tests PASS.

---

### Task 2: Correct Formatting and Renderer Data Flow

**Files:**

- Modify: `src/i18n/format.ts`
- Test: `tests/i18n/format.test.ts`
- Modify: `src/ui/render.ts`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: Task 1's normalization and period functions.
- Produces: `formatDisplayMoney(value, language, displayAsset)` plus renderer helpers `normalizedPnlPoints()`, `overviewPnlSeries()`, and `displayPnlMoney()`.

- [ ] **Step 1: Write a failing display-unit formatting test**

```ts
const rubAsset: Asset = {
  ...euro,
  id: 'rub',
  name: 'Ruble',
  code: 'RUB',
  icon: '₽',
  price: 0.011,
};
expect(formatDisplayMoney(15.48, 'en', rubAsset)).toBe('15.48 ₽');
expect(formatMoney(15.48 * rubAsset.price, 'en', rubAsset)).toBe('15.48 ₽');
```

- [ ] **Step 2: Run the formatter test and verify red**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/i18n/format.test.ts
```

Expected: FAIL because `formatDisplayMoney()` is not exported.

- [ ] **Step 3: Extract already-converted formatting**

Add:

```ts
export function formatDisplayMoney(
  value: number,
  language: Language,
  displayAsset?: Asset,
): string;
```

Move final symbol/fraction formatting from `formatMoney()` into it. Make `formatMoney()` call it with `convertUsdToDisplay(usdValue, displayAsset)` so existing callers retain identical output.

- [ ] **Step 4: Run formatter tests and verify green**

Run the Task 2 formatter command. Expected: all formatter tests PASS.

- [ ] **Step 5: Add a failing currency-performance E2E test**

Create a deterministic seed holding unchanged `50 EUR`. The old snapshot stores EUR/USD `1.1`, RUB/USD `1.1 / 96.4904`, and XAUT/USD `2`; current assets use EUR/USD `1.089`, RUB/USD `1.089 / 96.8`, and XAUT/USD `2.2`. Assert these unrounded results: RUB `+15.48` and about `+0.3209%`, USD `-0.55` and `-1%`, EUR `0` and `0%`, XAUT `-2.75` and `-10%`. Add a second case with XAUT absent from both the old snapshot and same-day price history; selecting XAUT must display `—`.

```ts
await page.locator('#displayCurrencyBtn').click();
await page.locator('[data-currency-code="RUB"]').click();
await expect(page.locator('#pnlMoney')).toContainText('15,48');
await expect(
  page.locator('[data-asset-open="rub"] .portfolio-row-value small'),
).toHaveText('0.0%');
await expect(
  page.locator('[data-asset-open="missing-quote"] .portfolio-row-value small'),
).toHaveText('—');
```

- [ ] **Step 6: Run the focused E2E test and verify red**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx playwright test tests/e2e/portfolio.spec.ts --grep "currency-aware performance"
```

Expected: FAIL because current P&L mixes USD percentages and current-quote conversion.

- [ ] **Step 7: Connect normalized series to renderer consumers**

Add to `WorthRenderer`:

```ts
private normalizedPnlPoints(): PnlPoint[] {
  return normalizePnlSeriesInQuote(
    [...this.compatibleSnapshots(), this.currentPnlPoint()],
    this.displayAsset()?.id,
    this.service.data.priceHistory,
  );
}

private overviewPnlSeries(): PnlPoint[] {
  const points = this.normalizedPnlPoints();
  const current = points.at(-1);
  if (!current) return [];
  const now = current.createdAt;
  return selectOverviewPnlSeries(
    points.slice(0, -1),
    current,
    this.ui.overviewPeriod,
    now,
    localDayKey(now),
  );
}

private displayPnlMoney(value: number): string {
  return this.service.settings.balancesHidden
    ? '••••'
    : formatDisplayMoney(value, this.language, this.displayAsset());
}
```

Keep Home chart periods independent but apply them after normalization. Make Home P&L, asset/account/position P&L, asset/account detail, `homeSeries()`, and `historyData()` consume normalized values. Use `displayPnlMoney()` for normalized absolute changes and chart `displayValue: value => value`. Keep current totals/allocation values on `money()` because they remain USD.

- [ ] **Step 8: Run selected tests and commit**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/domain/pnl.test.ts tests/i18n/format.test.ts
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx playwright test tests/e2e/portfolio.spec.ts --grep "currency-aware performance"
git add src/i18n/format.ts tests/i18n/format.test.ts src/ui/render.ts tests/e2e/portfolio.spec.ts
git commit -m "fix: render performance in selected currency"
```

Expected: the selected tests PASS and no normalized amount is converted twice.

---

### Task 3: Assets and Accounts Summary/Period UI

**Files:**

- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/ui/events.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/styles/app.css`
- Test: `tests/legacy/static-shell.characterization.test.ts`
- Test: `tests/i18n/messages.test.ts`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: Task 2's normalized renderer flow and existing `.ui-segmented` control.
- Produces: `UiState.overviewPeriod: '24h' | 'all'`, `[data-overview-period]`, and allocation metric IDs for count/total.

- [ ] **Step 1: Write failing shell and localization tests**

```ts
expect(document.querySelectorAll('[data-overview-period="24h"]')).toHaveLength(
  2,
);
expect(document.querySelectorAll('[data-overview-period="all"]')).toHaveLength(
  2,
);
expect(document.getElementById('assetAllocationCount')).not.toBeNull();
expect(document.getElementById('accountAllocationTotal')).not.toBeNull();
expect(document.getElementById('assetSummary')).toBeNull();
expect(document.getElementById('accountPortfolioValue')).toBeNull();
```

Assert RU/EN messages for `allAssets`, `period24h`, `periodAllTime`, and `overviewPnlPeriodAria`.

- [ ] **Step 2: Run shell/localization tests and verify red**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/legacy/static-shell.characterization.test.ts tests/i18n/messages.test.ts
```

Expected: FAIL because the new markup/messages do not exist.

- [ ] **Step 3: Move metrics and add list controls**

Use the following asset structure and mirror its IDs for accounts:

```html
<section class="compact-allocation surface" id="assetAllocationSummary">
  <div class="allocation-metrics">
    <span id="assetAllocationCount">—</span>
    <strong id="assetAllocationTotal">—</strong>
  </div>
  <div aria-hidden="true" class="allocation-bar" id="assetAllocationBar"></div>
  <div class="compact-allocation-list" id="assetAllocationList"></div>
</section>
<div class="portfolio-list-heading">
  <h2 data-i18n="allAssets" id="allAssetsTitle">Все активы</h2>
  <div class="overview-periods ui-segmented" role="group">
    <button data-overview-period="24h" type="button">24ч</button>
    <button class="active" data-overview-period="all" type="button">
      Всё время
    </button>
  </div>
</div>
```

Remove old standalone asset/account summary IDs. Retain `assetFreshness` as one muted line between the allocation surface and list heading; it contains freshness only, never count or total. Add the exact localized keys from Step 1.

- [ ] **Step 4: Render metrics and active period**

Add `overviewPeriod: '24h' | 'all'` defaulting to `'all'`. Set count with `assetsCount`/`accountsCount`, total with `money(portfolioTotal(data))`, and every row's P&L with `overviewPnlSeries()`.

```ts
all<HTMLElement>('[data-overview-period]', this.documentRef).forEach(
  (button) => {
    const active = button.dataset.overviewPeriod === this.ui.overviewPeriod;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  },
);
```

- [ ] **Step 5: Handle period clicks**

```ts
const overviewPeriod = closestElement<HTMLElement>(
  event.target,
  '[data-overview-period]',
);
if (
  overviewPeriod?.dataset.overviewPeriod === '24h' ||
  overviewPeriod?.dataset.overviewPeriod === 'all'
) {
  this.renderer.ui.overviewPeriod = overviewPeriod.dataset.overviewPeriod;
  this.renderer.renderAll();
  return;
}
```

- [ ] **Step 6: Add responsive layout rules**

```css
.allocation-metrics,
.portfolio-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}
.allocation-metrics {
  margin-bottom: 14px;
}
.portfolio-list-heading {
  gap: 12px;
  margin: 30px 2px 14px;
}
.portfolio-list-heading h2 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overview-periods {
  flex: 0 0 auto;
}
.overview-periods button {
  min-width: 52px;
  min-height: 44px;
}
```

Remove obsolete standalone summary/page-value rules and prevent horizontal overflow at the smallest supported width.

- [ ] **Step 7: Add and run period interaction E2E coverage**

Seed an eligible old snapshot plus a deliberately different today's snapshot. Verify Assets switching updates percentages from the eligible point, Accounts keeps the same active period, today's snapshot is ignored, totals/allocation widths stay unchanged, and absent eligible history renders `—`.

```ts
await page.locator('#assetsView [data-overview-period="24h"]').click();
await expect(
  page.locator('#assetsView [data-overview-period="24h"]'),
).toHaveAttribute('aria-pressed', 'true');
await page.locator('[data-nav="accountsView"]').click();
await expect(
  page.locator('#accountsView [data-overview-period="24h"]'),
).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 8: Run focused tests and commit**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm test -- tests/legacy/static-shell.characterization.test.ts tests/i18n/messages.test.ts
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx playwright test tests/e2e/portfolio.spec.ts --grep "overview period"
git add index.html src/ui/render.ts src/ui/events.ts src/i18n/messages.ts src/styles/app.css tests/legacy/static-shell.characterization.test.ts tests/i18n/messages.test.ts tests/e2e/portfolio.spec.ts
git commit -m "feat: add overview performance periods"
```

Expected: selected UI tests PASS.

---

### Task 4: Freshness and Asset-Heading Regressions

**Files:**

- Modify: `src/ui/render.ts`
- Modify: `src/styles/app.css`
- Test: `tests/e2e/portfolio.spec.ts`

**Interfaces:**

- Consumes: existing `.ui-freshness`, `.freshness-dot`, `.rate-status`, and asset-row markup.
- Produces: exactly one left-aligned current-rate dot and asset headings without codes.

- [ ] **Step 1: Write failing E2E assertions**

```ts
await expect(
  page.locator('[data-rate-asset="btc"] .freshness-dot'),
).toHaveCount(1);
await expect(
  page.locator('[data-asset-open="btc"] .portfolio-row-main strong'),
).toHaveText('Bitcoin');
await expect(
  page.locator('[data-asset-open="btc"] .portfolio-row-main em'),
).toHaveCount(0);
```

Also compare dot/text vertical centers and assert computed `justifyContent` for `.rate-status` is `flex-start`.

- [ ] **Step 2: Run the regression test and verify red**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx playwright test tests/e2e/portfolio.spec.ts --grep "freshness and asset headings"
```

Expected: FAIL on duplicate/centered indicator or asset code markup.

- [ ] **Step 3: Remove legacy code and pseudo-element**

Render only:

```ts
`<strong>${escapeHtml(asset.name)}</strong>`;
```

Delete unused `.portfolio-row-main em` CSS and both `.rate-status.current::before` declarations. Add:

```css
.rate-status {
  width: max-content;
  justify-content: flex-start;
}
```

Keep stale/manual semantics unchanged.

- [ ] **Step 4: Run the regression test and commit**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx playwright test tests/e2e/portfolio.spec.ts --grep "freshness and asset headings"
git add src/ui/render.ts src/styles/app.css tests/e2e/portfolio.spec.ts
git commit -m "fix: clean portfolio row status markup"
```

Expected: one aligned dot and no asset code in headings.

---

### Task 5: Full Product Verification, Release, and Push

**Files:**

- Verify: all files changed by Tasks 1–4
- Modify only if required by repository convention: version surfaces and release notes found by the version search below

**Interfaces:**

- Consumes: completed calculation and UI tasks.
- Produces: verified production build on `main`, pushed commits, successful CI/Pages deployment, and confirmed live hashed bundle.

- [ ] **Step 1: Format and inspect**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npx prettier --write src/domain/pnl.ts tests/domain/pnl.test.ts src/i18n/format.ts tests/i18n/format.test.ts src/ui/render.ts src/ui/events.ts src/i18n/messages.ts src/styles/app.css index.html tests/legacy/static-shell.characterization.test.ts tests/i18n/messages.test.ts tests/e2e/portfolio.spec.ts docs/superpowers/specs/2026-08-15-currency-aware-performance-and-overview-period-design.md docs/superpowers/plans/2026-08-15-currency-aware-performance-and-overview-period.md
git diff --check
git status --short
```

Expected: no whitespace errors or unrelated changes.

- [ ] **Step 2: Run complete checks**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm run check
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm run test:e2e
```

Expected: typecheck, lint, formatting, Vitest, build, and full Playwright suite PASS.

- [ ] **Step 3: Inspect production preview in a real browser**

```bash
PATH=/Users/sereozha/.nvm/versions/node/v20.20.2/bin:$PATH npm run preview -- --host 127.0.0.1
```

Inspect Home, Assets, Accounts, Asset Detail, and History at iPhone and desktop widths. Exercise USD/RUB/EUR/XAUT, `24h`/`all time`, RU/EN, light/dark, privacy, navigation, scroll, chart pointer/keyboard inspection, position editing, and offline reload. Confirm no overflow, one rate dot, shared tab period, and honest unavailable states.

- [ ] **Step 4: Check release-version convention**

```bash
rg -n "3\.7\.0|APP_VERSION|backupVersion|version" package.json src tests vite.config.* README.md docs 2>/dev/null
git log -8 --oneline
```

If recent user-visible releases consistently bump a product version, update every product-version surface to the same next patch and its release note without changing IndexedDB/backup schema versions; then rerun `npm run check`.

- [ ] **Step 5: Commit verification-only edits and confirm clean state**

```bash
git diff --check
git diff --stat
git status --short
```

If formatting, snapshots, or version files changed, stage the exact in-scope paths shown by status and commit them with `git commit -m "chore: prepare currency performance release"`. Expected: clean working tree.

- [ ] **Step 6: Push main over authenticated HTTPS**

```bash
gh auth setup-git
git push https://github.com/kudiiarov/wealth-pages.git main
```

If transport stalls, use:

```bash
perl -e 'alarm 30; exec @ARGV' env GIT_TERMINAL_PROMPT=0 git push https://github.com/kudiiarov/wealth-pages.git main
```

- [ ] **Step 7: Verify CI, Pages, and live assets**

Run:

```bash
VERIFY_RUN_ID=$(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$VERIFY_RUN_ID" --exit-status
gh api repos/kudiiarov/wealth-pages/pages
```

Then fetch live `/wealth-pages/` HTML, identify hashed JS/CSS paths, and verify both return HTTP 200. Reload with service-worker cache bypassed before judging the live UI.

- [ ] **Step 8: Report evidence**

Report pushed commit IDs, complete check/Playwright results, preview matrix, CI/Pages status and URL, live hashed bundle, and the daily-history precision limitation. Do not claim completion if build, browser, CI, or deployment verification is missing.
