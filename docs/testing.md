# Test suite guide

The application now builds React Router 8.4.0 public SSR and a separate CSR admin.
The browser suite serves production artifacts in **Wrangler/Workerd**, not a Next.js
Node server. Counts change as the migration adds coverage; use runner output for
current totals rather than treating historical counts as current results.

## Test layers

| Layer                 | Command                    | Boundary                                                           |
| --------------------- | -------------------------- | ------------------------------------------------------------------ |
| Formatting/lint/types | `npm run check`            | Formatting, ESLint, route type generation and TypeScript           |
| Unit                  | `npm run test`             | Pure logic, query transport mapping, auth, cache and API contracts |
| Real SQL integration  | `npm run test:integration` | Actual Neon HTTP/Drizzle SQL, round-trip budgets and rollback      |
| Browser/HTTP          | `npm run test:e2e`         | Built public/admin apps and resource/API behavior in Workerd       |
| Packaging             | `npm run build`            | SSR Worker, independent admin assets and generated Wrangler config |

Unit coverage lives beside modules. Key areas include writing validators, slug and
search normalization, excerpts/reading time, sanitized rendering/lazy highlighting,
preview signatures, public query projections and published filters, guarded admin
queries, batch mutations, per-request auth, KV/D1 invalidation, API Origin/size/auth
boundaries, metadata/resource responses and shared utilities. Query tests mock only
external transport and inspect actual Drizzle-generated SQL where appropriate.

The isolated integration suite provisions its own uniquely named fixtures and checks
real public/admin projections, request counts, changed/unchanged tags, series rules,
transaction rollback and body-safe list reads. It mocks authorization/public cache
boundaries so database behavior is the subject of the test. It deletes only its own
rows and refuses non-loopback database hosts.

The browser suite covers routes/SEO, accessibility, mobile/print/layout, consent and
analytics, PDF/social images, writing/search/tag/series content, navigation, signed
previews, authoring and session isolation. Database/auth/media prerequisites can
cause skips; a passing subset does not verify skipped flows.

Inspect the current inventory without changing application data:

```bash
rg --files -g '*.test.ts' -g '*.test.tsx' -g '!node_modules' -g '!build'
npx playwright test --list
```

## Prerequisites and local gate

Use Node 22.22+ (CI: Node 24), npm and the lockfile. Install browser binaries/system
libraries for browser tests. Docker Compose is required for the disposable SQL setup.

```bash
npm ci
npm run check
npx playwright install chromium
```

`type-check` generates Wrangler binding types and React Router route types before
`tsc`, including on a fresh clone without ignored generated files. Unit tests do not load
real remote resources. Integration tests are excluded from ordinary `check` and
require `TEST_DATABASE_URL` explicitly; there is no fallback to a stored database URL.

## Disposable database setup

Never use production or a shared staging database. The session/integration helpers
reject non-loopback hosts, but loopback alone does not make a database disposable.
Compose publishes the proxy on 4444 and Postgres on 55432; an alternate project name
alone does not change these ports. Stop or isolate conflicting services first.

```bash
docker compose -p indrax-e2e up -d --wait
export DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require'
export DIRECT_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:55432/indrax'
export BETTER_AUTH_SECRET='local-only-test-secret-for-disposable-database-0000'
export ALLOWED_GITHUB_ID='1'
export GITHUB_CLIENT_ID='local-test'
export GITHUB_CLIENT_SECRET='local-test'
npm run db:migrate
npm run db:seed
TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration
npm run test:e2e
```

These credentials are local fixtures, not real GitHub/R2/PostHog secrets. DB tooling
loads `.env.local`/`.env`, while test helpers use exported variables. Explicit exports
avoid accidentally selecting a saved Neon URL. Wrangler preview reads matching local
`.dev.vars` files; ensure the built/served Worker gets the same isolated fixture
settings. Public variables are compiled into both Vite bundles, so rebuild when they
change. The Playwright configuration supplies its own origin and dummy analytics
settings; real ingestion/provider credentials are unnecessary.

Clean up only the Compose project created for the test after verifying its name:

```bash
docker compose -p indrax-e2e down --volumes
```

That last command deletes that project's local test volume. Do not use it on a
normal development database whose contents should be retained.

### Fixture contract

The seed validates through the authoring schema and inserts/updates known slugs;
it does not clear unrelated posts. Current fixture names are centralized in
`e2e/support/constants.ts`:

| Slug                                               | State     | Series order |
| -------------------------------------------------- | --------- | ------------ |
| `rendering-an-article-without-shipping-a-renderer` | Published | 1            |
| `a-database-that-is-allowed-to-be-absent`          | Published | 2            |
| `notes-on-preview-tokens`                          | Draft     | 3            |

The `building-this-site` series exposes only published parts. Session helpers use
Better Auth's adapter to mint unique fixture users/sessions and signed cookies.
They can backdate creation or change the numeric GitHub ID for expiry/allowlist
coverage; cleanup removes only fixture users/posts. Interrupted runs can leave data,
which is another reason to use a disposable database. Even read projects can write
view counts or isolated OAuth state; their names do not promise zero writes.

### Skip conditions

Writing content tests need a migrated/seeded `DATABASE_URL`. Authoring/session tests
also require signing/auth configuration and the matching allowlist. OAuth-state
checks require dummy client settings. Media controls cannot verify real upload
success without optional R2 configuration. Missing secrets are not a reason to
supply real production ones to local tests.

## Browser execution and reports

Playwright uses bundled Chromium with Desktop Chrome settings; mobile tests resize
viewports. `PLAYWRIGHT_CHANNEL=chrome` optionally uses installed Chrome. The server
command builds both applications, then `npm run start -- --port <E2E_PORT>` runs
Wrangler against `build/server/wrangler.json`. Default port is 3210. Existing local
servers may be reused; CI does not reuse them. Confirm environment/build freshness
before trusting a reused server.

`reads` runs in parallel. `writes` depends on `reads` and disables file-level case
parallelism; shared authoring lifecycle cases are serial. Separate files may still
use different workers. Use one worker when debugging shared writes. Local retries
are zero; CI allows two retries. Report recovered flakes instead of describing them
as a clean first pass.

```bash
npm run test:e2e -- e2e/writing-content.spec.ts
npm run test:e2e -- --project=reads
npm run test:e2e -- --project=writes
npm run test:e2e -- --workers=1
E2E_PORT=3420 npm run test:e2e
E2E_SCREENSHOTS=on npm run test:e2e
npx playwright show-report
npx playwright show-trace test-results/<case-directory>/trace.zip
```

For smoke checks without fixtures, explicitly export empty database/auth values.
Such a run verifies static/anonymous behavior, not authoring or fixture content.

| Artifact             | Behavior                                               |
| -------------------- | ------------------------------------------------------ |
| `playwright-report/` | HTML report; never opens automatically                 |
| `test-results/`      | Failure screenshots, retained traces and error context |
| Passing screenshots  | Only when `E2E_SCREENSHOTS=on`                         |
| Video                | Not configured                                         |
| Coverage percentages | No statement/branch threshold configured               |

Directories are ignored and later runs can replace evidence. Copy reports/results
elsewhere before rerunning when evidence must be retained. Screenshots are failure
artifacts, not visual-diff baselines.

Analytics helpers grant/deny consent before navigation and intercept the dummy
PostHog host; they decode outbound events without contacting a dashboard. Hydration
helpers wait for meaningful UI readiness rather than arbitrary delays. PDF tests
verify file signatures/content properties and lazy loading; social image tests
verify PNG dimensions/signature, not pixel baselines.

## CI and release boundaries

The check job runs install, formatting/lint/types/unit tests, build without a DB and
audit. The E2E job creates a local Compose database, migrates/seeds, runs SQL
integration tests and then Chromium tests. Audit currently reports findings without
blocking CI. Failure browser artifacts are retained for 14 days. Exact workflow
settings are authoritative in `.github/workflows/ci.yml`.

Deployment needs both jobs and enabled branch/environment controls. A green check
does not authorize shipping a review-only migration. Local package/build success
also does not prove remote CPU compliance or live OAuth/R2 behavior.

## Troubleshooting

| Symptom                            | Next check                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Fixture cases skipped              | Export database/auth values into test process and served Worker            |
| Cards never load                   | Inspect browser writing API response, request origin and Query error state |
| Admin shell loads but data fails   | Inspect session endpoint, allowlist and private API status                 |
| Incorrect connection/content       | Rebuild, restart and check matching runtime local variables                |
| Origin rejected on save/logout     | Match test/public auth origin; do not weaken Origin validation             |
| Proxy connection fails             | Check Compose health, 4444/55432 or isolated overrides                     |
| Port occupied                      | Stop conflicting service or change `E2E_PORT`                              |
| Visible control does nothing       | Check browser errors/hydration and existing readiness helper               |
| No analytics event                 | Check consent setup, dummy-host interception and decoded payload           |
| Only authoring suffix was selected | Its shared post is created by earlier cases; run the full lifecycle        |
| Busy-machine flakes                | Lower workers and inspect traces before changing timeouts                  |

Do not paste secrets, session cookies, preview tokens or draft screenshots into
public issues. Never bypass a security assertion merely to make a suite green.

## Adding tests and known limits

Use colocated unit tests for deterministic logic and handlers. Put actual SQL and
transaction budgets in `test/integration`; place browser/request behavior in `e2e`.
Reuse fixture/session/analytics/hydration helpers, role/label locators and web-first
assertions. Keep fixtures unique and clean up only their rows. Shared writes must
belong to the writes project and be ignored by reads. Do not add production test-login
endpoints or duplicate implementation logic in assertions.

There are no Firefox/WebKit or physical-device projects, no automated screen-reader
review, image baselines, PDF layout diff or performance threshold. Tests do not run
live GitHub OAuth, real PostHog ingestion or a real R2 upload/download flow. Workerd
checks are local: production routing, quotas, CPU and remote cache behavior still
need approved deployment verification. Record commands, runtime, skipped/retried
cases and evidence locations when presenting results.

`npm run db:up` idempotently initializes the local Neon proxy control-plane table
from `config/local-neon.sql`, including on existing local volumes. This is local
Docker setup and is never applied to a remote Neon database.
