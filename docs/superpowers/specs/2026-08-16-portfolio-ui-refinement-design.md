# Portfolio UI Refinement Design

## Goal

Make the Assets/Accounts period control, account detail header, position performance, and Home rates section visually consistent without changing portfolio valuation rules or persisted data.

## Approved behavior

- Assets no longer shows a page-level price-update timestamp. Per-rate and asset-detail freshness remain available where they describe a specific quote.
- Assets and Accounts each show one text action containing the current overview period. It defaults to `24h`, toggles to `All time` on tap, toggles back on the next tap, and remains shared between the tabs.
- Account detail has circular 48 px add/menu actions using centered SVG icons.
- Account detail omits the account-type overline, keeps icon/name/value/change in one compact hero, and labels the aggregate change as all time.
- Every account-detail position shows its all-time signed amount and percentage beneath current value. Honest unavailable history is rendered as `—`.
- The Home rates “Configure” action is neutral rather than blue. All system accent uses of blue become neutral ink/muted styling; user-selected asset colors and the asset identity palette remain data colors.
- The visible gap from “Rates” to its list is 10 px, matching “Portfolio structure”, while the Configure action retains at least a 44 px touch target.
- RU/EN, light/dark, privacy mode, mobile/desktop layout, navigation, and position editing remain supported.

## Non-goals

- No changes to snapshot selection, currency normalization, flow-adjusted P&L, IndexedDB schemas, or asset identity colors.
- No chart or navigation redesign.

## Verification

- Static shell tests protect the single period actions, absence of Assets freshness summary, and SVG detail actions.
- Browser tests protect default/toggled/shared period behavior, account-detail position P&L, circular centered controls, neutral system actions, and equal visible section gaps.
- Full check, full E2E, production preview, release/version consistency, CI, Pages, and live bundle verification are required before completion.
