# Implementation review

Reviewed against `55b9ca3986ac0aec1c8efad046ecb8349a09d3b2`, including the initial Vite/ui-sdk setup. The review used the staged implementation because these files had not yet been committed. The scope is recorded in [plan.md](./plan.md).

## Standards

Five initial findings were corrected: validating all writes against the workspace schema, making Undo idempotent after restore, returning focus from backups, improving interactive text contrast, and using ui-sdk Progress. The follow-up review found no outstanding violations or blocking regressions.

## Spec

Three initial findings were corrected: restore followed by Undo could duplicate an item, a merge could exceed the readable workspace limit, and backup dismissal could lose keyboard focus. Regression tests cover each case. A second feed source without GitHub metrics or period controls also passes the shared feed interface test. The follow-up review found no outstanding spec findings.

Final findings: Standards 0; Spec 0. No outstanding issue in either axis.

## Verification

- `npm test`: exit 0; 31 tests across five files.
- `npm run build`: exit 0; includes `tsc -b` for app, tests, Vite configuration, and server.
- `npm run lint`: exit 0, no warnings.
- Production HTTP smoke checks: exit 0; built page, invalid feed/period, disallowed method, path traversal, and malformed path.
- Native Chrome preview checked at desktop, 1440px, and 400px widths. Deadline creation, persistence after reload, editing, deletion, modal initial focus, and keyboard dismissal were exercised. Tests cover focus restoration, calendar keyboard selection, task completion, and ui-sdk agent actions.
- Live GitHub Trending was successfully parsed and served with 15 actual repositories. Subsequent fresh requests intermittently failed with `UND_ERR_CONNECT_TIMEOUT` in both development and production. Loading/failure states, retry, and the source link were observed. Cache and stale-result behavior are tested with controlled upstream responses.

Not checked: other browsers, an exhaustive contrast audit across every state, or hosted deployment. Data is browser-local; concurrent editing tabs use the last saved workspace. GitHub HTML changes may require parser maintenance, and live content requires the Node server to reach GitHub.

## Typography and calendar refresh

Reviewed the staged changes against `1388477`, using [ui-refresh.md](./ui-refresh.md) as the spec. The standards review found a short-viewport clipping issue; removing the attachment view's minimum height and respecting available popup height resolved it. The spec review found a rescheduling documentation mismatch, which is corrected. Both follow-up reviews found no remaining blockers.

- `npm test`: exit 0; 36 tests across five files, including attached-agenda selection, draft preservation, focus restoration, rescheduling, task-dialog handoff, and agent access.
- `npm run build`: exit 0, including TypeScript checks and locally bundled Geist font assets.
- `npm run lint`: exit 0.
- Native Chrome confirmed desktop typography/layout, date selection, the attached agenda, and the form transition with initial input focus.

The mobile keyboard and other browsers were not visually rechecked. Native browser controls became unavailable before the mobile check could finish; short-height scrolling was reviewed in code.

## Compact workspace layout

Reviewed the changes against `d755e95`. The layout now uses one workspace header and one feed toolbar, removes decorative copy, and keeps next-deadline/overdue status. Backup access remains available when the mobile sidebar footer is hidden; creation actions are limited to planning views. Storage warnings retain spacing above the workspace panels.

- `npm test`: exit 0; 38 tests across five files. Added navigation/header, feed source link, backup access/focus, and planning-summary checks; existing calendar, task, persistence, and agent tests pass.
- `npm run build`: exit 0, including TypeScript checks.
- `npm run lint` and `git diff --check`: exit 0.

Visual verification was unavailable: the native browser host could not connect. Responsive wrapping and spacing were reviewed in CSS, but desktop/mobile appearance and painted contrast were not checked in a browser for this revision. No dependencies or storage schema changes.
