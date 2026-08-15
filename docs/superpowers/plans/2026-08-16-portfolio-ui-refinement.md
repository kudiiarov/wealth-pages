# Portfolio UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved compact portfolio controls and account detail presentation with honest position performance and no blue system accent.

**Architecture:** Keep the existing domain P&L and shared `UiState`; change only shell markup, renderer output, event handling, styles, and translations. Position rows reuse `allTimePnl` with a `positionId` predicate, so current valuation and historical comparison remain on the established currency-normalized path.

**Tech Stack:** TypeScript 6, Vite 8, Vitest/JSDOM, Playwright, CSS, GitHub Pages PWA.

**Spec:** `docs/superpowers/specs/2026-08-16-portfolio-ui-refinement-design.md`

## Global Constraints

- IndexedDB remains authoritative and its schema/data are untouched.
- The single overview action defaults to `24h` and remains shared across Assets and Accounts.
- Asset identity colors remain user data; system actions do not use `--blue`.
- Touch targets remain at least 44 px and the Rates visible title-to-list gap is exactly 10 px.
- RU/EN, light/dark, privacy, mobile/desktop, offline PWA, and GitHub Pages under `/wealth-pages/` remain supported.

---

### Task 1: Single overview period action and Assets cleanup

**Files:**

- Modify: `tests/legacy/static-shell.characterization.test.ts`
- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: `index.html`
- Modify: `src/ui/events.ts`
- Modify: `src/ui/render.ts`
- Modify: `src/styles/app.css`

**Interfaces:**

- Consumes: `UiState.overviewPeriod: '24h' | 'all'` and `overviewPnl()`.
- Produces: two `[data-overview-period-toggle]` buttons whose text is the current shared period.

- [ ] **Step 1: Write failing shell and browser tests**

```ts
expect(document.querySelectorAll('[data-overview-period-toggle]')).toHaveLength(
  2,
);
expect(document.querySelectorAll('[data-overview-period]')).toHaveLength(0);
expect(document.getElementById('assetFreshness')).toBeNull();

await expect(
  page.locator('#assetsView [data-overview-period-toggle]'),
).toHaveText('24h');
await page.locator('#assetsView [data-overview-period-toggle]').click();
await expect(
  page.locator('#assetsView [data-overview-period-toggle]'),
).toHaveText('All time');
await page.locator('[data-nav="accountsView"]').click();
await expect(
  page.locator('#accountsView [data-overview-period-toggle]'),
).toHaveText('All time');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/legacy/static-shell.characterization.test.ts && npm run test:e2e -- --project=mobile-chromium --grep "overview period"`

Expected: FAIL because the shell still has two-option segmented controls, defaults to all time, and includes `assetFreshness`.

- [ ] **Step 3: Implement the smallest shell/renderer/event/style change**

Use one button in each heading, default `overviewPeriod` to `24h`, set each button text with `period24h` or `periodAllTime`, and make its click invert the current state. Remove only the Assets page-level freshness node and its renderer write; retain quote-specific freshness.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- tests/legacy/static-shell.characterization.test.ts && npm run test:e2e -- --project=mobile-chromium --grep "overview period"`

Expected: PASS.

### Task 2: Compact account detail and position performance

**Files:**

- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: `index.html`
- Modify: `src/ui/render.ts`
- Modify: `src/styles/app.css`
- Modify: `src/i18n/messages.ts`

**Interfaces:**

- Consumes: `allTimePnl(predicate)`, `pnlSummary(result)`, `pnlClass(result)`, and existing position routes.
- Produces: account hero `.account-detail-hero` and position row P&L amount/percentage.

- [ ] **Step 1: Write a failing account-detail browser regression**

```ts
await page.goto('/#/accounts/exchange');
await expect(page.locator('#entityDetailHero')).not.toContainText('Биржа');
await expect(page.locator('#entityDetailHero')).toContainText(
  '+$10.00 · +25.0%',
);
await expect(
  page.locator(
    '#entityRelatedList [data-position-open="eth-exchange"] b small',
  ),
).toContainText('%');
for (const id of ['entityDetailAdd', 'entityDetailMenu']) {
  const box = await page.locator(`#${id}`).boundingBox();
  expect(box?.width).toBe(box?.height);
  await expect(page.locator(`#${id}`)).toHaveCSS('border-radius', '50%');
}
```

- [ ] **Step 2: Run the regression and confirm RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "account detail"`

Expected: FAIL because the type overline remains, actions are rounded squares with text glyphs, and account position rows lack P&L.

- [ ] **Step 3: Implement the compact hero, SVG actions, and position P&L**

Replace text glyphs with inline SVG, apply the shared circular icon-button geometry, omit account type from the hero, append the localized all-time label to aggregate P&L, and render `pnlSummary(allTimePnl(positionId))` below every account position value.

- [ ] **Step 4: Run focused account-detail tests and confirm GREEN**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "account detail|opens and edits a position"`

Expected: PASS with rows still opening the position editor.

### Task 3: Neutral system accents and equal Home spacing

**Files:**

- Modify: `tests/e2e/portfolio.spec.ts`
- Modify: `src/styles/app.css`

**Interfaces:**

- Consumes: `--ink`, `--muted`, `--green`, `.section-heading-row`, `.section-action`.
- Produces: no CSS declarations using `var(--blue)` for system controls and equal 10 px visible title-to-surface gaps.

- [ ] **Step 1: Write failing browser assertions**

```ts
const ratesGap = await visibleGap('.section-heading-row h2', '#portfolioRates');
const structureGap = await visibleGap(
  '.home-insight-section > h2',
  '.structure-panel',
);
expect(ratesGap).toBe(10);
expect(ratesGap).toBe(structureGap);
await expect(page.locator('#configureRatesBtn')).toHaveCSS(
  'color',
  expectedMutedColor,
);
```

Also assert selected currency, text/disclosure actions, and toggles resolve to neutral ink/muted/green rather than RGB `86, 103, 255`.

- [ ] **Step 2: Run the browser regression and confirm RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "neutral system accents|rates spacing"`

Expected: FAIL because Configure and other controls still use `--blue` and the measured Rates gap is 26 px.

- [ ] **Step 3: Replace system blue semantics and align the heading row**

Use muted for low-emphasis Configure, ink for text actions/selection borders/checkmarks/disclosures, and green for checkbox activation. Bottom-align the Rates heading row so the 44 px Configure target grows upward and the title-to-list gap remains 10 px.

- [ ] **Step 4: Run focused browser tests and confirm GREEN**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "neutral system accents|rates spacing"`

Expected: PASS in light and dark themes.

### Task 4: Release and deployment

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: version/build-note locations found by `rg "3\\.7\\.1|3.7.1-final"`
- Modify: release notes file used by the current repository.
- Keep: `docs/mockups/ui-refinement.html`

**Interfaces:**

- Produces: consistent `3.8.0` release metadata and deployed hashed bundle.

- [ ] **Step 1: Update release metadata to `3.8.0` / `3.8.0-final`**

Run: `rg -n "3\\.7\\.1|3.7.1-final" . --glob '!node_modules/**' --glob '!dist/**'`

Update every active version surface and add concise release notes for the UI refinement.

- [ ] **Step 2: Run complete local verification**

Run: `npm run check`

Run: `npm run test:e2e`

Expected: all typecheck, lint, formatting, unit, build, mobile E2E, and desktop E2E checks pass.

- [ ] **Step 3: Inspect the production preview in a real browser**

Run: `npm run preview -- --host 127.0.0.1`

Inspect Home, Assets, Accounts, account detail, position edit, settings, and currency selection at mobile and desktop widths in RU/EN and light/dark. Confirm privacy mode, touch targets, equal Home gaps, period cycling, neutral accents, offline reload, and no overflow.

- [ ] **Step 4: Commit and push**

Run: `git diff --check && git status --short && git diff --stat`

Commit the reviewed files, push `main`, wait for GitHub Actions/Pages, then verify the live page shows `3.8.0-final` and the new hashed bundle.
