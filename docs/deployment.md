# Deploy with Vercel and Supabase

The app uses GitHub sign-in and one private workspace per Supabase account. Vercel hosts the Vite app and `/api/feeds/github-trending`. There is no separate server to maintain.

## 1. Create the Supabase project

Create a project in the [Supabase dashboard](https://supabase.com/dashboard). Keep the database password in your password manager; the app does not need it.

From the project's **Connect** dialog, copy the Project URL and **publishable** API key. Create an ignored `.env.local` in the repository:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Use the `sb_publishable_` key. Vite ships these values to browsers; never put a database password, `sb_secret_` key, service-role key, or GitHub client secret in a `VITE_` variable. [Supabase key reference](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Create the workspace table and policies

Open the project's **SQL Editor**. Run the complete contents of [the migration](../supabase/migrations/202611270001_workspaces.sql) once. It creates the table, enables row-level security, and installs the revision-checked save function. The migration is transactional; an error rolls it back.

In a development project, [the SQL checks](../supabase/tests/workspaces.sql) verify account isolation, anonymous denial, account-bound saves, stale-write rejection, and malformed data rejection. Run as the database owner; fixtures roll back.

## 3. Deploy the GitHub repository on Vercel

In [Vercel New Project](https://vercel.com/new), import `Dcyaprogrammer/kekkai`. Use the repository root and Vite preset; build/output settings are already in `vercel.json`.

Add the same two variables from `.env.local` to the Vercel **Production** environment before deploying. Set them for Preview too if using preview deployments. Vercel builds intentionally fail if either is missing or the key is not publishable, so an unconfigured deployment cannot silently store friends' data only in their browsers.

Deploy `main`. Copy the stable production URL, such as `https://kekkai-example.vercel.app`. Later pushes to `main` redeploy automatically with the Vercel Git integration. [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Enable GitHub sign-in

In Supabase **Authentication → Sign In / Providers → GitHub**, copy the callback URL. It has this form:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Create a [GitHub OAuth App](https://github.com/settings/applications/new):

- Application name: `Kekkai`.
- Homepage URL: the stable production URL from step 3.
- Authorization callback URL: the **Supabase callback URL** above.
- Leave Device Flow off.

Copy the Client ID and generate a Client Secret. Enter both directly into Supabase's GitHub provider settings, enable the provider, and save. The secret stays in Supabase and GitHub. [Supabase's GitHub setup guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

## 5. Allow the production redirect and verify

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the stable production URL.
- Add that exact URL with a trailing `/` to **Redirect URLs**.
- Keep the localhost redirect if you want local development. Add preview URLs individually when testing sign-in there.

For optional local development, add `http://localhost:5173/` to Redirect URLs and run `npm run dev` on that exact port. The GitHub OAuth callback remains the Supabase callback for both local and deployed usage.

Open the stable production URL in a private browser window. Verify:

1. GitHub sign-in returns to Kekkai.
2. Create a task and a deadline; wait for **Saved online**. Refresh and check both remain.
3. Sign in to the same account on another device and check the data loads.
4. Sign in with a different GitHub account and check its workspace starts empty.
5. Open GitHub Trending and check repository cards appear. The endpoint should return JSON at `/api/feeds/github-trending?period=daily`.

Share the stable production URL. If Vercel authentication intercepts it, review the project's Deployment Protection settings; friends should reach Kekkai's GitHub sign-in page. [Vercel deployment protection](https://vercel.com/docs/deployment-protection).

## Existing data and save behavior

Before leaving your old local app, use **Backups & storage → Export JSON**. Sign in on the deployed site and restore that file. If you enable Supabase on the same browser and origin as your old workspace, **Import browser data** in Backups can merge it directly. Both paths merge missing IDs; existing records in the signed-in account win. Browser-only data is never automatically imported, and the original local copy is kept.

Changes save automatically. Account-scoped browser caches retain pending edits if a connection fails; use **Retry** when online again. Wait for **Saved online** before expecting changes on another device. Other devices load the latest workspace when opened or refreshed; live updates are not included.

When two devices edit an older version, the later save is rejected instead of silently overwriting data. Export JSON to preserve local edits, then choose **Load online version**. A recovery copy is saved before replacement. Restoring your JSON merges missing records; conflicting edits to the same record need to be reapplied manually.

Sign out on shared computers. Signing out hides the workspace and ends that browser's session; account caches remain in browser storage for recovery. This does not provide encryption against someone with access to the browser profile.

Without Supabase variables, local development uses the original browser-only workspace. Theme preference stays local in either mode. The GitHub feed cache is per warm Vercel function instance and can reset between invocations; no durable feed cache is configured.
