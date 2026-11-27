# kekkai

A personal feedspace for deadlines, tasks, and discoveries. React 19 + Vite + ui-sdk, with a restrained shadcn-inspired visual style.

Production: [kekkai-psi.vercel.app](https://kekkai-psi.vercel.app).

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite. Node 22.18 or newer is required.

For friends to sign in and keep their data across devices, see [Vercel + Supabase setup](docs/deployment.md). Set the two values in `.env.example` in an ignored `.env.local` to enable GitHub login and account storage. With neither variable set, local development keeps using browser-only storage.

```sh
npm test
npm run lint
npm run build
npm start
```

`npm start` serves the production build and feed endpoint at `http://127.0.0.1:4173`. `npm run preview` also includes the feed endpoint. The feed needs a running server; uploading `dist/` alone to static hosting cannot provide live Trending data. `HOST` and `PORT` override the production listener.

## Your workspace

Select a date to open its attached agenda, then use **Add deadline**. The deadline form slides over the agenda; saving or cancelling returns to the day. Open a commitment to edit or delete it; deletion offers Undo. Capture tasks directly in the list, or use **New task** for dates and notes. The calendar's daily agenda includes both deadlines and dated tasks. Repository bookmarks are kept in your workspace and marked on feed cards.

Use **Clear completed** below the task progress bar to remove all completed tasks. Undo restores the cleared tasks; open tasks and deadlines are kept.

Typography uses locally served Geist Sans with a larger, consistent text scale. Calendar cells use plain frames and text, with inverted colors for selection. Motion respects the system's reduced-motion setting.

Use the moon button in the header to toggle **Night mode**. The first visit uses your system preference; a manual choice is remembered on this browser. Night mode uses charcoal surfaces, soft text, and muted light calendar selections. The saved theme is applied before the app renders.

Use **Visible / Hidden** beside the GitHub Trending heading to collapse or reopen the feed. Only the compact heading remains when hidden, and feed requests pause. This preference is remembered on this browser.

The two views are Overview, containing both the calendar and to-do list, and GitHub Trending. The compact header keeps the current view, date, and planning actions together. Next-deadline and overdue status appear only when relevant. The storage icon opens backups on every screen, including mobile. Feed controls and the original source link share a single toolbar.

With Supabase configured, planning data and saved entries belong to your signed-in account and save online automatically. Account-scoped local caches keep pending edits during connection failures; conflicting edits from other tabs or devices are rejected with a recovery option. Refresh another device to load the latest version. Without Supabase, data stays in this browser, and concurrent tabs use the last local save.

**Backups & storage** exports JSON and restores backups by merging missing records; existing edits win. Use it to transfer your old browser-only workspace into your account. Unreadable cache data is retained as a recovery copy before replacement. No notifications or time-of-day reminders are included.

## Feed providers

The server fetches the actual [GitHub Trending page](https://github.com/trending), parses its repository cards, and caches each period for 15 minutes. Concurrent requests share one fetch. On upstream failure it can serve the last successful result for up to 24 hours, explicitly marked stale. With no usable result, the interface offers retry and a source link. The cache is in memory and resets when the server restarts. GitHub's HTML is an integration boundary: markup changes may require updating `parseTrending` in `server/feeds.ts`.

To add a source:

1. Add a provider in `server/feeds.ts` returning normalized `FeedEntry` records. IDs must be stable and source-prefixed; links must use HTTPS. Language and star metrics are optional.
2. Add its display metadata to `src/feeds.ts` and render `FeedPanel` with that source. Set `periods: []` for a source without period controls; its provider can ignore the default daily period.
3. Test its parser against a small representative HTML/JSON fixture. The shared cache, failures, saved-entry handling, and card layout remain reusable.

External content is rendered as text; source HTML never enters the page. Feed URLs are fixed in provider code, so users cannot turn the endpoint into an arbitrary URL proxy.

If GitHub is unreachable from the Node process, the feed shows retry and the original source link. A browser's proxy/VPN configuration may differ from the server's network configuration.

See [the first-version plan](docs/plan.md) and [review and verification](docs/review.md).
