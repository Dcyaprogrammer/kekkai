# Kekkai: first version

A personal, planning-first workspace with a clean shadcn-inspired interface, using ui-sdk for accessible interactions.

- A month calendar supports selecting dates and creating, editing, completing, and deleting deadlines. Dates are local calendar dates, without a time zone or reminder service.
- A task list supports quick capture, optional due dates, editing, completion, deletion with undo, and open/completed filtering.
- GitHub Trending displays actual repository descriptions, language, total stars, and stars gained for daily and weekly periods. Loading, empty, unavailable, and stale states are explicit. Sources are added in code through a small feed provider boundary.
- Planning data and saved feed entries stay in this browser. JSON export and validated, non-destructive restore provide backups. No accounts or device synchronization in this version.
- Desktop is the primary layout; mobile remains usable. Keyboard navigation, named controls, visible focus, and reduced motion are required.
- Tests cover planning persistence/restore, feed parsing and failure handling, core task/deadline workflows, and ui-sdk agent access. No test seams were agreed during discovery, so tests verify the completed public workflows rather than applying a test-first process.

Visual direction: white (#ffffff), canvas (#fafafa), ink (#18181b), secondary text (#71717a), borders (#e4e4e7), and a restrained violet (#6d4aff) for date selection and deadline markers. System sans typography, a narrow sidebar, spacious left-aligned panels, calendar and tasks side by side, and repository cards below. Avoid a statistics dashboard: the work itself is the overview.

Implementation and review baseline: `55b9ca3` (the initial commit). The existing Vite/ui-sdk setup is included in the first implementation commit. Scope comes from the conversation; there is no external issue tracker.
