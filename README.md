# Worth

Mobile-first portfolio tracker that works locally, offline, and without an account. Data is stored in IndexedDB; JSON export remains available for backup and recovery.

## Features

- accounts, assets, positions, comments, and negative balances;
- portfolio allocation, snapshots, position history, and flow-adjusted P&L;
- RU/EN interface, light/dark theme, and configurable display currency;
- optional price refresh through Frankfurter and CoinGecko;
- bounded local event log for diagnostics, including per-asset price failures;
- schema-compatible import for backup versions 1–14;
- installable PWA with offline startup after the first successful load;
- static GitHub Pages deployment under `/wealth-pages/`.

## Development

Requires Node.js 20.19+ (Node.js 24 is used in CI).

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm run check      # types, lint, formatting, unit/integration tests, build
npm run test:e2e   # mobile and desktop Chromium smoke tests
npm run build      # production PWA in dist/
npm run preview    # serve the production build locally
```

Playwright needs Chromium once on a new machine:

```bash
npx playwright install chromium
```

## Architecture

```text
UI → application services → domain
                  ↓
          repository/platform ports
                  ↓
       IndexedDB, browser files, HTTP
```

Business rules in `src/domain` do not depend on the browser. `src/application` coordinates use cases through typed ports. Browser persistence, files, and price APIs live in adapters under `src/infrastructure` and `src/platform`. This separation lets a future Capacitor build replace platform adapters without rewriting portfolio logic.

Detailed decisions are in [the refactor design](docs/superpowers/specs/2026-08-14-production-refactor-design.md). The staged path to native apps, accounts, and server synchronization is in [the mobile and sync roadmap](docs/mobile-and-sync-roadmap.md).

## Data safety

IndexedDB remains authoritative and uses the existing `worth-local-portfolio` database. Import validates the complete backup before replacing data in one transaction. Clearing browser/site storage still removes local data, so export a backup before clearing it or changing devices.

JSON is now a manual backup format, not an internal persistence dependency. A future account-based migration can upload the existing local dataset directly after login.

## GitHub Pages

The `Deploy GitHub Pages` workflow builds and publishes `dist/` on pushes to `main`. In repository settings, select **GitHub Actions** as the Pages source. Vite automatically uses `/wealth-pages/` in Actions and `/` during local development.

On iOS, open the HTTPS Pages URL in Safari and choose **Share → Add to Home Screen**. On Android, use the browser's install action.

## Compatibility

- existing IndexedDB store names and database identity are preserved;
- legacy records are normalized on read;
- backup schemas 1–14 remain importable;
- exports use schema 14 and include application settings;
- the current product version is `3.1.0` (`3.1-final` in the UI and backups).
