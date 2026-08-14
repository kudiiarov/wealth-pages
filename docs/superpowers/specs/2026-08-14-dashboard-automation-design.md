# Dashboard and Launch Automation Design

## Goal

Simplify Worth's mobile dashboard and positions screen while adding reliable, independently configurable price refresh and portfolio snapshot automation for Safari PWA launches and foreground resumes.

## Scope

This release removes the three dashboard quick actions, progressively discloses long dashboard lists, adds account/asset grouping to Positions, reduces the visual height of bottom navigation, and replaces the single launch-price toggle with independent schedules for prices and snapshots.

The visual language, data model semantics, manual editing flows, history, diagnostics, offline storage, JSON backup support, and GitHub Pages deployment remain intact.

## Launch automation

### Settings

The settings screen contains two independent controls:

- automatic price refresh: enabled/disabled and an interval of 1, 3, 6, 12, or 24 hours;
- automatic snapshot: enabled/disabled and an interval of 1, 3, 6, 12, or 24 hours.

Defaults for existing and new installations are:

- price refresh preserves the legacy `autoRefreshOnLaunch` value, using a 3-hour interval;
- automatic snapshots are disabled, using a 6-hour interval.

The selected preferences and last-completion timestamps persist through `SettingsStore`. User-facing scheduling preferences are included in schema-15 JSON backups. Older schemas remain importable. Legacy `autoRefreshOnLaunch` imports migrate to the new price automation setting.

### Due checks

Automation runs after initialization in two situations:

1. initial application launch;
2. transition from a hidden document to `visibilityState === 'visible'`.

A concurrency guard prevents overlapping checks when multiple lifecycle events occur close together. Each schedule is due when enabled and either no completion timestamp exists or the elapsed time is at least its selected interval.

Price and snapshot due checks are independent. For example, when prices run every 3 hours and snapshots every 6 hours, opening after 4 hours refreshes prices without creating a snapshot.

When a snapshot is due, Worth refreshes prices first even if the price schedule is not independently due, then creates the snapshot. A normally completed price batch, including partial provider failures, is sufficient to proceed; the existing diagnostics record failures. If an unexpected refresh exception prevents normal completion, no snapshot is created and the failed operation is not marked complete.

The price completion timestamp updates after every normally completed automatic refresh attempt. The snapshot completion timestamp updates only after its snapshot is saved. Manual price refreshes and manual snapshots also update their respective completion timestamps so reopening the app does not immediately duplicate the operation.

Automation does not use background timers or service-worker periodic sync because iOS does not guarantee their execution for installed PWAs.

## Dashboard

The quick-action row is removed in full: Position, Update, and Snapshot no longer appear on Home. Their underlying capabilities remain available through Positions, Settings, and History.

Portfolio Allocation remains sorted by absolute position value. Its bar represents all non-zero assets, while the list initially shows the three largest assets. If more rows exist, an accessible `Show N more` control expands or collapses the remainder without changing the bar.

Accounts and Assets become collapsible dashboard sections. Each header always shows its title, entity count, aggregate value, Add action, and expansion state. Both sections start collapsed on a fresh application session. Expanding a section reveals the existing cards and their current nested detail behavior. Expansion is ephemeral UI state and is not synchronized or backed up.

All disclosure controls use real buttons, expose `aria-expanded` and `aria-controls`, and keep a minimum 44-by-44-pixel touch target.

## Positions

The horizontally scrolling account summary strip is removed.

A compact segmented control below the heading selects `By accounts` or `By assets`. The choice persists in local application settings and is included in backups. The default is `By accounts`.

Positions are rendered in groups:

- account grouping: header shows account identity, total value, and position count; rows show asset identity, quantity, value, comment, and menu;
- asset grouping: header shows asset identity, total value, and position count; rows show account identity, quantity, value, comment, and menu.

Groups are ordered by descending absolute total value. Rows inside groups are ordered by descending absolute position value. Groups are expanded by default and can be collapsed for the current session. Existing edit and delete actions remain unchanged.

Empty Positions behavior and the Add button remain unchanged.

## Navigation and responsive behavior

The bottom navigation keeps Home, Positions, and History. Its visual padding, icon size, and label spacing are reduced, while each tab retains a touch target of at least 44 pixels and safe-area inset support. Main-content bottom padding is adjusted to the new bar height.

The layouts must work from 320-pixel mobile width through desktop widths, in portrait and landscape, without horizontal page scrolling. Disclosure and segmented controls must work with touch, keyboard, and assistive technology; no behavior depends on hover.

## Architecture

`PortfolioService` owns persisted automation settings, timestamps, and the operations that update them. A focused launch-automation coordinator evaluates due schedules and serializes lifecycle checks. `main.ts` wires initialization and document visibility events to that coordinator.

Pure presentation helpers build allocation visibility and grouped-position view models so ordering and counts are unit-testable without DOM snapshots. `WorthRenderer` renders those models, and `WorthController` owns disclosure and grouping interactions. Existing repository, price provider, diagnostic log, and snapshot builder boundaries are retained.

## Error handling and diagnostics

Each automation check records whether price refresh and snapshot were due, executed, skipped, or failed. Existing provider diagnostics remain the source of per-provider detail. UI failures continue to use the existing localized error/toast handling.

Missing or invalid interval values normalize to their defaults. Negative, non-finite, or future timestamps are treated as never completed, making the corresponding enabled operation due.

## Compatibility and release

- Product version becomes `3.2.0` and UI/backup version becomes `3.2.0-final`.
- Backup schema becomes 15; schemas 1 through 14 remain importable.
- GitHub Pages base-path behavior and PWA precaching remain supported.
- No server dependency or new runtime package is introduced.

## Verification

Tests cover schedule boundaries, independent timers, snapshot-forced price refresh, partial provider failures, lifecycle concurrency, manual timestamp updates, settings and backup migration, allocation top-three disclosure, both position groupings, accessible disclosure state, compact navigation at mobile widths, and the existing portfolio E2E flow.

Before release, run type checking, linting, formatting, all unit/integration tests, mobile and desktop E2E tests, a GitHub Pages production build, dependency audit, and `git diff --check`.
