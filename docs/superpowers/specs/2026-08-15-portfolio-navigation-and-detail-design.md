# Portfolio Navigation and Detail Design

## Objective

Replace repeated expandable portfolio content with four focused top-level areas and dedicated asset/account detail screens. The home screen should answer "what is my portfolio worth and what are the rates of the assets I care about?" while History remains a single source of truth for the whole portfolio.

## Navigation

The bottom navigation has four items in this order:

1. Home
2. Assets
3. Accounts
4. History

Assets and Accounts are separate list views. Their rows never expand inline. Selecting a row pushes a full-screen in-app detail view. Detail views hide the bottom navigation and show an explicit back button that returns to the originating list or Home.

Detail navigation uses hash-based URLs so GitHub Pages can load and refresh deep links without server rewrites:

- `#/home`
- `#/assets`
- `#/assets/:assetId`
- `#/accounts`
- `#/accounts/:accountId`
- `#/history`

Invalid or deleted entity IDs fall back to the corresponding collection view. Browser back and forward navigation must work.

## Home: Rates

The existing "What changed" section becomes "Rates" (`Курсы` in Russian). It contains between one and three user-selected assets.

- When no explicit selection exists, the three assets with the largest current portfolio value are shown.
- A compact configure action opens a selection sheet listing all assets.
- The user may select one, two, or three assets. A fourth selection is rejected with clear inline feedback.
- The explicit selection is stored locally as asset IDs. Deleted asset IDs are ignored. If no valid selected IDs remain, the view falls back to the current three largest assets.
- Reordering is outside this iteration; selected rates follow the user's selection order, while the default follows descending value.

Each rate row shows:

- asset icon, name, and code;
- absolute portfolio-value change for the selected Home period;
- percentage change;
- current price of one unit below the percentage, formatted to two decimal places in the display currency;
- a freshness state derived from `priceUpdatedAt` and the configured refresh interval.

Selecting any rate row opens that asset's detail view. Privacy mode masks all monetary values, including the unit rate.

## Assets View

The Assets tab contains the existing asset search and tag filters, summary, and freshness information. The Assets/Accounts segmented control and all inline dropdown behavior are removed.

Each row shows the asset identity, total value, portfolio share, performance, and price freshness. Selecting it opens the asset detail view. The add action on this screen creates an asset; position creation remains available from asset/account detail screens.

## Accounts View

The Accounts tab contains account search, portfolio summary, and a flat account list. It has no asset tag filters.

Each row shows the account identity, type, position count, total value, and performance. Selecting it opens the account detail view. The add action creates an account.

## Asset Detail

The asset detail screen contains:

- back navigation;
- icon, name, code, total holding value, aggregate quantity, current unit price, performance, and price freshness;
- an interactive value-history chart based on `snapshot.assets[].value` for the asset;
- exact two-decimal value, localized date, and localized time on touch/pointer/keyboard inspection;
- category and tag metadata;
- a flat list of related accounts, each with account icon, title, and quantity/code;
- actions to edit the asset, update its price, and add a position prefilled with this asset.

If historical snapshots predate per-asset snapshot data, they are omitted rather than synthesized. Fewer than two usable points shows the existing localized empty-chart state.

## Account Detail

The account detail screen contains:

- back navigation;
- icon, name, type, total balance, position count, and performance;
- an interactive value-history chart based on `snapshot.accounts[].total` for the account;
- exact two-decimal value, localized date, and localized time on touch/pointer/keyboard inspection;
- a flat list of related assets, each with asset icon, title, and quantity/code;
- actions to edit the account and add a position prefilled with this account.

Snapshots without the requested account entry are omitted. Fewer than two usable points shows the localized empty-chart state.

## History

History always represents the whole portfolio.

- Remove the history scope dropdown and all position/asset scope state.
- Keep the portfolio chart, exact point inspection, snapshot creation, and chronological snapshot list.
- Private asset/account history exists only on detail screens.

## Data and Compatibility

No portfolio backup schema change is required. Existing snapshots already contain account totals and asset values. A new presentation setting stores the selected rate asset IDs in browser settings; it is optional, normalized defensively, and does not affect imported portfolio data.

The feature must preserve:

- existing accounts, assets, positions, snapshots, categories, and tags;
- display currency conversion and privacy masking;
- price refresh and automatic snapshot behavior;
- Russian and English localization;
- installable PWA behavior and GitHub Pages deployment under the repository base path.

## Component Boundaries

- Route parsing and formatting are pure utilities independent of DOM rendering.
- Entity-history selectors are pure domain/view-model utilities that consume snapshots and return chart points.
- Rate selection normalization and default ranking are pure view-model utilities.
- Rendering owns list/detail markup but reuses the existing chart drawing and inspection behavior.
- Event handling maps navigation, rate configuration, and prefilled position actions onto existing service/form operations.

## Accessibility and Interaction

- Every navigable row is a semantic button or link with a meaningful accessible name.
- Detail headings receive focus after navigation; back buttons expose localized labels.
- Charts remain keyboard-focusable and support left/right arrow inspection.
- Selection controls expose the three-item maximum and announce validation feedback.
- Touch targets remain at least 44 by 44 CSS pixels.

## Verification

Automated coverage must include:

- route parsing, formatting, invalid-ID fallback, and browser back behavior;
- default top-three rate selection, persisted selection, deleted assets, and the three-item limit;
- rate row unit-price and navigation behavior;
- asset/account snapshot-series extraction with legacy or missing entries;
- Assets and Accounts list navigation without inline expansion;
- portfolio-only History with no scope selector;
- detail chart pointer, touch, and keyboard inspection;
- privacy masking, both locales, responsive four-item navigation, backup compatibility, production build, PWA manifest/service worker, and mobile/desktop end-to-end flows.

## Out of Scope

- Server accounts or synchronization;
- online currency/category/tag dictionaries;
- transaction-level performance attribution;
- manual ordering of selected rate rows;
- native iOS or Android navigation implementation.
