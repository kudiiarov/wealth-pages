# Mobile applications and server synchronization roadmap

The current refactor deliberately stops before adding accounts or native projects. It establishes the boundaries needed to add them without maintaining separate web, iOS, and Android business logic.

## Target shape

```text
Web/PWA UI ─┐
iOS shell ──┼─→ application services → local-first repository → IndexedDB/native store
Android ────┘                                      │
                                                   └→ authenticated sync API → database
```

The domain and application layers remain shared TypeScript. GitHub Pages keeps using the browser adapters. Capacitor selects native adapters at runtime only where the platform provides a better capability.

## Phase 1: package the existing PWA

1. Add Capacitor to the repository and point `webDir` at `dist`.
2. Generate `ios/` and `android/` projects from the same Vite output.
3. Add adapters for file sharing/import, secure preferences, network state, and optional biometrics.
4. Test safe areas, keyboard behavior, dialogs, deep links, resume/background behavior, and offline startup on physical devices.
5. Add native build/signing pipelines and store metadata.

This phase does not require a backend. The web/PWA and both native apps continue using local data and JSON backup.

## Phase 2: accounts and remote API

Introduce authentication and a versioned API without changing UI code into a database client. Recommended server responsibilities:

- user identity and session/token lifecycle;
- ownership checks for every portfolio record;
- encrypted transport and encrypted backups/storage where appropriate;
- idempotent batch upload/download endpoints;
- monotonic server revision or cursor per user;
- audit logging, rate limits, backup/restore, and account deletion/export.

The client adds `AuthService` and `SyncTransport` ports. Provider-specific SDKs stay in adapters, so the core is not coupled to a particular auth or database vendor.

## Phase 3: adopt existing local data after login

The first login must not discard or silently duplicate the portfolio already on the device:

1. authenticate and obtain an empty-or-existing remote portfolio summary;
2. keep the local database untouched while the user chooses **upload local**, **use server**, or **merge** when both contain data;
3. upload a validated, idempotent batch with stable existing UUIDs;
4. receive the authoritative server cursor and persist it locally;
5. enable continuous synchronization only after the adoption transaction succeeds.

JSON export remains available as disaster recovery, but normal device migration happens by signing in and syncing.

## Phase 4: local-first synchronization

Before implementation, add backwards-compatible sync metadata to records:

- stable `id` and `ownerId`;
- `createdAt`, `updatedAt`, and server `revision`;
- tombstones for deletions so offline deletes propagate;
- a client-generated operation id for retry-safe writes.

Use an outbox pattern: every local mutation updates local state and appends a pending operation in one transaction. A sync worker pushes pending operations, then pulls changes since the last cursor. Network loss never blocks local portfolio use.

Conflict policy should be explicit per field/entity. A practical first version is server-ordered last-write-wins for ordinary edits, while deletes, account adoption, and concurrent position changes receive dedicated tests and visible recovery behavior. Financial totals and snapshots are derived from synchronized source records rather than merged independently.

## Security and privacy gates

Before public account launch:

- threat-model tokens, exported backups, logs, analytics, and price-provider requests;
- store native refresh tokens in Keychain/Android Keystore, never plain preferences;
- prevent portfolio values and credentials from entering crash logs;
- provide remote session revocation, data export, and full account deletion;
- document data residency, retention, backups, and recovery objectives;
- run migration, authorization, offline/conflict, and multi-device end-to-end tests.

## Why the current code is ready for this path

- UI calls `PortfolioService` instead of IndexedDB directly.
- `PortfolioRepository`, `SettingsStore`, `FileTransfer`, and `PriceProvider` are replaceable ports.
- import/export and schemas are isolated from live persistence.
- the IndexedDB replacement operation is atomic.
- entities already have stable IDs and normalized data models.
- Vite produces one static `dist/` consumed by Pages today and Capacitor later.

The next implementation milestone should be Capacitor packaging first. Authentication and synchronization should follow only after the API contract, local-data adoption flow, conflict rules, and privacy requirements are agreed.
