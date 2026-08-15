# Currency-aware performance and overview period design

**Status:** Approved in conversation; awaiting written-spec review

**Date:** 2026-08-15

**Scope:** Asset and account performance, portfolio history conversion, Assets/Accounts allocation summaries, period controls, and remaining portfolio-row/freshness regressions

## Purpose

Portfolio performance is currently calculated in USD and only the resulting money amount is converted to the selected display currency. The percentage therefore remains USD-based, while some historical totals are converted with today's quote. This can make the amount and percentage disagree and can show movement for an asset measured in itself. For example, a 50 EUR holding whose EUR/RUB rate rose by 0.3096 RUB should gain about 15.48 RUB before flow adjustment, not an unrelated amount produced from mixed price bases.

This change makes every historical valuation and flow adjustment use one date-aligned display-currency basis. It also gives the Assets and Accounts lists an explicit `24h`/`all time` period, moves their count and total into the allocation surface, and fixes the remaining duplicated freshness indicator and asset-code regression.

This specification extends `2026-08-15-ui-system-history-and-currency-consistency-design.md`. Where the earlier document excluded portfolio P&L from scope, this document supersedes that exclusion.

## Goals

- Make portfolio, account, and asset performance amounts and percentages correct in the selected display currency.
- Allow the same portfolio to truthfully rise in one currency and fall in another.
- Use only historical quote prices from the valuation date; never convert an old value with today's quote.
- Keep deposits, withdrawals, and transfers from being reported as investment performance.
- Define an honest `24h` comparison that never uses today's snapshot as its baseline.
- Add `All accounts` and `All assets` list headers with a shared `24h`/`all time` selector.
- Put entity count and current total above the allocation bar inside the allocation surface.
- Remove currency codes from asset-row headings.
- Render exactly one left-aligned freshness dot beside the relative update time in Home exchange-rate rows.

## Non-goals

- Intraday snapshot or price storage.
- Reconstructing historical prices or account balances that were never recorded.
- Storing duplicate precomputed histories for every possible display currency.
- Changing the market-data provider, IndexedDB schema, backup format, or canonical USD price storage.
- Changing allocation proportions, which remain based on current values and are currency-invariant at one point in time.
- Redesigning asset detail chart periods or account detail information architecture.

## Chosen architecture

Performance continues to use the existing flow-adjusted P&L algorithm, but its input points are first normalized into the selected display currency. This preserves the existing separation between valuation and cash-flow adjustment while ensuring that every amount participating in one calculation has the same unit.

The alternatives were:

1. Convert only the final USD P&L. This is the current behavior and cannot produce currency-specific percentages.
2. Store a separate history for every display currency. This duplicates data, complicates migrations, and becomes stale when currencies are added.
3. Normalize each historical point on demand, then reuse the pure flow-adjusted calculation. This is the selected approach because it is date-correct, requires no persistence migration, and is independently testable.

## Date-aligned valuation

### Point normalization

For every portfolio performance point at time `t`, let `P(a,t)` be asset `a`'s USD price and `P(q,t)` be the selected quote asset's USD price. The quote-denominated unit price is:

```text
priceInQuote(a, q, t) = P(a,t) / P(q,t)
```

Rules:

1. USD has an implicit price of `1`.
2. An asset measured in itself has a price of exactly `1`.
3. A retained snapshot first uses the prices embedded in that snapshot, because they describe the same valuation event.
4. If the snapshot lacks the quote asset, a price-history observation with the same canonical local `dayKey` may be used.
5. The current point uses current asset prices.
6. A non-finite, zero, negative, or missing quote price makes that point incompatible; today's quote must not be substituted.
7. Compatible points remain chronological. Incompatible points are omitted before period-baseline selection.

Each position's unit price, computed value, and the point total are expressed in the quote currency before P&L is calculated. The point total is derived by summing normalized position values so that it cannot disagree with its components.

### Flow-adjusted performance

The existing interval calculation remains responsible for separating market movement from quantity movement:

```text
start = old quantity × old quote-denominated price
end = new quantity × new quote-denominated price
flow = quantity change × new quote-denominated price
pnl = end - start - flow
```

The aggregate percentage denominator is also built from quote-denominated starting capital and positive flows. Absolute P&L and percentage therefore always describe the same selected currency and period.

This daily model values a quantity change at the next available retained point. It does not claim transaction-time precision because transactions and intraday prices are not stored.

### Expected invariants

- RUB holdings measured in RUB have no exchange-rate performance; their unit value is always `1 RUB`.
- A portfolio can have different signs and percentages in RUB, USD, EUR, or gold because the relevant cross-rates changed over time.
- Changing display currency recomputes both the money amount and percentage; it does not merely reformat an existing USD result.
- With unchanged quantity, `50 EUR × 0.3096 RUB/EUR` yields approximately `15.48 RUB` of movement, subject only to unrounded source prices.
- Account P&L sums its positions, asset P&L sums that asset across accounts, and portfolio P&L sums all positions using the same normalized series.

## Period semantics

### All time

`all time` uses the earliest compatible retained snapshot as the baseline and the current portfolio as the endpoint. At least one historical baseline and the current point are required.

### 24h

`24h` uses the newest compatible snapshot whose timestamp is less than or equal to `now - 24 hours`. A snapshot from the current local day is never eligible as the baseline, even if clock or imported timestamps would otherwise put it beyond the cutoff.

Only the selected baseline, compatible later snapshots, and the current point participate in the calculation. If no eligible baseline exists, the UI shows an unavailable value (`—`) rather than comparing with today's snapshot or labeling a shorter interval as 24 hours.

The cutoff is elapsed-time based, while the explicit local-day exclusion protects the product's daily-snapshot semantics.

### UI state

Assets and Accounts share one session-level overview period state so switching either tab keeps the same comparison context. The default is `all time` to preserve current behavior. This state is presentation-only and is not persisted to IndexedDB or backups.

The Home and Asset Detail chart period controls remain independent because they select chart ranges rather than the overview-list comparison period.

## Portfolio chart conversion

Every historical portfolio chart point uses the quote price from that snapshot or matching day. It is calculated by summing quote-normalized positions, not by dividing an old total by today's quote. The current endpoint uses current prices.

Incompatible historical points are omitted. If fewer than two compatible points remain, the existing insufficient-history state is shown. The chart, displayed absolute change, and displayed percentage must use the same compatible series and selected period.

## Assets and Accounts layout

### Allocation surface

The top of each allocation surface contains:

- localized entity count (`N assets` or `N accounts`);
- current total in the selected display currency;
- the segmented allocation bar immediately below those values;
- the existing one-column legend of the four largest entries plus Other.

The count and total are removed from the page intro or standalone summary outside the surface. Empty states keep the same structure with a zero count, formatted zero total, empty bar, and existing empty-list guidance.

### List heading and period control

Immediately above each list is one responsive header row:

- `All assets` or `All accounts` on the left;
- a two-option `24h` / `all time` segmented control on the right.

The selected option exposes `aria-pressed`, preserves a 44-pixel touch target, and updates the P&L amount and percentage on every asset/account row. Totals and allocation shares remain current values and do not change when the period changes.

On narrow screens the heading and selector remain on one row while text may truncate only in the heading area. Russian and English labels must fit without horizontal page overflow.

## Remaining UI regressions

### Exchange-rate freshness

Home exchange-rate rows contain exactly one `.ui-freshness` indicator. The legacy `.rate-status.current::before` pseudo-element is removed or disabled so it cannot draw a second dot. The dot and relative time form one left-aligned inline row within the status area; they must not be centered independently.

Stale and manual states retain their meaningful localized text and do not gain a healthy green dot.

### Asset-row identity

Asset list headings display the localized asset name only. Currency/asset codes are removed from the heading markup; symbols in icon tiles and quantities in secondary metadata remain unchanged.

## Error handling and data limitations

- Missing historical quote data yields `—` or an insufficient-history state, never a current-rate approximation.
- Invalid snapshot prices invalidate only that historical point and do not mutate or delete stored data.
- A missing or deleted display asset continues to use the existing USD fallback.
- Imported legacy snapshots remain readable; no migration is required.
- Rounding occurs only for display. Calculations use finite unrounded numbers throughout.
- Privacy mode continues to hide monetary values without changing calculations or period selection.

## Testing strategy

Implementation follows red-green-refactor.

### Domain and view-model tests

- Normalize historical positions with the quote price embedded in the same snapshot.
- Use same-day quote history only when the snapshot quote is missing.
- Never fall back to the current quote for an old point.
- Produce a flat self-quoted series with zero exchange-rate P&L.
- Produce different, mathematically verified returns for the same portfolio in RUB, USD, EUR, and gold.
- Keep absolute P&L and percentage on the same quote basis.
- Verify the 50 EUR × 0.3096 RUB example is approximately 15.48 RUB.
- Exclude deposits and withdrawals from performance after normalization.
- Aggregate position results consistently into asset, account, and portfolio results.
- Select the newest snapshot at or before the 24-hour cutoff.
- Exclude all current-local-day snapshots from the 24-hour baseline.
- Return unavailable when no eligible 24-hour or all-time baseline exists.

### Rendering and interaction tests

- Assets and Accounts show count and total inside the allocation surface above the bar.
- Both list headings render localized `All assets` / `All accounts` labels and the shared selector.
- Switching period updates row P&L amounts, percentages, active state, and `aria-pressed` without changing current totals or allocation widths.
- Asset headings contain no asset codes.
- Each current exchange-rate row has exactly one dot aligned with its relative time.
- RU/EN, privacy mode, and light/dark rendering remain correct.

### End-to-end verification

- Seed deterministic snapshots and prices, switch display currencies, and verify differing expected returns.
- Verify `24h` ignores today's snapshot and uses the last eligible older snapshot.
- Verify missing quote history produces `—` rather than a misleading result.
- Inspect Home, Assets, and Accounts at mobile and desktop widths in both themes.
- Confirm navigation, allocation-row links, position editing, offline reload, and installed-PWA behavior remain functional.

Run `npm run check`, `npm run test:e2e`, and the production preview. After implementation is committed and pushed, wait for CI/Pages and verify the deployed `/wealth-pages/` build and hashed bundle, accounting for service-worker caching.

## Rollout

No persistence or backup version change is needed. Add pure normalization and period-selection functions first, connect them to the existing P&L view models, then update rendering and styles. Keep existing data attributes used by navigation and editing. Ship the calculation, period UI, layout adjustments, and regression fixes as one coherent release so no screen temporarily mixes old percentages with new amounts.
