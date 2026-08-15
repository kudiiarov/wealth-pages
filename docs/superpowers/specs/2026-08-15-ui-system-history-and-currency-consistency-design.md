# UI system, history repair, and currency-consistent pricing design

**Status:** Approved in conversation; awaiting written-spec review  
**Date:** 2026-08-15  
**Scope:** Home, Accounts, History, Asset Detail, shared presentation primitives, and historical cross-rate calculation

## Purpose

Worth currently expresses the same interaction patterns with unrelated sizes, radii, spacing, and markup. The latest compact-portfolio release also regressed the visual treatment of History, while price freshness copy is repeated more prominently than its information value warrants. Asset history has a separate correctness problem: daily prices are stored in USD, but historical points are converted with today's display-currency price. This can make RUB appear to gain or lose value against RUB.

This change establishes a small reusable UI foundation for the affected screens, removes the requested redundant copy, restores History, and makes historical asset charts use date-aligned cross-rates.

## Goals

- Establish reusable tokens and primitives for buttons, icon tiles, list rows, cards, segmented controls, and compact freshness indicators.
- Migrate Home, Accounts, History, and Asset Detail to those primitives without changing their information architecture beyond the requested removals.
- Restore readable, stable daily snapshot rows in History.
- Remove the snapshot timestamp from the Accounts summary.
- Remove the global price-update status from Home.
- Remove the words `Price current` from Exchange Rates and Asset Detail.
- Put the green freshness dot and relative update time on one line.
- Ensure an asset expressed in itself is always `1` with `0` movement.
- Convert all other historical asset prices with the quote asset's historical price from the same date.
- Add regression coverage before implementing each behavioral fix.

## Non-goals

- A full visual redesign of every settings form, modal, navigation element, or legacy screen.
- Changing market-data providers or the canonical USD storage model.
- Backfilling price history that was never recorded.
- Fabricating a historical quote from a future observation.
- Adding intraday storage; history remains daily.
- Reworking portfolio P&L or cash-flow adjustment except where display-currency conversion affects presentation.

## Shared UI foundation

The existing single stylesheet remains the source of truth for this release, but repeated values become named custom properties and composable classes. This avoids a framework migration while creating a clear seam for later component extraction.

### Tokens

Add semantic tokens for:

- control heights: compact, standard, and large;
- icon tile sizes: compact, row, and hero;
- surface radii: control, row, and card;
- horizontal and vertical row padding;
- standard section and row gaps;
- primary, secondary, and metadata type sizes;
- interaction transitions and minimum touch target.

Tokens describe purpose rather than a specific screen. Existing theme color variables remain authoritative.

### Primitives

The affected screens use these shared patterns:

- `.ui-icon-button`: square icon action with standard size and active state;
- `.ui-icon-tile`: colored entity icon with compact, row, and hero size modifiers;
- `.ui-list-row`: aligned icon, identity, trailing value/status, and optional chevron/action;
- `.ui-surface`: shared card background, radius, border/shadow behavior;
- `.ui-segmented`: common period/filter control with active and pressed states;
- `.ui-freshness`: inline dot plus relative time, with current, stale, and manual variants.

Screen-specific classes remain only for layout that is genuinely unique. Existing selectors may temporarily alias the primitives during migration so tests and event delegation do not break.

### Accessibility and interaction

- Interactive rows remain native buttons.
- Every interactive target remains at least 44 by 44 CSS pixels.
- Active segmented options continue exposing `aria-pressed`.
- Freshness does not rely on color alone: its relative time remains visible, while stale/manual variants retain meaningful text where needed.
- Removing `Price current` applies only to the redundant healthy-state label. Stale and manual states remain explicit because they require user interpretation or action.

## Screen changes

### Home

Remove the `#priceTrust` control and its `Prices updated …` copy from the dashboard. Price-refresh controls and diagnostics remain available in Settings. Rendering code must tolerate the element's removal rather than querying it unconditionally.

Exchange Rate rows retain source identity, current converted value, and navigation. Their secondary status becomes a single `.ui-freshness` line:

- current automatic price: green dot plus relative time, for example `6 min ago`;
- stale automatic price: stale indicator plus relative time;
- manual price: explicit localized `Manual` text and no green dot.

No Exchange Rate row displays `Price current`.

### Accounts

The summary metadata contains only the localized account count. It no longer reads or formats the latest snapshot and never appends `snapshot today …`.

### History

Each daily snapshot renders as a shared surface/list row with:

- date as the primary identity;
- saved time and change from the preceding retained day as metadata;
- display-currency portfolio total as the trailing value;
- the existing overflow menu as a 44-pixel icon action.

The layout must not inherit compact portfolio-row grid assumptions. Long localized dates and large totals must truncate or wrap only in their designated columns, without pushing the menu outside the surface. No decorative history dot returns.

### Asset Detail

The healthy freshness status becomes one inline row containing the green dot and relative update time. `Price current` is removed. Stale and manual states remain named and aligned in the same component.

The hero, chart period selector, holding summary, and related rows adopt shared sizing tokens/primitives. The content hierarchy remains unchanged.

## Historical currency calculation

### Root cause

`PriceHistoryPoint.usdPrice` correctly stores each asset's value in USD at observation time. The current chart converts every historical source point through `displayAsset.price`, which is the display asset's live price. For RUB viewed in RUB, historical RUB/USD observations are therefore divided by today's RUB/USD price, producing a false slope even though RUB/RUB must always equal one.

The hero price difference has the same semantic problem: it subtracts historical and current USD values, then formats that USD difference in the selected display currency using today's quote.

### Date-aligned cross-rate series

Introduce a pure domain/view-model function that builds an asset's historical series in a selected quote currency.

For source asset `S`, quote asset `Q`, and day `d`:

```text
crossRate(S, Q, d) = usdPrice(S, d) / usdPrice(Q, d)
```

Rules:

1. If `S` and `Q` identify the same asset, every valid source observation maps to exactly `1`.
2. If the display currency is USD, use the source USD history unchanged.
3. Otherwise, match source and quote observations by canonical `dayKey`.
4. Emit a point only when both prices are finite and the quote price is greater than zero.
5. Do not use today's live quote for an older source point and do not forward-fill from a future day.
6. Sort emitted points chronologically and preserve the source point timestamp for chart labels.
7. If fewer than two comparable points remain, show the existing insufficient-history empty state.

The current hero price uses the live source/quote cross-rate. Its change is calculated against the first already-converted point in the selected period. Thus RUB in RUB displays `1 ₽`, `0 ₽`, and `0%`, while BTC in RUB compares date-aligned BTC/RUB rates.

### Historical-data limitations

Older backups may contain source history without quote history for the same dates. Those dates cannot produce a truthful cross-rate and are omitted. The UI must prefer an honest sparse/empty chart over silently applying today's exchange rate to the past.

No schema migration is required because both histories already use `PriceHistoryPoint` and canonical day keys.

## Localization

Remove only now-unused healthy-state and Home strings after confirming no remaining consumers. Preserve localized strings for stale, manual, never-updated, empty-history, account count, dates, and relative time. Tests cover Russian and English output where copy changes.

## Error and empty states

- Missing historical quote points yield fewer chart points, not an exception.
- Zero, negative, or non-finite historical quote prices are ignored.
- A deleted display asset continues to trigger the existing fallback to USD.
- Assets without update timestamps show the existing never-updated/manual state.
- Removing Home freshness markup must not affect Settings refresh actions or diagnostic logging.

## Testing strategy

Behavioral changes follow red-green-refactor.

### Unit tests

- Same source and quote asset produces a flat series of ones despite changing USD prices.
- USD quote preserves the original USD series.
- Non-USD cross-rates use source and quote prices from matching day keys.
- Days without a matching quote point are omitted.
- Invalid or zero quote prices are omitted.
- Current and reference cross-rates produce zero RUB/RUB change.
- Accounts metadata contains only the account count.
- Healthy freshness markup contains the relative time and indicator but not `Price current`.

### Characterization and E2E tests

- Home contains no `#priceTrust` or `Prices updated` text.
- Exchange Rates and Asset Detail contain no `Price current` text.
- The freshness dot and relative time share a single layout row.
- History rows retain date, time, delta, total, and reachable overflow action at mobile and desktop widths.
- Accounts no longer contain `snapshot today` or its Russian equivalent.
- Opening RUB while RUB is selected shows a flat chart and zero change.
- Existing navigation, price refresh, snapshot deletion, and period selection remain functional.

### Verification

Run formatting, typecheck, lint, all unit/integration tests, production build, and the relevant mobile/desktop Playwright flows. Visually inspect Home, Accounts, History, and Asset Detail in both themes at narrow and desktop widths.

## Rollout

Implement the calculation as a pure tested function before connecting it to rendering. Migrate the four affected screens to shared primitives without changing event data attributes. No storage migration or backup version bump is needed. The final commit should include the UI foundation, screen migrations, calculation fix, and regression tests as one coherent release change.
