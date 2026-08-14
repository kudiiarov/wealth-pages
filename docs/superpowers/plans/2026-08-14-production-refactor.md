# Worth Production Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Worth into a tested, strict-TypeScript, local-first Vite PWA that preserves existing data and behavior, deploys to GitHub Pages, and is ready for a later Capacitor wrapper and server synchronization.

**Architecture:** Pure domain modules contain models, normalization, calculations, P&L, snapshots, and backup validation. Application services coordinate typed repository, settings, price-provider, and file ports; browser infrastructure implements those ports; DOM modules render and bind the existing interface. Vite produces one static `dist/` for GitHub Pages and future Capacitor packaging.

**Tech Stack:** Node.js 20.19+ or 22.13+, Vite 8.2.1, TypeScript 6.0.3, Vitest 4.1.10, jsdom 29.1.1, fake-indexeddb 6.2.5, ESLint 10.8.1, Prettier 3.9.6, vite-plugin-pwa 1.3.0, Playwright 1.62.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-14-production-refactor-design.md`

## Global Constraints

- Preserve existing functionality, stored data, import compatibility, visual design, and mobile-first flows.
- Keep IndexedDB name `worth-local-portfolio`, database version `1`, and stores `accounts`, `assets`, `positions`, and `snapshots` unless a tested migration explicitly requires a change.
- Keep backup schemas 1 through 14 importable and export schema version 14.
- Keep USD as the canonical storage currency.
- Keep RU and EN translations complete.
- Produce a static deployment that works at `/wealth-pages/`, remains installable, and starts offline after the initial load.
- Do not add a backend, authentication, synchronization engine, UI framework, Capacitor native projects, or major redesign.
- Use characterization-first TDD for every production extraction: observe a relevant test fail because the new module is absent or incomplete, then implement the smallest passing code.

## File Map

- `package.json`, `package-lock.json`: pinned toolchain and verification commands.
- `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`: build and quality configuration.
- `src/domain/models.ts`: canonical persisted and runtime types.
- `src/domain/normalize.ts`: legacy-compatible normalization.
- `src/domain/portfolio.ts`: totals and currency calculations.
- `src/domain/pnl.ts`: snapshot-series and flow-adjusted P&L.
- `src/domain/snapshots.ts`: deterministic snapshot construction.
- `src/domain/backup.ts`: schema-14 serialization and versions 1–14 validation.
- `src/application/ports.ts`: repository, settings, price, file, clock, and ID interfaces.
- `src/application/state.ts`: typed state and initial settings.
- `src/application/portfolio-service.ts`: entity, snapshot, import, export, reset, and price-refresh use cases.
- `src/infrastructure/indexeddb/portfolio-repository.ts`: legacy database implementation and atomic dataset replacement.
- `src/infrastructure/http/price-providers.ts`: Frankfurter and CoinGecko clients.
- `src/platform/browser/settings-store.ts`, `src/platform/browser/file-transfer.ts`: browser adapters.
- `src/i18n/messages.ts`, `src/i18n/format.ts`: typed dictionaries and locale formatting.
- `src/ui/dom.ts`, `src/ui/render.ts`, `src/ui/chart.ts`, `src/ui/forms.ts`, `src/ui/events.ts`: DOM concerns split from application behavior.
- `src/main.ts`: composition root and recoverable startup.
- `src/styles/app.css`: preserved application styles.
- `public/manifest.webmanifest`, `public/icon.svg`, `public/icon-512.png`: static install assets.
- `tests/fixtures/legacy-backups.ts`: representative legacy backup fixtures.
- `tests/**/*.test.ts`: unit, integration, and DOM tests.
- `e2e/portfolio.spec.ts`, `playwright.config.ts`: primary browser smoke flow.
- `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`: verification and Pages deployment.

---

### Task 1: Establish the reproducible toolchain and baseline characterization suite

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `tests/setup.ts`
- Create: `tests/legacy/core.characterization.test.ts`
- Create: `tests/legacy/static-shell.characterization.test.ts`
- Modify: `.gitignore`
- Generate: `package-lock.json`

**Interfaces:**

- Consumes: current `core.js`, `app.js`, `index.html`, and static assets unchanged.
- Produces: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` commands used by every later task.

- [ ] **Step 1: Add characterization tests around the current CommonJS-compatible core**

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const core = require('../../core.js');

describe('legacy WorthCore', () => {
  it('normalizes legacy symbols and preserves multiple positions', () => {
    const data = core.normalizeData({
      accounts: [{ id: 'a', name: ' Cash ', type: 'cash' }],
      assets: [{ id: 'usd', name: ' Dollar ', symbol: ' usd ', price: '1' }],
      positions: [
        { id: 'p1', accountId: 'a', assetId: 'usd', quantity: 2 },
        { id: 'p2', accountId: 'a', assetId: 'usd', quantity: 3 },
      ],
      snapshots: [],
    });

    expect(data.assets[0]).toMatchObject({
      code: 'USD',
      name: 'Dollar',
      price: 1,
    });
    expect(core.portfolioTotal(data.positions, data.assets)).toBe(5);
    expect(data.positions).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Add toolchain configuration with exact versions and scripts**

```json
{
  "name": "worth",
  "version": "2.5.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.19.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/jsdom": "30.0.0",
    "@types/node": "26.2.0",
    "eslint": "10.8.1",
    "fake-indexeddb": "6.2.5",
    "jsdom": "29.1.1",
    "prettier": "3.9.6",
    "typescript": "6.0.3",
    "typescript-eslint": "8.67.0",
    "vite": "8.2.1",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 3: Install dependencies and run baseline tests**

Run: `npm install && npm run test`

Expected: characterization tests pass against the untouched legacy implementation.

- [ ] **Step 4: Run static checks and record baseline limitations**

Run: `npm run typecheck && npm run lint && npm run format:check`

Expected: new configuration and tests pass; legacy files are excluded only until their TypeScript replacements land.

- [ ] **Step 5: Commit the baseline harness**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts eslint.config.js .prettierrc.json .gitignore tests
git commit -m "test: capture legacy portfolio behavior"
```

### Task 2: Extract typed models, normalization, and portfolio calculations

**Files:**

- Create: `src/domain/models.ts`
- Create: `src/domain/normalize.ts`
- Create: `src/domain/portfolio.ts`
- Create: `tests/domain/normalize.test.ts`
- Create: `tests/domain/portfolio.test.ts`

**Interfaces:**

- Consumes: persisted shapes accepted by legacy `WorthCore`.
- Produces: `normalizeData(raw: unknown): PortfolioData`, `positionValue(position, assets): number`, `portfolioTotal(data): number`, `assetQuantity(assetId, positions): number`, `assetTotal(assetId, data): number`, and `accountTotal(accountId, data): number`.

- [ ] **Step 1: Write failing tests for typed legacy normalization**

```ts
it('migrates symbol to code and supplies legacy defaults', () => {
  expect(
    normalizeAsset({ id: 'x', name: ' Gold ', symbol: ' xau ', price: '2' }),
  ).toMatchObject({
    id: 'x',
    name: 'Gold',
    code: 'XAU',
    price: 2,
    autoUpdateSource: 'none',
    color: '#5667ff',
  });
});
```

Run: `npm run test -- tests/domain/normalize.test.ts`

Expected: FAIL because `src/domain/normalize.ts` does not exist.

- [ ] **Step 2: Define canonical domain types and minimal normalizers**

```ts
export type AutoUpdateSource = 'none' | 'coingecko' | 'frankfurter';
export interface Position {
  id: string;
  accountId: string;
  assetId: string;
  quantity: number;
  comment: string;
  createdAt?: number;
  updatedAt?: number;
}
export interface PortfolioData {
  accounts: Account[];
  assets: Asset[];
  positions: Position[];
  snapshots: Snapshot[];
}
```

Implement the exact default colors, icon trimming, uppercase codes, `symbol` migration, position comments, and snapshot asset-code migration characterized from `core.js`.

- [ ] **Step 3: Verify normalization green**

Run: `npm run test -- tests/domain/normalize.test.ts tests/legacy/core.characterization.test.ts`

Expected: both new and legacy normalization suites pass.

- [ ] **Step 4: Write failing portfolio-math tests including negative quantities and duplicate positions**

```ts
it('sums every position and retains negative liabilities', () => {
  const data = fixture({ quantities: [3, 2, -1], price: 10 });
  expect(portfolioTotal(data)).toBe(40);
  expect(assetQuantity('asset', data.positions)).toBe(4);
});
```

Run: `npm run test -- tests/domain/portfolio.test.ts`

Expected: FAIL because the typed calculation module is absent.

- [ ] **Step 5: Implement pure calculations and verify all tests**

```ts
export const positionValue = (position: Position, assets: readonly Asset[]) =>
  numeric(position.quantity) *
  numeric(assets.find(({ id }) => id === position.assetId)?.price);
```

Run: `npm run test && npm run typecheck`

Expected: all suites pass with no TypeScript errors.

- [ ] **Step 6: Commit the typed domain foundation**

```bash
git add src/domain tests/domain
git commit -m "refactor: extract typed portfolio domain"
```

### Task 3: Extract snapshots, P&L, and versioned backup validation

**Files:**

- Create: `src/domain/snapshots.ts`
- Create: `src/domain/pnl.ts`
- Create: `src/domain/backup.ts`
- Create: `tests/domain/snapshots.test.ts`
- Create: `tests/domain/pnl.test.ts`
- Create: `tests/domain/backup.test.ts`
- Create: `tests/fixtures/legacy-backups.ts`

**Interfaces:**

- Consumes: `PortfolioData`, `AppSettings`, a supplied `id`, and a supplied `createdAt`.
- Produces: `buildSnapshot(data, id, createdAt): Snapshot`, `flowAdjustedPnl(points, predicate): PnlResult | null`, `validateBackup(raw): ValidatedBackup`, and `createBackup(data, settings, exportedAt): BackupV14`.

- [ ] **Step 1: Write failing snapshot tests for stable position history**

```ts
expect(buildSnapshot(data, 's1', 123).positions[0]).toEqual({
  positionId: 'p1',
  accountId: 'a1',
  accountName: 'Cash',
  assetId: 'usd',
  assetCode: 'USD',
  assetName: 'Dollar',
  comment: 'reserve',
  quantity: 2,
  price: 1,
  value: 2,
});
```

Run: `npm run test -- tests/domain/snapshots.test.ts`

Expected: FAIL because snapshot construction is not extracted.

- [ ] **Step 2: Implement snapshot construction and verify green**

Use the supplied ID and timestamp so tests are deterministic; copy every current position and calculate account, asset, and total summaries using Task 2 functions.

Run: `npm run test -- tests/domain/snapshots.test.ts`

Expected: PASS.

- [ ] **Step 3: Write failing interval-chain tests for current P&L semantics**

```ts
it('treats quantity increases as external flows at the later price', () => {
  const result = flowAdjustedPnl(
    [point(1, 1, 10), point(2, 2, 12)],
    () => true,
  );
  expect(result).toMatchObject({ pnl: 2, baseCapital: 10, positiveFlows: 12 });
  expect(result?.pct).toBeCloseTo((100 * 2) / 22);
});
```

Run: `npm run test -- tests/domain/pnl.test.ts`

Expected: FAIL until the interval algorithm is implemented.

- [ ] **Step 4: Implement P&L as pure snapshot-series functions and verify green**

Preserve matching by stable `positionId`, later-point flow valuation, first/last baseline selection, and null results when no compatible position snapshots exist.

Run: `npm run test -- tests/domain/pnl.test.ts tests/legacy/core.characterization.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing validation tests for valid v1/v14 and malformed backups**

```ts
expect(validateBackup(legacyV1).data.assets[0].code).toBe('USD');
expect(validateBackup(currentV14).settings?.language).toBe('en');
expect(() =>
  validateBackup({
    ...currentV14,
    positions: [{ id: 'p', accountId: 'missing' }],
  }),
).toThrow('Повреждены позиции');
```

Run: `npm run test -- tests/domain/backup.test.ts`

Expected: FAIL until versioned validation exists.

- [ ] **Step 6: Implement validate-before-normalize and schema-14 serialization**

Validate the four required arrays, identifiers, unique asset codes, numeric fields, references, settings enum values, and versions `1 <= version <= 14`; normalize only after structural acceptance. Preserve the existing Russian validation messages for imported files.

Run: `npm run test -- tests/domain`

Expected: PASS for current and legacy fixtures; malformed fixtures fail without mutation.

- [ ] **Step 7: Commit calculations and backup contracts**

```bash
git add src/domain tests/domain tests/fixtures
git commit -m "refactor: isolate history and backup rules"
```

### Task 4: Add storage, settings, and file ports with atomic browser adapters

**Files:**

- Create: `src/application/ports.ts`
- Create: `src/application/state.ts`
- Create: `src/infrastructure/indexeddb/portfolio-repository.ts`
- Create: `src/platform/browser/settings-store.ts`
- Create: `src/platform/browser/file-transfer.ts`
- Create: `tests/infrastructure/portfolio-repository.test.ts`
- Create: `tests/platform/settings-store.test.ts`

**Interfaces:**

- Produces: `PortfolioRepository.load()`, `put(store, value)`, `delete(store, id)`, `replaceAll(data)`, and `clearAll()`; `SettingsStore.load()` and `save(patch)`; `FileTransfer.downloadJson(name, payload)`.
- Preserves: database identity and localStorage keys `worth-language`, `worth-theme`, `worth-display-currency`, `worth-pnl-period`, and `worth-auto-refresh-launch`.

- [ ] **Step 1: Write failing IndexedDB integration tests using fake-indexeddb**

```ts
it('replaces all stores in one transaction', async () => {
  await repository.put('accounts', account);
  await repository.replaceAll(replacement);
  expect(await repository.load()).toEqual(normalizeData(replacement));
});
```

Run: `npm run test -- tests/infrastructure/portfolio-repository.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 2: Implement a single-transaction IndexedDB repository**

```ts
const request = indexedDB.open('worth-local-portfolio', 1);
request.onupgradeneeded = () => {
  for (const name of STORE_NAMES) {
    if (!request.result.objectStoreNames.contains(name)) {
      request.result.createObjectStore(name, { keyPath: 'id' });
    }
  }
};
```

`replaceAll` must validate before it is called, then clear and repopulate all four stores inside one `readwrite` transaction so any request failure aborts the whole replacement.

- [ ] **Step 3: Verify repository preservation and rollback**

Run: `npm run test -- tests/infrastructure/portfolio-repository.test.ts`

Expected: tests confirm the exact database/store names and that an injected failed write leaves the old dataset intact.

- [ ] **Step 4: Write failing settings compatibility tests**

```ts
expect(store.load()).toEqual({
  language: 'ru',
  theme: 'light',
  displayCurrency: 'USD',
  pnlPeriod: 'all',
  autoRefreshOnLaunch: false,
});
```

Run: `npm run test -- tests/platform/settings-store.test.ts`

Expected: FAIL before the adapter exists.

- [ ] **Step 5: Implement browser settings and JSON download adapters**

The settings adapter validates every localStorage value and writes only the existing keys. The file adapter owns `Blob`, object URL creation, the temporary anchor, and URL revocation.

Run: `npm run test -- tests/platform tests/infrastructure && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit browser persistence adapters**

```bash
git add src/application src/infrastructure src/platform tests/infrastructure tests/platform
git commit -m "refactor: add local-first storage ports"
```

### Task 5: Extract price providers and application use cases

**Files:**

- Create: `src/infrastructure/http/price-providers.ts`
- Create: `src/application/portfolio-service.ts`
- Create: `tests/infrastructure/price-providers.test.ts`
- Create: `tests/application/portfolio-service.test.ts`

**Interfaces:**

- Consumes: `PortfolioRepository`, `SettingsStore`, `FileTransfer`, `PriceProvider`, `Clock`, and `IdGenerator` ports.
- Produces: use cases for CRUD, snapshot, refresh, import, export, reset, reload, and settings changes; `refreshPrices(assetId?): Promise<{ updated: number; skipped: number; failures: PriceFailure[] }>`.

- [ ] **Step 1: Write failing provider URL and conversion tests**

```ts
expect(fetchMock).toHaveBeenCalledWith(
  'https://api.frankfurter.dev/v2/rate/USD/RUB',
  { cache: 'no-store' },
);
expect(
  await provider.usdPrice(
    asset({ code: 'RUB', autoUpdateSource: 'frankfurter' }),
  ),
).toBeCloseTo(1 / 90);
```

Run: `npm run test -- tests/infrastructure/price-providers.test.ts`

Expected: FAIL until the typed clients exist.

- [ ] **Step 2: Implement provider clients with partial failure and 60-second fiat cache**

Keep the existing crypto-code mapping and keyless CoinGecko simple-price endpoint. Unknown or unconfigured assets return a skipped result, not a guessed price.

Run: `npm run test -- tests/infrastructure/price-providers.test.ts`

Expected: PASS.

- [ ] **Step 3: Write failing application-service tests for CRUD, import atomicity, export, and refresh**

```ts
it('does not replace repository data when backup validation fails', async () => {
  await expect(service.importBackup('{"bad":true}')).rejects.toThrow();
  expect(repository.replaceAll).not.toHaveBeenCalled();
});
```

Run: `npm run test -- tests/application/portfolio-service.test.ts`

Expected: FAIL because orchestration does not exist.

- [ ] **Step 4: Implement use cases without DOM dependencies**

The service creates IDs and timestamps through injected ports, normalizes all writes, prevents duplicate asset codes, builds snapshots through the domain, validates imports before `replaceAll`, restores validated settings, and records price timestamps only on success.

Run: `npm run test -- tests/application tests/infrastructure && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit application orchestration**

```bash
git add src/application src/infrastructure/http tests/application tests/infrastructure
git commit -m "refactor: extract portfolio use cases"
```

### Task 6: Extract typed localization and formatting

**Files:**

- Create: `src/i18n/messages.ts`
- Create: `src/i18n/format.ts`
- Create: `tests/i18n/messages.test.ts`
- Create: `tests/i18n/format.test.ts`

**Interfaces:**

- Produces: `translate(language, key, ...args)`, `formatMoney`, `formatNumber`, `formatDate`, `formatTime`, `formatRelativeTime`, and display-currency conversion helpers.

- [ ] **Step 1: Write failing compile/runtime translation parity tests**

```ts
expect(Object.keys(messages.en).sort()).toEqual(
  Object.keys(messages.ru).sort(),
);
expect(translate('en', 'pnlVsLast')).toBe('Since last snapshot');
expect(translate('ru', 'pricesUpdated', 2)).toBe('Цены обновлены: 2');
```

Run: `npm run test -- tests/i18n/messages.test.ts`

Expected: FAIL before dictionaries are extracted.

- [ ] **Step 2: Move RU/EN messages into a typed dictionary**

Define English as `satisfies MessageDictionary` derived from the Russian keys, preserve callable message signatures, and prevent unknown string keys at call sites.

- [ ] **Step 3: Write failing locale and display-currency formatting tests**

```ts
expect(parseDecimal('1 234,5')).toBe(1234.5);
expect(convertUsdToDisplay(100, { code: 'EUR', price: 2 })).toBe(50);
```

Run: `npm run test -- tests/i18n/format.test.ts`

Expected: FAIL until formatting helpers exist.

- [ ] **Step 4: Implement pure formatters and verify parity**

Run: `npm run test -- tests/i18n && npm run typecheck`

Expected: both languages have identical keys and all formatting cases pass.

- [ ] **Step 5: Commit localization modules**

```bash
git add src/i18n tests/i18n
git commit -m "refactor: type localization and formatting"
```

### Task 7: Migrate the existing shell and UI to TypeScript modules

**Files:**

- Modify: `index.html`
- Create: `src/main.ts`
- Create: `src/ui/dom.ts`
- Create: `src/ui/render.ts`
- Create: `src/ui/chart.ts`
- Create: `src/ui/forms.ts`
- Create: `src/ui/events.ts`
- Create: `src/ui/startup-error.ts`
- Create: `src/styles/app.css`
- Create: `tests/ui/dom.test.ts`
- Create: `tests/ui/forms.test.ts`
- Create: `tests/ui/startup-error.test.ts`
- Delete: `app.js`
- Delete: `core.js`
- Delete: `styles.css`

**Interfaces:**

- Consumes: typed state, application service, translations, and formatting helpers.
- Produces: `createWorthApp(dependencies).start()` with no global `WorthCore`, global database handle, or direct persistence calls from UI modules.

- [ ] **Step 1: Write failing DOM-helper and startup-error tests**

```ts
document.body.innerHTML = '<div id="root"></div>';
expect(() => requiredElement('missing')).toThrow(
  'Missing required element: missing',
);
renderStartupError(document.body, 'en');
expect(document.body.textContent).toContain(
  'Could not open the local database',
);
```

Run: `npm run test -- tests/ui/dom.test.ts tests/ui/startup-error.test.ts`

Expected: FAIL before UI helpers exist.

- [ ] **Step 2: Implement typed DOM access and recoverable startup rendering**

Use explicit `HTMLFormElement`, `HTMLDialogElement`, `HTMLCanvasElement`, input, and select guards. Startup errors retain the shell where possible and expose a retry action instead of replacing the body with an unstructured string.

- [ ] **Step 3: Write failing form tests for duplicate assets, multiple positions, and price-currency conversion**

```ts
submitPosition({
  accountId: 'a',
  assetId: 'usd',
  quantity: '2',
  comment: ' reserve ',
});
submitPosition({ accountId: 'a', assetId: 'usd', quantity: '3', comment: '' });
expect(service.createPosition).toHaveBeenCalledTimes(2);
```

Run: `npm run test -- tests/ui/forms.test.ts`

Expected: FAIL before form controllers are extracted.

- [ ] **Step 4: Implement form controllers and delegated event routing**

Move current submit handlers unchanged in behavior, call application use cases, then reload and render. Preserve confirmation before destructive actions and import replacement. Keep native dialogs and current focus/navigation behavior.

- [ ] **Step 5: Extract rendering and chart modules**

Move balance, allocation, account, asset, position, history, quick-update, currency, and P&L rendering into focused functions. Every value interpolated into HTML passes through `escapeHtml`; numeric coordinates and colors are constrained by typed domain helpers.

- [ ] **Step 6: Switch the HTML entry to Vite and preserved CSS**

```html
<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />
<script type="module" src="/src/main.ts"></script>
```

Copy existing CSS declarations to `src/styles/app.css`, import it from `main.ts`, and make only verified accessibility or path corrections.

- [ ] **Step 7: Verify UI tests and production build before removing legacy files**

Run: `npm run test && npm run typecheck && npm run build`

Expected: all tests pass and `dist/index.html` references generated assets; the application no longer loads `core.js`, `app.js`, or root `styles.css`.

- [ ] **Step 8: Remove superseded legacy files and verify again**

Run: `npm run test && npm run build && rg 'core\.js|app\.js|styles\.css|WorthCore' index.html src tests --glob '!tests/legacy/**'`

Expected: tests and build pass; the final search returns no production references.

- [ ] **Step 9: Commit the TypeScript UI migration**

```bash
git add index.html src tests/ui app.js core.js styles.css
git commit -m "refactor: migrate application UI to TypeScript"
```

### Task 8: Add build-aware PWA support and GitHub Pages deployment

**Files:**

- Modify: `vite.config.ts`
- Create: `public/manifest.webmanifest`
- Move: `icon.svg` to `public/icon.svg`
- Move: `icon-512.png` to `public/icon-512.png`
- Delete: `manifest.json`
- Delete: `sw.js`
- Create: `tests/build/pages-path.test.ts`
- Create: `tests/build/pwa.test.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**

- Produces: `dist/` with base `/wealth-pages/`, generated precache service worker, relative manifest scope/start URL, and a Pages deployment artifact.

- [ ] **Step 1: Write failing built-path and manifest tests**

```ts
expect(builtHtml).toContain('/wealth-pages/assets/');
expect(manifest.start_url).toBe('/wealth-pages/');
expect(manifest.scope).toBe('/wealth-pages/');
expect(await fileExists('dist/sw.js')).toBe(true);
```

Run: `npm run build && npm run test -- tests/build`

Expected: FAIL because the legacy service worker and manifest are not build-aware.

- [ ] **Step 2: Install and configure vite-plugin-pwa for injected base-aware assets**

Run: `npm install --save-dev vite-plugin-pwa@1.3.0`

Use `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Worth — личный портфель', short_name: 'Worth', display: 'standalone', theme_color: '#f4f5f7', icons: [...] }, workbox: { navigateFallback: 'index.html', cleanupOutdatedCaches: true } })` and `base: process.env.GITHUB_ACTIONS ? '/wealth-pages/' : '/'`.

- [ ] **Step 3: Add CI and supported Pages artifact deployment**

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm run check
- uses: actions/upload-pages-artifact@v3
  with:
    path: dist
```

Define `npm run check` as `npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build`. Deployment uses `actions/deploy-pages@v4` with `pages: write` and `id-token: write` permissions and only runs from `main`.

- [ ] **Step 4: Verify the production subpath and offline artifact**

Run: `GITHUB_ACTIONS=true npm run build && npm run test -- tests/build`

Expected: generated HTML, manifest, icons, and service worker all use valid Pages paths and outdated caches are cleaned.

- [ ] **Step 5: Commit PWA and Pages automation**

```bash
git add vite.config.ts public tests/build .github package.json package-lock.json manifest.json sw.js icon.svg icon-512.png
git commit -m "ci: deploy build-aware PWA to GitHub Pages"
```

### Task 9: Add the browser smoke test and production documentation

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/portfolio.spec.ts`
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/mobile-and-sync-roadmap.md`

**Interfaces:**

- Consumes: production UI and browser storage.
- Produces: reproducible end-to-end proof and operator documentation for Pages, backups, Capacitor, and future sync.

- [ ] **Step 1: Install Playwright test runner and write the failing primary-flow test**

Run: `npm install --save-dev @playwright/test@1.62.1 && npx playwright install chromium`

```ts
test('portfolio survives reload and exports a v14 backup', async ({ page }) => {
  await page.goto('/');
  await createAccount(page, 'Cash');
  await createAsset(page, { name: 'Dollar', code: 'USD', price: '1' });
  await createPosition(page, {
    account: 'Cash',
    asset: 'USD',
    quantity: '100',
  });
  await page.getByRole('button', { name: 'Снимок' }).first().click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '$100.00' })).toBeVisible();
});
```

Run: `npm run test:e2e`

Expected: FAIL until Playwright configuration, browser installation, and stable test helpers are complete.

- [ ] **Step 2: Configure a production-preview web server and finish the smoke flow**

Set `webServer.command` to `npm run build && npm run preview -- --host 127.0.0.1`, use one Chromium project, capture trace on first retry, and assert account/asset/position creation, snapshot persistence after reload, export download name, and successful import restoration.

- [ ] **Step 3: Rewrite README around the production workflow**

Document Node 22, `npm ci`, dev/test/build/preview/check commands, IndexedDB privacy and backup warnings, GitHub Pages Actions setup, supported import versions, architecture directories, and troubleshooting for service-worker cache updates.

- [ ] **Step 4: Document the later Capacitor and sync path**

Include the exact future sequence `npm install @capacitor/core @capacitor/cli`, `npx cap init`, platform installation, `npx cap add ios`, `npx cap add android`, `npm run build`, and `npx cap sync`. Explain that native storage is a separate container, JSON remains the initial transfer path, and future account sync will combine IndexedDB offline cache with an authenticated remote repository.

- [ ] **Step 5: Run the complete release gate**

Run: `npm run check && npm run test:e2e && git diff --check`

Expected: typecheck, lint, format check, unit/integration/DOM/build tests, production build, and browser smoke test all complete with zero failures.

- [ ] **Step 6: Inspect final scope and commit**

Run: `git status --short && git diff --stat HEAD~1 && git log --oneline --decorate -10`

Confirm only planned application, test, automation, and documentation files changed.

```bash
git add package.json package-lock.json playwright.config.ts e2e README.md docs/mobile-and-sync-roadmap.md
git commit -m "test: verify production portfolio flow"
```

### Task 10: Final compatibility audit

**Files:**

- Modify only files implicated by failures found during this audit.

**Interfaces:**

- Consumes: every acceptance criterion in the approved specification.
- Produces: fresh evidence that the refactor is ready for review without claiming deployment or publishing changes externally.

- [ ] **Step 1: Compare requirements with implementation**

Re-read `docs/superpowers/specs/2026-08-14-production-refactor-design.md` and map each acceptance criterion to a passing test, build artifact inspection, or explicit manual check.

- [ ] **Step 2: Verify legacy data in a browser fixture**

Seed database `worth-local-portfolio` version `1` with legacy `symbol` assets and position comments missing, load the production app, and confirm the data normalizes without deleting IDs or duplicating positions.

- [ ] **Step 3: Verify mobile layouts and accessible interactions**

Run Playwright at 390×844 and 1280×800. Confirm dialogs open/close by keyboard, primary actions remain reachable, charts resize, text does not overflow critical controls, and both themes and languages render.

- [ ] **Step 4: Run the final clean verification**

Run: `npm ci && npm run check && npm run test:e2e && git status --short --branch`

Expected: clean installation and every automated check pass. Git status contains no generated `dist/`, coverage, or Playwright artifacts.

- [ ] **Step 5: Commit audit-only fixes if any**

Run: `git add -u && git commit -m "fix: close production compatibility gaps"`

If no fixes are required, do not create an empty commit.
