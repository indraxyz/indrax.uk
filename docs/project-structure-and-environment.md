# Project structure and environment guide

This guide explains the folder layout, server runtime and local configuration
used by this repository. See [architecture](../ARCHITECTURE.md) for request flows,
rendering policy, caching and API boundaries, and [testing](testing.md) for isolated
test configuration.

## Why are `app/` and `admin/` at the project root?

They are the entry points for two applications that share feature and UI modules.
Their placement is intentional; a surrounding `src/` directory is optional.

| Directory     | Role                                                                                       | Configuration                                                       |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `app/`        | Public React Router Framework Mode application, including root layout and SSR entry points | `react-router.config.ts` sets `appDirectory: "app"` and `ssr: true` |
| `app/routes/` | Public route modules, loaders, metadata and their tests                                    | `app/routes.ts` maps URL patterns to these modules                  |
| `admin/`      | Independent React application with browser routing, served under `/admin`                  | `vite.admin.config.ts` sets `root: "admin"` and `base: "/admin/"`   |
| `workers/`    | Cloudflare runtime entry point for both applications and their backend                     | `wrangler.jsonc` sets `main: "workers/app.ts"`                      |

React Router supports configuring the application directory and explicitly
mapping route modules. Keeping our routes in `app/routes/` is a repository
convention rather than a requirement to use filesystem routing.
See [React Router configuration](https://reactrouter.com/api/framework-conventions/react-router.config.ts)
and [route configuration](https://reactrouter.com/api/framework-conventions/routes.ts).

The public application renders profile pages and published articles on the server.
Writing archive results load through the API in the browser. The admin is a
separate browser bundle because its dashboard/editor are private; its backend
still authenticates and authorizes every private operation. Both applications
run behind the same Worker and origin, rather than separate deployed backends.

## Where should new code go?

- Public route composition, loaders and metadata: `app/routes/`.
- Admin route composition: `admin/routes/<area>/`; common admin framing,
  navigation, login controls and request feedback: `admin/components/`.
- Domain behavior and UI: `features/<feature>/`. Writing editor and post-management
  components stay in `features/writing/components/admin/`.
- Shared public layout: `components/layout/`; reusable UI primitives:
  `components/ui/`.
- Global site origin, host and social links: `config/site.ts`. Resume-specific
  wording and options stay in `features/resume/config.ts`.
- Shared infrastructure: `lib/`; writing API handlers and database operations:
  `features/writing/api/` and `features/writing/data/`.
- Build/development runners: `scripts/`. Unit tests normally sit beside the code
  they verify; database integration tests live in `test/integration/`, and browser
  tests in `e2e/`.

Modules handling database connections, authentication, storage credentials and
preview signing use `.server.ts`. Browser components call typed APIs rather than
importing these modules. Pure schemas, types and shared validation can be reused
without bringing database drivers or runtime secrets into a browser bundle.

For this architecture, the useful conventions are clear ownership, shared UI,
and explicit server/browser boundaries. Moving everything into `src/` would also
require updating framework roots, aliases and tooling; it is not needed to make
the current layout valid.

## How is the admin organized as it grows?

The admin root keeps its HTML/browser entry points and explicit URL configuration.
Route modules are grouped by area; shared admin UI and session handling have
separate owners:

```text
admin/
  index.html
  main.tsx
  routes.tsx
  routes/
    auth/login.tsx
    dashboard/overview.tsx
    posts/{list,new,edit}.tsx
  layouts/protected-admin.tsx
  auth/session.tsx
  components/
    auth/{sign-in-button,sign-out-button}.tsx
    layout/{admin-shell,admin-navigation}.tsx
    feedback/request-state.tsx
```

`routes.tsx` declares URLs, lazy route modules and query prefetching. The protected
layout handles browser session refresh/expiry and provides the session context;
server APIs still enforce authorization. The shared session hook lives in
`auth/session.tsx`, while loading/error UI lives in `components/feedback/`.

For a new admin area, add its route modules to `admin/routes/<area>/` and map them
in `admin/routes.tsx`. Keep its domain behavior, API contracts and substantial UI
in `features/<feature>/`, following the existing writing modules. Add admin-wide
UI only when shared across areas. Folder names do not determine URLs, so this
organization preserves `/admin/new` and `/admin/edit/:id` and requires no redirects.

## What does `workers/` do? Can React Router provide the backend?

`workers/app.ts` receives requests and dispatches them to public React Router SSR,
admin assets, authentication, writing/admin APIs, and resource handlers such as
RSS, sitemap, uploads and social images. It also establishes the request context
and applies security headers. SQL, publishing rules and authorization remain in
their respective modules.

React Router Framework Mode already provides server loaders and actions. Workers
is the deployment runtime hosting that framework and our additional handlers.
It does not replace Framework Mode. The explicit dispatcher lets admin assets and
API requests reach their handlers without loading the public SSR tree.

## Is the Cloudflare Vite plugin part of Wrangler?

They are separate packages listed in `package.json`:

- `@cloudflare/vite-plugin` integrates Vite with the Cloudflare runtime and build;
  `vite.config.ts` imports its `cloudflare()` plugin.
- `wrangler` is Cloudflare's CLI, used by this project's preview runner, type
  generation and deployment scripts.
- `@react-router/dev` supplies React Router's Vite plugin and framework tooling.

The [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
provides the runtime integration. Project scripts use the locally installed
packages so development and CI follow the versions in the lockfile.

## Which local environment file do we use?

Use the root `.env.local`, copied from `.env.example`. It configures public Vite
builds, local Worker bindings, preview, seed and Drizzle tooling. It is ignored by
Git; the example contains placeholders rather than private credentials.

Cloudflare supports dotenv files for local bindings. A legacy `.dev.vars` takes
precedence over dotenv loading during development, so migrate its values and
remove it rather than maintaining both. See [Cloudflare local environment
variables](https://developers.cloudflare.com/workers/local-development/environment-variables/).
Its entries remain in `.gitignore` to protect an accidentally recreated file.

`npm run start` explicitly reads the root `.env.local`, even though the generated
Worker configuration lives in `build/server/`. Allowlisted shell overrides take
precedence for test fixtures; temporary override files have restricted permissions
and are removed on exit. Build assembly removes the plugin-generated local secret
copy from the final build.

`NEXT_PUBLIC_*` values are embedded at build time and must contain only public
configuration. Rebuild after changing these values. Backend values are read from
Worker bindings; restart the dev server after changing local configuration.
Deployed environments use their Cloudflare bindings/secrets and build settings,
not the developer's `.env.local` file.

## Is `BETTER_AUTH_URL` the same as the site domain?

In this application it is the origin where authentication runs: scheme, hostname
and optional port, without `/admin` or `/api/auth`. Auth and the site share an
origin. Better Auth uses its base URL for authentication URLs; see
[Better Auth configuration](https://better-auth.com/docs/reference/options).

| Environment                | `BETTER_AUTH_URL`       | GitHub OAuth callback                            |
| -------------------------- | ----------------------- | ------------------------------------------------ |
| Local Vite using localhost | `http://localhost:5173` | `http://localhost:5173/api/auth/callback/github` |
| Local preview on port 3000 | `http://127.0.0.1:3000` | `http://127.0.0.1:3000/api/auth/callback/github` |
| Production                 | `https://indrax.uk`     | `https://indrax.uk/api/auth/callback/github`     |
| Deployed development site  | `https://dev.indrax.uk` | `https://dev.indrax.uk/api/auth/callback/github` |

Use the actual browser host and port if they differ from these examples. Configure
the corresponding callback in the GitHub OAuth App for that environment.
`localhost` and `127.0.0.1` are different origins, as are HTTP/HTTPS and different
ports. Keep the browser URL, auth origin and OAuth callback consistent.

`NEXT_PUBLIC_SITE_URL` controls canonical metadata and absolute public URLs;
`BETTER_AUTH_URL` controls the server authentication origin. They usually match in
deployed environments. Local authentication can use localhost while canonical
metadata still uses the public site origin.

The auth implementation falls back to the configured site URL when
`BETTER_AUTH_URL` is unset. Set it explicitly for local Vite development. The
preview runner instead defaults it to `http://127.0.0.1:<selected-port>`; an explicit
shell `BETTER_AUTH_URL` overrides that preview default.

## Why does the site work with `DIRECT_DATABASE_URL` commented out?

The application and seed use `DATABASE_URL`, which connects through the Neon HTTP
driver. Drizzle migration/studio tooling uses the PostgreSQL wire protocol and
selects `DIRECT_DATABASE_URL`, falling back to `DATABASE_URL` if it is unset.

Our local Compose stack exposes different ports for these protocols:

| Setting               | Local endpoint                 | Consumer                      |
| --------------------- | ------------------------------ | ----------------------------- |
| `DATABASE_URL`        | Neon HTTP proxy on port `4444` | Worker queries and seed       |
| `DIRECT_DATABASE_URL` | PostgreSQL on port `55432`     | Drizzle migrations and Studio |

Commenting out the direct URL does not affect normal page requests. Drizzle may
fail later if its fallback points to the HTTP proxy port. Keep both local URLs
configured against the same database; `.env.example` provides their formats.
No seed is needed solely because configuration files or folders were moved.

Missing application database configuration is also a supported state: profile
pages remain available and writing lists are empty. Missing required auth settings
disables author access. A page loading successfully therefore does not prove that
the database or login is configured. Follow [local setup](../README.md#local-database-and-author-configuration)
for database creation, migrations and seed data, and use the isolated database
described in [testing](testing.md) for tests that write records.
