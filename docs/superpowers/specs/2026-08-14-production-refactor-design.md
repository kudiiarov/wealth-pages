# Worth Production Refactor Design

## Status

Approved in conversation on 2026-08-14. This document defines the refactor scope before implementation planning.

## Context

Worth is a mobile-first, local-only portfolio tracker implemented as a single static HTML page with global JavaScript, CSS, IndexedDB persistence, a service worker, and JSON backup import/export. It is currently deployable from a GitHub Pages branch root and has no build tool, package manifest, CI workflow, or test files in the repository.

The application already supports accounts, assets, multiple positions per account and asset, portfolio and position history, flow-adjusted P&L, automatic fiat and crypto price refresh, RU/EN localization, display currencies, themes, snapshots, schema migrations, and offline installation as a PWA. These behaviors and the current visual design are product requirements, not incidental implementation details.

## Goals

- Preserve current functionality, stored user data, import compatibility, visual design, and mobile-first interaction patterns.
- Establish a production-grade Vite and strict TypeScript toolchain without introducing a UI framework.
- Decompose business rules, application use cases, persistence, platform services, localization, and DOM rendering into independently testable modules.
- Continue deploying a static, offline-capable PWA to GitHub Pages under the repository subpath.
- Prepare the codebase for later packaging as iOS and Android applications with Capacitor.
- Prepare data boundaries for future accounts and server synchronization without implementing either in this phase.

## Non-goals

- No backend, authentication, account registration, remote database, or synchronization engine.
- No checked-in Xcode or Android Studio projects and no Capacitor runtime dependency in this phase.
- No major redesign, product-flow changes, or replacement of the existing feature set.
- No conversion to React, Vue, Svelte, Web Components, or a component framework.
- No automatic transfer of data from an installed browser PWA into a future native application container.

## Chosen Approach

Use Vite, TypeScript, and direct DOM rendering. This provides a small static bundle compatible with GitHub Pages and Capacitor while allowing an incremental migration from the current implementation.

Alternatives considered:

- Web Components would isolate UI elements but add lifecycle and composition complexity that the current application does not need.
- React would provide a broad ecosystem but require a simultaneous UI rewrite, increasing regression risk without being necessary for either GitHub Pages or Capacitor.
- Keeping untyped global JavaScript would minimize initial movement but would not establish the module boundaries and compile-time guarantees required by the refactor.

## Target Architecture

The dependency direction is one-way:

```text
UI and user interactions
          ↓
Application use cases and state
          ↓
Pure domain models and calculations
          ↓
Ports implemented by IndexedDB, HTTP, browser, or future Capacitor adapters
```

Domain modules cannot import DOM, IndexedDB, `localStorage`, `fetch`, service-worker, or Capacitor APIs. Application use cases depend on narrow interfaces. Infrastructure and platform modules implement those interfaces. UI modules invoke use cases and render their results.

### Proposed source layout

```text
src/
  domain/          models, normalization, portfolio math, P&L, snapshots
  application/     state and user-facing use cases
  infrastructure/  IndexedDB repositories, HTTP price clients
  platform/        browser storage, files, dialogs, and future native ports
  i18n/            typed RU/EN messages and formatting
  ui/              navigation, forms, modals, rendering, chart
  styles/          existing visual system split by responsibility
  main.ts           composition root and application startup
```

Modules should be focused enough to understand and test independently. The implementation plan will name exact files after characterization tests establish the current behavior.

## Domain and Application Boundaries

The domain owns:

- normalized account, asset, position, and snapshot types;
- portfolio, account, asset, and position totals;
- flow-adjusted P&L calculations;
- snapshot creation and historical compatibility;
- decimal parsing and validation rules;
- backup schema validation and normalization;
- deterministic migrations between supported data shapes.

The application layer owns use cases such as creating or editing entities, refreshing prices, creating snapshots, changing settings, importing backups, and resetting local data. Each use case coordinates repositories and platform services but does not manipulate DOM nodes.

The UI owns form state, event binding, view navigation, rendering, focus behavior, accessible labels, and user notifications. Existing flows and appearance remain recognizably unchanged; only clear accessibility, responsive-layout, and error-message defects may be corrected.

## Persistence and Migration Safety

IndexedDB remains the authoritative store in this phase. Refactoring must open the existing database name and version safely and preserve the existing object stores and records. Migration must never clear data as a recovery strategy.

Persistence is accessed through repository interfaces rather than direct global calls. Records use stable UUIDs. Sync-oriented metadata such as revision or update timestamps may be introduced only through an explicit, tested, backwards-compatible migration and must not change business behavior.

Before persistence code is replaced, characterization and migration tests will cover representative legacy records and backups. Backup schema versions 1 through 14 remain importable. Export continues to produce a current, documented schema. Invalid imports are rejected before any existing records are changed.

JSON remains a manual backup and recovery feature. It is not the abstraction through which the application reads or writes live data.

## Future Accounts and Synchronization

Future synchronization will compose a local repository with a remote sync API:

```text
Application → repository facade → IndexedDB offline cache
                                → authenticated sync API
```

This phase prepares the boundary but does not implement speculative conflict resolution. When synchronization is designed, it will define user ownership, operation ordering, tombstones, conflict policy, encryption and privacy requirements, and first-login adoption of existing local data.

The future native application will use its own storage container. Existing PWA data will initially move through export/import unless a dedicated account-based migration flow is later implemented.

## Price Providers and Network Failures

Frankfurter and CoinGecko access move behind typed price-provider interfaces. Asset source selection, USD canonical pricing, supported crypto mappings, caching, and partial-success behavior remain unchanged.

A failed provider request must not corrupt or discard stored prices. Bulk refresh reports useful success and failure information while preserving all unaffected assets. Network failure never prevents access to local portfolio data.

## Localization

RU and EN dictionaries become typed modules with identical key sets. Missing keys fail automated checks instead of leaking internal identifiers into the interface. Dynamic messages remain functions with typed arguments where required. Locale-specific number, currency, relative-time, and date formatting remain centralized.

## PWA and GitHub Pages

Vite builds a static `dist/` directory. The production base path is compatible with `/wealth-pages/`, while local development runs at `/`. Asset, manifest, icon, navigation fallback, and service-worker URLs must remain valid under both locations.

GitHub Actions will run verification and deploy `dist/` through the supported GitHub Pages artifact workflow. The PWA remains installable and supports offline startup after the first successful load. Service-worker updates must use versioned assets and avoid leaving users indefinitely on a stale application shell.

No server-only rendering or runtime server dependency may be introduced.

## Future Capacitor Packaging

Capacitor will consume the same `dist/` output used by GitHub Pages. A later mobile phase can initialize Capacitor, add `ios/` and `android/`, and implement platform adapters for sharing files, secure preferences, biometrics, local notifications, network state, and haptics.

Browser functionality remains the default implementation. Capability checks select native adapters only when the application runs inside a supported Capacitor container. This keeps the web, PWA, iOS, and Android variants on one TypeScript codebase.

App Store submission is outside this phase. The native product should eventually include meaningful platform integration and polished device behavior rather than being only a repackaged website.

## Error Handling and Data Integrity

- IndexedDB initialization, transactions, migrations, import, and export expose typed failures to the application layer.
- User-facing errors are localized and actionable without exposing stack traces.
- Destructive reset retains explicit confirmation.
- Import validates the complete payload before starting a replacement transaction.
- Failed imports and migrations leave the prior dataset intact.
- Price refresh allows partial success and records timestamps only for successful updates.
- Unexpected startup failures display a recoverable error state rather than a blank screen.

## Testing Strategy

The refactor follows characterization-first, test-driven migration:

- Unit tests cover normalization, totals, decimal parsing, snapshot construction, P&L, price conversion, and backup validation.
- Migration fixtures cover representative records and backup schemas from versions 1 through 14.
- IndexedDB integration tests verify transactions, preservation of legacy stores, failed-import atomicity, and repository behavior.
- DOM tests cover primary navigation, forms, modal actions, language changes, settings, and rendering states.
- A browser smoke test covers creating account, asset, and position data; taking a snapshot; reloading; exporting; and restoring.
- Static checks enforce strict TypeScript, ESLint, formatting, translation completeness, and valid local asset references.
- The production build and a served `dist/wealth-pages/` test verify GitHub Pages subpath behavior.
- PWA checks verify manifest validity, service-worker registration, installable assets, and offline shell startup.

Tests must establish existing behavior before the corresponding production code is moved. Where current behavior is demonstrably unsafe, a failing regression test will define the correction before implementation.

## Delivery Sequence

1. Record the baseline and add characterization fixtures and tests.
2. Introduce the Vite, TypeScript, lint, formatting, and test toolchain.
3. Extract pure domain models, normalization, calculations, snapshots, and backup validation.
4. Introduce repository and platform interfaces, then migrate IndexedDB and settings without changing database identity.
5. Extract price clients and application use cases.
6. Split localization and DOM UI responsibilities while preserving the interface.
7. Move styles and static assets into the Vite build without visual redesign.
8. Replace the service worker with a build-aware PWA setup and validate offline updates.
9. Add GitHub Pages CI/deployment and production-path verification.
10. Document local development, backup compatibility, deployment, and the later Capacitor and sync path.

Each step must leave the application runnable and independently testable. Implementation commits should be small and scoped to one behavior or boundary.

## Acceptance Criteria

- Existing portfolio workflows remain functional in RU and EN on mobile and desktop layouts.
- Existing IndexedDB data loads without reset or manual conversion.
- Backup schemas 1 through 14 import successfully; malformed backups cannot partially replace data.
- Current calculations and P&L behavior are covered by automated tests and remain equivalent.
- `npm run build` emits a self-contained static GitHub Pages deployment.
- The deployed application works at the repository subpath and remains installable and usable offline after first load.
- CI runs type checking, linting, tests, production build, and path checks before deployment.
- Domain and application modules do not directly depend on DOM, IndexedDB, `localStorage`, or `fetch`.
- The repository documentation describes how the same build can later be wrapped with Capacitor and extended with account-based synchronization.
