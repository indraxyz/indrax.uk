# Test suite guide

This guide documents the repository's current test setup, how to run it, and
what its results prove. Configuration and test files are the source of truth.
The inventory below was collected on **8 October 2026**; it is a count of
discovered cases, not a claim that every case ran in a particular test run.
The Worker and database latency regressions below were added on **8 October 2026**.

## Contents

- [Test layers and inventory](#test-layers-and-inventory)
- [Prerequisites](#prerequisites)
- [Running tests](#running-tests)
- [Database and authentication fixtures](#database-and-authentication-fixtures)
- [Browser configuration and ordering](#browser-configuration-and-ordering)
- [Analytics and other test helpers](#analytics-and-other-test-helpers)
- [Reports, PNGs, and traces](#reports-pngs-and-traces)
- [CI gates](#ci-gates)
- [Troubleshooting](#troubleshooting)
- [Adding or changing tests](#adding-or-changing-tests)
- [Coverage limits](#coverage-limits)

## Test layers and inventory

| Layer                           | Tool / configuration                                        | What it checks                                                                   |
| ------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Formatting                      | Prettier, `npm run format:check`                            | Repository formatting                                                            |
| Lint                            | ESLint, [eslint.config.mjs](../eslint.config.mjs)           | Code conventions and framework rules                                             |
| Types                           | TypeScript, [tsconfig.json](../tsconfig.json)               | Compile-time contracts                                                           |
| Unit                            | Vitest, [vitest.config.mts](../vitest.config.mts)           | Functions, validation, rendering, and boundary conditions                        |
| Feature / integration / browser | Playwright, [playwright.config.ts](../playwright.config.ts) | Production pages, HTTP endpoints, database-backed flows, and browser interaction |
| Build                           | Next.js, `npm run build`                                    | Production compilation, route generation, and asset tracing                      |

The SQL/request-budget integration suite uses a separate Vitest configuration
and an explicitly supplied local database. Feature/browser coverage lives in
Playwright. The Vitest auth callback regression also exercises
Better Auth itself, using an isolated in-memory adapter and stubbed GitHub responses;
it does not contact GitHub or PostgreSQL. Some specs use HTTP requests instead of a
page when checking status codes, feeds, images, uploads, or server actions.

### Unit tests: 234 cases in 28 files

Vitest discovers `**/*.test.ts`, excludes `node_modules`, `.next`, `e2e`, and
`test/integration`, and
runs in a Node environment rather than jsdom. The `@` alias resolves to the repo
root. Its `server-only` alias points to
[test/support/server-only.ts](../test/support/server-only.ts), an empty module
used only by the test runner. Application builds still use the real guard.

| File                                                                                 | Cases | Main coverage                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ----: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [content.test.ts](../features/writing/utils/content.test.ts)                         |    26 | Sanitization, safe links/images, heading levels and IDs, accessible markup, table of contents, plain text, excerpts                           |
| [content-runtime.test.ts](../features/writing/utils/content-runtime.test.ts)         |     1 | Cold code highlighting without runtime WebAssembly compilation (TypeScript, PHP, SQL)                                                         |
| [preview-token.test.ts](../features/writing/utils/preview-token.test.ts)             |    11 | Signing, verification, wrong slugs, tampering, expiry boundaries, malformed tokens                                                            |
| [reading-time.test.ts](../features/writing/utils/reading-time.test.ts)               |     4 | Minimum duration, rounding, length, integer results                                                                                           |
| [slug.test.ts](../features/writing/utils/slug.test.ts)                               |    13 | Normalization, accents, punctuation, slug patterns, collision suffixes                                                                        |
| [search-query.test.ts](../features/writing/utils/search-query.test.ts)               |     7 | Empty queries, whitespace normalization, length limits, punctuation                                                                           |
| [db-errors.test.ts](../features/writing/data/db-errors.test.ts)                      |     8 | Recognizing the series-order uniqueness constraint through raw and nested driver errors                                                       |
| [writing.test.ts](../lib/validators/writing.test.ts)                                 |    15 | IDs, slugs, post input, invalid fields and authoring constraints                                                                              |
| [analytics-host.test.ts](../lib/analytics-host.test.ts)                              |     9 | Analytics origins, invalid schemes/input, CSP injection prevention, regional asset hosts                                                      |
| [observability.test.ts](../lib/observability.test.ts)                                |    12 | Structured logs, digest/context/stack handling, aborted requests, real failures                                                               |
| [media.test.ts](../lib/utils/media.test.ts)                                          |     7 | HTTPS media origin allowlist, userinfo and host tricks, invalid URLs                                                                          |
| [cover-storage.test.ts](../lib/cover-storage.test.ts)                                |    15 | Cover configuration completeness, blank credentials and invalid media origins                                                                 |
| [auth.test.ts](../lib/auth.test.ts)                                                  |     3 | Real Better Auth callbacks with an isolated memory adapter: rejected/missing identity creates no rows or session; authorised control succeeds |
| [site-updated-at.test.ts](../config/site-updated-at.test.ts)                         |     7 | Revision metadata, explicit overrides, valid leap dates, invalid dates, missing Git                                                           |
| [content-performance.test.ts](../features/writing/utils/content-performance.test.ts) |     4 | Lazy highlighting, ordinary and annotated inline code, highlighter reuse                                                                      |
| [plain-text.test.ts](../features/writing/utils/plain-text.test.ts)                   |     2 | Lightweight extraction and reuse of text for excerpts                                                                                         |
| [mutations.test.ts](../features/writing/data/mutations.test.ts)                      |    18 | Save validation, unchanged/changed tags, batching, series upserts, conflicts, and invalidation                                                |
| [post-form.test.ts](../features/writing/components/admin/post-form.test.ts)          |     3 | Save failure, existing-post save without redundant navigation, one navigation for creation                                                    |
| [navigation-prefetch.test.ts](../components/navigation-prefetch.test.ts)             |     2 | Public and admin links without speculative prefetch                                                                                           |
| [page.test.ts](../app/writing/tags/[tag]/page.test.ts)                               |     6 | Tag request rendering, pagination, canonical metadata, missing-tag behavior                                                                   |
| [rendered-article.test.ts](../features/writing/data/rendered-article.test.ts)        |     6 | Real Next cache with isolated storage: reuse, saved revisions, slug invalidation, draft isolation                                             |
| [worker-cache.test.ts](../config/worker-cache.test.ts)                               |     2 | Adapter cache configuration and dev/production binding separation                                                                             |
| [worker-cache-preflight.test.ts](../config/worker-cache-preflight.test.ts)           |     5 | Release checks for missing bindings and environment selection                                                                                 |
| [queries.test.ts](../features/writing/data/queries.test.ts)                          |    18 | Public SQL projections, pagination, request batching, visibility, and fallback behavior                                                       |
| [admin-queries.test.ts](../features/writing/data/admin-queries.test.ts)              |     9 | Relational admin reads, tags/series, minimal projections, and authorization                                                                   |
| [brand-fonts.test.ts](../lib/og/brand-fonts.test.ts)                                 |     3 | Reused local/HTTP font bytes, in-flight sharing, and retry after transient failure                                                            |
| [post-actions.test.ts](../features/writing/components/admin/post-actions.test.ts)    |     6 | Status updates and deletion without redundant refresh, cancellation, and failures                                                             |
| [auth-guard.test.ts](../lib/auth-guard.test.ts)                                      |    11 | Request-scoped memoization, request isolation, expiry, revocation, and author allowlist                                                       |

### Database integration tests: 13 cases in 1 file

`npm run test:integration` uses
[vitest.integration.config.mts](../vitest.integration.config.mts) and
[database-latency.test.ts](../test/integration/database-latency.test.ts). It requires
`TEST_DATABASE_URL` pointing to an isolated loopback Postgres/Neon HTTP stack.
There is no remote database fallback. Tests verify actual SQL results, HTTP
request budgets, pagination, draft isolation, post/tag atomicity, and series
metadata behavior. CI runs it after migrations/seed, before browser tests.
See [Neon latency optimization](neon-latency-optimization.md) for the command and
the distinction between SQL tests and authorization/browser coverage.

### E2E tests: 153 cases in 18 files

The `reads` project discovers 132 cases; `writes` discovers 21. Counts include
parameterized accessibility cases and cases that can skip at runtime. A test
that loops through several routes or viewports is still one discovered case.

| File                                                          | Project | Cases | Main coverage                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [accessibility.spec.ts](../e2e/accessibility.spec.ts)         | reads   |    24 | Axe scans across 12 public/sign-in routes in light and dark themes                                                                                                                                                                                                                                             |
| [admin-boundary.spec.ts](../e2e/admin-boundary.spec.ts)       | reads   |     8 | Signed-out redirects, no admin content, noindex, upload rejection, forged/direct server actions, no unauthorized writes/session                                                                                                                                                                                |
| [analytics.spec.ts](../e2e/analytics.spec.ts)                 | reads   |    14 | Pageviews, downloads/contact events, consent, withdrawal/regrant/reload, tracking refusal, tracker failure, preview-token privacy                                                                                                                                                                              |
| [breadcrumb.spec.ts](../e2e/breadcrumb.spec.ts)               | reads   |     3 | Current page semantics, ancestor links, keyboard navigation, mobile bounds, JSON-LD alignment, sign-in return path                                                                                                                                                                                             |
| [contact-links.spec.ts](../e2e/contact-links.spec.ts)         | reads   |     5 | Sheet behavior and focus restoration on mobile/desktop, email, safe external profiles, keyboard access, avoiding duplicate GitHub controls                                                                                                                                                                     |
| [resume-pdf.spec.ts](../e2e/resume-pdf.spec.ts)               | reads   |     2 | Real PDF download, filename/header/size, embedded fonts/photo, lazy renderer loading                                                                                                                                                                                                                           |
| [smoke.spec.ts](../e2e/smoke.spec.ts)                         | reads   |    15 | Portfolio repository links, structured details, hover contrast in both themes, home/resume/Stack framing, architecture/tool choices/card ordering/source links, consistent writing spacing, navigation, mobile actions/search, delivery diagram, keyboard scrolling, mobile timeline height, print             |
| [social-card.spec.ts](../e2e/social-card.spec.ts)             | reads   |     4 | Profile PNG dimensions, Open Graph/Twitter metadata and absolute URLs                                                                                                                                                                                                                                          |
| [structured-data.spec.ts](../e2e/structured-data.spec.ts)     | reads   |     4 | Person/profile JSON-LD, name/role/profiles, withholding personal phone/birth details                                                                                                                                                                                                                           |
| [writing-content.spec.ts](../e2e/writing-content.spec.ts)     | reads   |    19 | Seeded content, tag layout, article rendering/code/tasks, no-JS reading, draft isolation, canonicals, JSON-LD, OG cards, responsive grids, related posts, views, copy buttons                                                                                                                                  |
| [writing-search.spec.ts](../e2e/writing-search.spec.ts)       | reads   |    10 | Body/title search, ranking, draft exclusion, noindex, empty/missing results, query limits, punctuation, no-JS forms, pagination                                                                                                                                                                                |
| [writing-series.spec.ts](../e2e/writing-series.spec.ts)       | reads   |     7 | Published reading order, draft exclusion, unknown series, part navigation, sitemap/indexability, no-JS reading                                                                                                                                                                                                 |
| [writing.spec.ts](../e2e/writing.spec.ts)                     | reads   |     8 | Archive, unknown article/tag 404s, RSS, permanent legacy redirects with queries, feed discovery, sitemap/robots, security headers                                                                                                                                                                              |
| [admin-authoring.spec.ts](../e2e/admin-authoring.spec.ts)     | writes  |    14 | Admin breadcrumbs, listing/draft creation, table actions and persistence, sticky formatting on desktop/mobile, cover availability and cover preservation, public isolation, signed preview, publish/edit/revisit/unpublish with a new tag after build and pagination canonicals, series clash feedback, delete |
| [footer.spec.ts](../e2e/footer.spec.ts)                       | reads   |     1 | Built revision date across public footers, profile JSON-LD and root sitemap entries                                                                                                                                                                                                                            |
| [admin-login.spec.ts](../e2e/admin-login.spec.ts)             | reads   |     6 | Denied/expired/cancelled sign-in, safe error copy, retry/home navigation, OAuth callback redirects, mobile preferences without protected navigation                                                                                                                                                            |
| [admin-session.spec.ts](../e2e/admin-session.spec.ts)         | writes  |     8 | Author allowlist, OAuth state cookie attributes, session age, logout/replay rejection, uploads, responsive drawer navigation, theme sync, focus, and sign-out confirmation                                                                                                                                     |
| [worker-navigation.spec.ts](../e2e/worker-navigation.spec.ts) | reads   |     1 | No speculative prefetch on hover; normal public link navigation remains functional                                                                                                                                                                                                                             |

Accessibility scans use WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA tags. They fail on
`serious` or `critical` violations. They do not assert that every lesser-impact
finding is absent, and automated scans do not replace manual accessibility review.

Refresh the inventory without executing test bodies:

```bash
npx vitest list
npx playwright test --list
```

## Prerequisites

- Run commands from the repository root.
- CI uses Node.js 24. `package.json` declares npm 11.6.0 as its package manager.
- Install the lockfile dependencies with `npm ci`.
- Browser tests need Playwright Chromium and its system libraries:

```bash
npx playwright install --with-deps chromium
```

Docker Compose is required for the documented complete local database setup.
Ports 4444 (Neon HTTP proxy), 55432 (Postgres), and 3210 (test site) must be
available for the default setup. `E2E_PORT` changes the test-site port.

## Running tests

### Fast local gate

```bash
npm run check
```

This runs formatting, lint, type checking, and all unit tests in that order,
stopping at the first failure. It does **not** run E2E or a production build.

```bash
npm run test
npm run test:watch
npm run test -- features/writing/utils/preview-token.test.ts
npm run test -- -t "expiry boundary"
npm run build
```

Watch mode is for local iteration; the one-shot commands are suitable for gates.

### Browser smoke checks without a database

Export empty values explicitly so Next.js does not use credentials from a local
environment file. This run intentionally excludes seeded-content and signed-in
authoring coverage:

```bash
DATABASE_URL='' BETTER_AUTH_SECRET='' ALLOWED_GITHUB_ID='' \
GITHUB_CLIENT_ID='' GITHUB_CLIENT_SECRET='' \
npm run test:e2e -- e2e/smoke.spec.ts --project=reads
```

The runner normally builds and starts the app itself. Do not point it at an
already running development server and assume it is the same production build.

### Complete suite with a disposable database

Use a separate Compose project so its database volume is distinct from normal
development. The project still uses the ports in `docker-compose.yml`; stop any
existing stack occupying those ports first. These commands create only test
identities/data and use dummy OAuth values:

```bash
docker compose -p indrax-e2e up -d --wait

export DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require'
export DIRECT_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:55432/indrax'
export BETTER_AUTH_SECRET='ci-only-secret-for-an-ephemeral-database-0000'
export ALLOWED_GITHUB_ID='1'
export GITHUB_CLIENT_ID='ci-only'
export GITHUB_CLIENT_SECRET='ci-only'
export R2_ACCOUNT_ID='' R2_ACCESS_KEY_ID='' R2_SECRET_ACCESS_KEY='' R2_BUCKET=''
export NEXT_PUBLIC_MEDIA_ORIGIN=''

npm run db:migrate
npm run db:seed
npm run clean
npm run test:e2e
```

`npm run clean` clears `.next` and `out`. Stop servers using that build before
running it. A fresh build avoids cached empty/archive results from another
database configuration. Do not rebuild/clean while another suite is running.

After reading the results, remove only the disposable project and its volumes:

```bash
docker compose -p indrax-e2e down --volumes
unset DATABASE_URL DIRECT_DATABASE_URL BETTER_AUTH_SECRET ALLOWED_GITHUB_ID
unset GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
unset R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET NEXT_PUBLIC_MEDIA_ORIGIN
```

An interrupted authoring run can leave its temporary post behind. A fresh test
volume restores a predictable fixture set; rerunning the seed is not a full reset.

Cover availability tests exercise both configurations. The disposable setup above
runs the unavailable-storage and preservation cases. To verify enabled controls,
rebuild with dummy `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, and `NEXT_PUBLIC_MEDIA_ORIGIN=https://media.example.com`, then run
`admin-authoring.spec.ts --project=writes --no-deps --grep "enables cover controls"`.
That test checks enabled controls without contacting an R2 bucket. Never use
live storage credentials for this test.

### Targeted browser commands

```bash
# One read spec or a named behavior
npm run test:e2e -- e2e/breadcrumb.spec.ts --project=reads
npm run test:e2e -- e2e/smoke.spec.ts --project=reads --grep "experience timeline"

# Analytics requests are intercepted, not sent to a real dashboard
npm run test:e2e -- e2e/analytics.spec.ts --project=reads

# Run the read project only
npm run test:e2e -- --project=reads

# Run writes and their read-project dependency
npm run test:e2e -- --project=writes

# Targeted write debugging after prerequisites/read checks have been verified
npm run test:e2e -- --project=writes --no-deps --workers=1

# Reduce resource use, change the port, or inspect behavior live
npm run test:e2e -- --workers=2
E2E_PORT=3420 npm run test:e2e
npm run test:e2e:ui
npm run test:e2e -- e2e/smoke.spec.ts --project=reads --headed
npm run test:e2e -- e2e/smoke.spec.ts --project=reads --debug
```

`--no-deps` bypasses the ordering gate; use it for focused debugging, not as the
complete verification command. Targeted project selection can pull in dependency
tests too; `--list` shows what the command will discover before it runs.

## Database and authentication fixtures

### Environment contract

| Variable                                   | Consumer / purpose                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                             | App, seed, and E2E session helper; local loopback URL through the Neon proxy |
| `DIRECT_DATABASE_URL`                      | Drizzle migrations, using Postgres directly rather than the HTTP proxy       |
| `BETTER_AUTH_SECRET`                       | Signs test-session cookies and preview tokens; must match the running app    |
| `ALLOWED_GITHUB_ID`                        | Author allowlist and default fixture identity                                |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Enable auth configuration; dummy values suffice for fixture-session flows    |
| `E2E_PORT`                                 | Defaults to 3210; determines `http://127.0.0.1:<port>`                       |
| `PLAYWRIGHT_CHANNEL`                       | Optional installed browser channel, such as `chrome`                         |
| `E2E_SCREENSHOTS`                          | Set to `on` to keep passing-test PNGs too                                    |

The Playwright server configuration sets `BETTER_AUTH_URL` to its test origin
when a secret is supplied. This lets the logout Origin check use the actual test
site. It also sets a dummy PostHog key/host at build time. These are injected by
the runner; a real analytics project or GitHub OAuth secret is not required.

Next.js loads local environment files for the app. DB tooling loads `.env.local`
and `.env` through [dev-env.ts](../lib/db/dev-env.ts). The Playwright test process
does not automatically load those files for its skip checks/session helper.
Export the required variables into the shell; configuring the app alone is not
enough. Exported variables also avoid accidentally using a normal Neon connection
stored in `.env.local` when running the documented disposable setup.

### Skip conditions

| Cases                                            | Skip condition                                   |
| ------------------------------------------------ | ------------------------------------------------ |
| Writing content, search, series suites           | No `DATABASE_URL`                                |
| Admin authoring and session suites               | No `DATABASE_URL` or no `BETTER_AUTH_SECRET`     |
| Dynamic article/tag/series breadcrumb case       | No `DATABASE_URL`                                |
| Sign-in breadcrumb case                          | No `BETTER_AUTH_SECRET` or no `GITHUB_CLIENT_ID` |
| OAuth state-cookie case inside the session suite | No GitHub client ID or secret                    |

The skip conditions are not a complete readiness check. A supplied URL can still
point at an unseeded/unmigrated database; signed-in tests also require a valid
allowlist and matching app configuration. A passing result with skipped cases
does not verify those omitted flows.

### Seeded content

[seed.ts](../lib/db/seed.ts) validates fixture input with the same schema as
authoring and inserts/updates fixtures by their slugs. It does not erase unrelated
posts. [constants.ts](../e2e/support/constants.ts) centralizes fixture references.

| Fixture                                            | State     | Series order |
| -------------------------------------------------- | --------- | -----------: |
| `rendering-an-article-without-shipping-a-renderer` | Published |            1 |
| `a-database-that-is-allowed-to-be-absent`          | Published |            2 |
| `notes-on-preview-tokens`                          | Draft     |            3 |

The seed includes six tags and the `building-this-site` series. Only two parts
are public, so tests can prove the draft is excluded from navigation/counts.
An empty database must be migrated before seeding. CI applies the migration
chain to a fresh database; there is no separate migration-test runner.

### Signed-in sessions and cleanup

[session.ts](../e2e/support/session.ts) provisions a unique test author through
Better Auth's internal adapter, creates a real session, and signs its cookie.
Tests can substitute the GitHub ID or backdate session creation to exercise
allowlist and absolute-age boundaries. The production cookie name is
`__Secure-better-auth.session_token`.

The helper refuses non-loopback database hosts. Authoring creates/publishes/
unpublishes/deletes a temporary post; hooks remove minted users, whose sessions
and accounts cascade on deletion. This protects ordinary test runs but does not
make interrupted runs transactional. Use a disposable database, not staging or
production. The read project also makes view-count requests and isolated OAuth state records, so “reads” does not
mean zero database writes. OAuth cancellation tests do not create users or sessions.

## Browser configuration and ordering

- The default browser is Playwright's bundled Chromium using Desktop Chrome
  settings. Mobile checks resize its viewport; they are not physical-device tests.
- `PLAYWRIGHT_CHANNEL=chrome` can use an installed Chrome on systems where bundled
  Chromium cannot run. This is an override, not another browser project.
- The server command is `npm run build` followed by `npm run start` on the test
  port. Production bundling and secure auth-cookie behavior matter here. The
  profile OG image is generated through Next's image route; the resume PDF is
  generated in the browser on download, not during the build.
- Startup timeout is five minutes. No custom global per-test timeout is set.
- `reads` uses full parallelism. `writes` depends on `reads` and disables full
  parallelism within its files; authoring additionally uses a serial test group
  because its cases share one post. Separate files can still run in different
  workers: the project does not configure a single-worker cap. Use `--workers=1`
  for fully sequential write debugging.
- Local retries are zero; CI retries failing tests up to twice. CI forbids
  committed `test.only`. Inspect retry/flaky results rather than treating a
  recovered retry as evidence the first run passed.
- Locally, an existing server at the test origin can be reused. CI does not reuse
  one. Reuse skips the build/start command, so confirm the server's environment
  and build match the test run or stop it first.

## Analytics and other test helpers

[analytics.ts](../e2e/support/analytics.ts) sets consent before navigation and
intercepts requests to `https://posthog.e2e.invalid`. The build uses
`phc_e2e_dummy_key`. Payload decoding handles plain, compressed, form-wrapped,
and base64 bodies so assertions can inspect event names and sensitive data.
The helper removes automation indicators in the test browser because PostHog
otherwise suppresses headless events. The production SDK configuration is not
weakened for tests.

These checks verify outbound event behavior and consent, not delivery to a
real PostHog dashboard, dashboard session calculations, or replay ingestion.

[hydration.ts](../e2e/support/hydration.ts) waits for the consent UI/control as a
signal that React effects have run before interacting with hydrated download
controls. Server-rendered markup can be visible before click handlers are ready.

PDF tests check the `%PDF-` header, filename, minimum size, font names, image
encoding, and lazy-loading behavior. OG image tests check PNG headers/dimensions.
Neither is a pixel-diff baseline test.

## Reports, PNGs, and traces

| Output        | Current setting / location                                     |
| ------------- | -------------------------------------------------------------- |
| Console       | List reporter locally; GitHub annotations in CI                |
| HTML          | Every run, `playwright-report/`; never opens automatically     |
| PNG           | Browser-test failures by default, under `test-results/`        |
| Passing PNG   | Enable with `E2E_SCREENSHOTS=on`                               |
| Trace ZIP     | `retain-on-failure`, including first-attempt local failures    |
| Error context | Playwright can add a page snapshot/context file on failure     |
| Video         | Not configured                                                 |
| Vitest        | Console summary by default; no configured coverage/HTML report |

```bash
npx playwright show-report
E2E_SCREENSHOTS=on npm run test:e2e
npx playwright show-trace test-results/<case-directory>/trace.zip
```

Replace the trace placeholder with the path from the failed test's output. The
HTML report links to available attachments. A screenshot is a captured browser
frame, not an image for each action/route in a loop. Request-only tests have no
page to screenshot. Trace Viewer is useful for action timing, DOM snapshots,
network requests, and console output.

Report directories are Git-ignored, and later runs can replace their contents.
Copy both the report and test-results directories elsewhere before another run
if evidence must be retained. `E2E_SCREENSHOTS=on` captures successful pages too,
but does not enable visual regression assertions. Those would require reviewed
image baselines and explicit screenshot comparison tests.

## CI gates

[ci.yml](../.github/workflows/ci.yml) runs on pull requests and pushes to `main`
and `develop`. New runs supersede older runs for the same Git ref.

| Job     | Steps                                                                                                                             | Result                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `check` | Node 24, `npm ci`, `npm run check`, production build without a DB, audit                                                          | Formatting/types/unit/build gate; audit reports findings but is non-blocking |
| `e2e`   | Node 24, dependencies, Compose DB/proxy, migrations/seed, SQL integration suite, Chromium/system libraries, full Playwright suite | Real fixture-backed E2E gate                                                 |

The jobs run in parallel with 15- and 30-minute limits respectively. Chromium is
cached by lockfile hash; system dependencies are installed even on a cache hit.
CI uses dummy database/auth credentials, not a real GitHub OAuth application.
On failure it uploads `playwright-report/` and `test-results/` as
`playwright-report-<run_id>`, retained for 14 days. Successful-run artifacts are
not uploaded by the current workflow.

Deployment depends on both jobs and has separate branch/environment controls.
Passing checks alone do not authorize a manual deploy. No Git pre-commit hook is
configured in the repository; run the local gate explicitly before committing.

## Troubleshooting

| Symptom                                                        | Check / next step                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Database/auth specs are skipped                                | Export variables into the test process; review the skip table and report                                                        |
| Seeded tags, home Writing links, or sitemap entries are absent | Confirm fixture DB/seed and app environment; stop the test server, run `npm run clean`, then rebuild                            |
| Wrong content after changing a connection                      | Next cache entries can survive builds; use a fresh build and the same DB for build and runtime                                  |
| Proxy says `fetch failed`                                      | Check Compose health, port 4444, HTTP proxy logs, and loopback URL; migrations use port 55432                                   |
| Port is occupied                                               | Stop the conflicting server, or use `E2E_PORT=3420`; a different Compose project does not change its published DB ports         |
| Signed-in tests redirect to login                              | Check secret/allowlist/GitHub placeholders, fixture cookie, app production mode, and that DB hosts are loopback                 |
| Logout leaves a session                                        | Verify the app's auth URL/allowed Origin matches `E2E_BASE_URL`; do not bypass the assertion                                    |
| Chromium cannot launch                                         | Run browser/system dependency installation; use the installed Chrome channel if appropriate                                     |
| A control is visible but its click does nothing                | Check hydration; use the existing helper for the relevant interaction rather than arbitrary sleeps                              |
| Analytics sees no events                                       | Use the analytics helper before navigation; inspect consent, dummy-host interception, and decoded payloads                      |
| Analytics assertion races with a flags request                 | Poll for the expected event in recorded payloads, not just a larger request count                                               |
| A list/link selector matches breadcrumbs too                   | Scope it to the intended navigation/list/section rather than selecting all page links                                           |
| No failure PNG or trace                                        | Confirm this run uses the current config, has a browser page, and check `test-results/`; an old report can describe another run |
| Slow/flaky run on a busy laptop                                | Lower `--workers`, inspect traces and hydration, and rerun the affected case; do not increase every timeout by default          |
| Only a serial authoring suffix was run                         | Earlier cases create its shared post; run the authoring spec/group as a whole                                                   |

Use `docker compose -p indrax-e2e logs postgres neon-proxy` to inspect the
disposable database services. Do not paste real credentials, auth cookies,
preview tokens, or private draft screenshots into public issues.

## Adding or changing tests

1. Put deterministic logic coverage beside its module as `.test.ts`; use the
   actual implementation and assert meaningful boundaries, not implementation
   details copied into the test.
2. Put SQL/transaction/request-budget checks in `test/integration/*.test.ts` and
   application request/browser behavior in `e2e/*.spec.ts`. Prefer role/label
   locators, scope them to the feature, and use Playwright's web-first assertions.
3. Reuse fixture constants, signed-session helpers, analytics interception, and
   hydration helpers. Keep identities unique and close custom contexts/clean up
   fixture users. Do not add application-only test login endpoints.
4. If a new spec mutates shared content, include it in the `writes` project's
   `testMatch` **and** the `reads` project's `testIgnore`. Shared lifecycle cases
   must be serial, or isolated so parallel runs cannot alter their expectations.
5. Update fixture names and their constants together; refresh seed data only in
   the intended test DB. Cover unpublished data isolation when changing public
   reads or preview behavior.
6. For layout changes, assert useful viewport bounds/scroll behavior and check
   keyboard access, mobile widths, desktop, and print where relevant. For new
   public entry routes, consider the Axe route list and metadata/canonicals.
7. Run the focused test, the fast gate, and affected integration flows. Read the
   report for skipped/flaky cases. Refresh this inventory when files/counts,
   configuration, fixtures, or CI behavior change.

## Coverage limits

The current suite is useful regression coverage, with these explicit limits:

- No configured statement/branch coverage percentage or coverage threshold. Test
  counts are not a coverage metric. No separate component-test/jsdom suite.
- No Firefox/WebKit projects or physical mobile-device execution.
- No image-baseline visual regression, video recording, PDF page-layout diff, or
  manual keyboard/screen-reader audit automated by the suite.
- No live GitHub OAuth round trip. The state-cookie request and post-auth session
  boundary are tested; real callback/provider/domain behavior still needs a
  deployment check.
- No real PostHog ingestion/dashboard/session/replay verification.
- Upload authorization/input constraints are covered; a real R2 upload/download
  integration is not. Do not supply production R2 credentials to this suite.
- The default E2E runtime is Node `next start`, not Cloudflare Workerd. Prior
  local Worker checks do not become a permanent CI test merely because they ran
  once. `npm run preview` builds/starts the Worker for separate local verification;
  it is not a substitute for an automated Worker test project.
- No staging/production smoke job, load test, or guarantee of vulnerability
  discovery. Audit findings currently do not block CI.

For release review, record which command/environment ran, whether cases were
skipped or retried, which runtime/browser was used, and where evidence is kept.
A green smoke subset, a complete fixture-backed suite, and a Worker runtime
check establish different things and should be reported separately.
