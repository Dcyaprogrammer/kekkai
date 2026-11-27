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

## Night mode and task cleanup

Reviewed the changes against `7d7e1d4`, including the previously completed task-input icon fix and Clear completed action. The theme uses explicit light/dark semantic colors rather than a page inversion filter. Header tools stay separate from creation actions, and the calendar selection uses a muted light fill with dark text at night. Popups, forms, status colors, focus rings, and toasts use the same theme tokens.

- `npm test`: exit 0; 45 tests across five files, including initial system theme, persistent manual choices, pre-render theme application, keyboard/agent toggling, blocked storage, and completed-task clearing/Undo.
- `npm run build`, `npm run lint`, and `git diff --check`: exit 0.
- A token-reference self-check passed. Calculated night text contrast exceeds 4.5:1 for the checked body, muted, accent, warning, danger, primary, checked, and selected-calendar pairs; input/calendar edges exceed 3:1. These calculations check declared colors, not every painted state.
- Native Chrome showed the desktop night palette with the calendar, tasks, and live feed. Mobile, popup transitions, and other browsers were not visually rechecked after Chrome switched away from the preview.

No new dependencies or workspace schema changes. Theme preference is browser-local; when storage is blocked, switching still works for the current session.

## Vercel and Supabase setup

Added GitHub login, private account workspaces, revision-checked cloud saves, account-scoped pending-edit caches and recovery, plus a Vercel function reusing the existing Trending middleware. The deployed build requires Supabase settings; unconfigured local development retains browser-only storage. Setup is documented in [deployment.md](./deployment.md).

- `npm test`: exit 0; 69 tests across nine files. New coverage includes auth session races, sign-out, account switching/remounting, retry, conflicts, recovery, explicit import of old browser data, pending edits after reload, expected-account binding, and the Vercel HTTP adapter.
- TypeScript/build, lint, and whitespace checks pass. Cloud builds reject missing/partial settings, secret keys, and non-HTTPS URLs. Vite reports a bundle-size advisory for the configured cloud build (about 689 kB minified / 212 kB gzipped).
- The migration and SQL assertions passed in embedded PostgreSQL (PGlite), then on the hosted Supabase project. Checked anonymous denial, RLS isolation, valid saves, revision conflicts, expected-account binding, and malformed JSON. The migration is applied, and the hosted REST API rejects anonymous reads and saves with HTTP 401. Real GitHub sign-in still awaits provider setup.
- Five deliberate mutations were caught: disconnected login handler, missing account remount, disabled RLS, missing revision check, and missing expected-account check. Mutations ran in temporary copies/databases; repository source was not changed.
- Native Chrome showed the signed-out page with visible keyboard focus on the GitHub button. The signed-in interactions use mocked auth/storage in tests; real OAuth and hosted persistence await account configuration.
- Production deployment is ready at [kekkai-psi.vercel.app](https://kekkai-psi.vercel.app). Unauthenticated HTTP checks returned 200 for the page and the feed endpoint; the latter returned 16 real Trending repositories. Vercel is connected to the GitHub repository for subsequent deployments. Hosted SQL checks left no test users behind; row-level security and all three policies are active.

Not verified: a real GitHub OAuth round trip, mobile login rendering, or another browser. Workspaces load on opening/refreshing; real-time updates and durable feed caching are not included. Browser recovery caches remain after sign-out.
