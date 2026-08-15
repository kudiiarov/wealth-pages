# Portfolio Visual Hierarchy Redesign

## Goal

Make the Home, Assets, Accounts, asset-detail, and account-detail screens answer one primary question each without duplicating information or confusing an asset's unit price with the user's holding value.

## Home

### Rates

- Russian heading: `Курсы валют`; English heading: `Rates`.
- Replace the large colored configuration control with a quiet text action: `Настроить` / `Configure`.
- Show one to three configured asset pairs.
- Each pair stores a source asset and a quote asset. Any asset may be used on either side; no category restrictions apply.
- A row shows the source asset icon, full source asset name, converted price, freshness status, and navigation chevron.
- Do not show asset codes in rate rows.
- Clicking a rate row opens the source asset detail.
- The configuration sheet allows changing both sides of every pair and keeps the selected pair order.

### Structure

- Remove the Exposures section.
- Keep Portfolio structure as the single category-allocation view on Home.

## Assets and Accounts tabs

- Remove search, tag filters, and category filters.
- Replace those controls with a compact allocation summary.
- The summary shows the four largest entities individually and groups the remainder into `Other` / `Остальные`.
- List rows do not repeat allocation percentage.
- Asset rows show icon, full name, portfolio value, and value change percentage.
- Account rows show icon, full name, account value, and value change percentage.
- Add actions remain visible in the page header.

## Asset detail

The asset detail is about the asset first and the user's holding second.

### Market section

- Header row: asset icon, full asset name, current unit price beneath the name, and price freshness status aligned on the right.
- Show absolute and percentage unit-price change for the selected period.
- Show an interactive unit-price history chart with exact value inspection.
- Period controls support the same available ranges as the portfolio chart.
- Price history is derived from prices stored in portfolio snapshots. It is not provider-supplied intraday market history.
- With fewer than two stored price points, show the existing minimum-history empty state.

### Your portfolio section

- Do not show a second chart.
- Present a compact aggregate inspired by the approved reference:
  - total holding value;
  - total quantity;
  - percentage of the whole portfolio;
  - absolute and percentage holding change;
  - related accounts with account icon, name, quantity, value, and change.
- Clicking a related account opens its detail page.

### Actions and taxonomy

- Keep Add position and overflow actions visible in the detail header.
- Category and tags remain editable but do not occupy primary detail content.

## Account detail

- Do not show an account chart.
- Show account icon and full name, followed by one compact aggregation surface containing:
  - account balance;
  - number of positions;
  - percentage of the whole portfolio;
  - absolute and percentage account change;
  - all related assets with icon, name, quantity, value, and change.
- Clicking a related asset opens its detail page.
- Keep Add position and overflow actions visible in the detail header.

## Data and persistence

- Replace the selected-rate ID setting with an ordered list of pair records containing source asset ID and quote asset ID.
- Migrate existing selected rate IDs by assigning the current display currency asset as quote when available, otherwise USD, otherwise the first usable asset.
- Normalize pairs by removing missing assets, duplicate source assets, and entries beyond the three-row limit.
- Backups include the ordered pairs and continue accepting backups that only contain the legacy selected-rate IDs.
- Pair conversion uses the existing USD-normalized asset prices: `source.price / quote.price`.
- Zero, missing, or non-finite quote prices produce a visible unavailable state rather than an invalid number.

## Accessibility and interaction

- Interactive targets are at least 44 CSS pixels.
- Price and portfolio charts support pointer, touch, and keyboard inspection to exact cents.
- Status is communicated by text in addition to color.
- Browser Back and in-app Back retain the existing hash-route behavior required by GitHub Pages and the installed PWA.

## Verification

- Unit tests cover pair normalization, conversion, settings persistence, backup migration, four-plus-Other allocation, and snapshot price series.
- E2E tests cover rate configuration and persistence, rate-to-asset navigation, removed search/filter/exposure UI, asset price chart inspection, asset aggregation, account aggregation, responsive navigation, and direct hash routes.
- Production build must retain the generated service worker, web manifest, and GitHub Pages-compatible hash routing.
