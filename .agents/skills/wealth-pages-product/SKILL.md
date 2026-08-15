---
name: wealth-pages-product
description: Use when changing, debugging, reviewing, testing, releasing, or designing the Wealth Pages local-first portfolio PWA and its GitHub Pages repository.
---

# Wealth Pages Product

## Product contract

Preserve a fast mobile-first portfolio overview that works locally, offline, and without an account. Treat iPhone Safari/PWA and GitHub Pages under `/wealth-pages/` as primary environments.

- Keep IndexedDB authoritative. Never lose existing data; normalize legacy records and migrate schemas explicitly.
- Keep JSON backward-compatible as backup/restore, not runtime persistence.
- Keep domain rules browser-independent: `UI → application → domain`, with IndexedDB, HTTP, files, and lifecycle behind adapters.
- Keep snapshots and prices independent. Store only the newest record per asset/local day; active-PWA scheduling is best-effort with launch catch-up.
- Never detach `window.fetch`; Safari requires the correct receiver.

## UX contract

- Show portfolio state and price freshness at a glance.
- Keep Assets and Accounts as separate tabs with dedicated details. Asset detail leads with unit price/status and price history, then “Your portfolio”. Account detail is compact aggregation without a chart.
- Keep every position reachable and editable from related asset/account rows.
- Keep lists compact and touch-friendly. Allocation shows four largest entries plus Other; preserve its one-column legend.
- Draw financial charts with sharp lines and support pointer, touch, and keyboard inspection to exact values.
- Preserve RU/EN, light/dark, privacy mode, and the approved mobile visual language.

## Change workflow

1. Inspect code, tests, recent commits, and dirty state. Follow existing boundaries; avoid unrelated refactors.
2. Write a failing behavior test before production changes. Add migration/regression coverage for persistence changes.
3. Run `npm run check`, then `npm run test:e2e`.
4. Run the production build via `npm run preview`. In a real browser inspect affected flows at mobile and desktop widths: navigation, scroll, touch targets, dialogs, charts, RU/EN, and light/dark. Use a clean context for IndexedDB/service-worker changes.
5. Verify version consistency across package, UI/backup constants, PWA build, and release notes.
6. Commit, merge to `main`, push, wait for CI/Pages, and verify the live URL serves the new version and hashed bundle. Account for service-worker caching in installed PWAs.

Never claim completion from unit tests alone: production build, browser behavior, CI, and the deployed Pages result are part of the product.
