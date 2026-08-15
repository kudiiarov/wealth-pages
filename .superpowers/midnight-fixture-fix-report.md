# Midnight fixture fix report

## Change

Updated `tests/e2e/portfolio.spec.ts` so the `today-is-not-a-baseline` snapshot uses the captured `currentTime` directly for `createdAt`.

This keeps the fixture on the current local calendar day while remaining earlier than the renderer's later current point. At local midnight, subtracting one hour could move the snapshot into the previous day and cause daily compaction to remove the intended 24-hour baseline; production behavior remains unchanged.

## Verification

- Focused E2E: 2 passed (desktop Chromium and mobile Chromium).
- Full E2E: 34 passed (desktop Chromium and mobile Chromium).
- `git diff --check`: passed.

The repository environment did not provide `npm`; tests were run with the installed Bun runtime and a temporary `npm` compatibility shim because the Playwright web-server configuration invokes `npm`.

## Self-review

The fixture captures `Date.now()` before reload and passes that value into the page evaluation. The renderer's current point occurs after reload, so the snapshot remains earlier than that point, while its local date is stable across the midnight boundary that caused the failure.
