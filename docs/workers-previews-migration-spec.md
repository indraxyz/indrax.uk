# One Worker with production and staging Previews

Status: cutover verified on 2026-11-07; repository legacy deployment paths removed.

## Current deployment contract

- `develop` always deploys the named `develop` Preview under `indrax` at
  `develop.previews.indrax.uk`; `main` deploys production on `indrax.uk`.
- CI has no legacy Worker fallback or `WORKERS_PREVIEWS_ENABLED` dependency.
  `CLOUDFLARE_DEPLOY_ENABLED` remains the deployment master switch.
- The `dev` deployment target, named Wrangler environment, legacy deploy/local
  preview scripts and rollback build validation are removed. Unsupported targets
  and nonempty `CLOUDFLARE_ENV` fail before building or uploading.
- Staging quota preparation selects `previews.d1_databases` through a temporary
  D1-only configuration with the exact database ID. It rejects production database
  reuse and does not depend on any Worker environment.
- Staging retains its Neon, KV, D1 and R2 resources, including their existing dev
  names. Production Cron remains; Preview cleanup runs after deploy or manually.
- The old live Worker remains retained with Cron paused. This change does not
  delete it, its hostname or its resources. Recovering that retired deployment
  requires an explicit operator action using historical configuration; current
  CI and scripts cannot select it.

Validation covers retired-target rejection, production/staging target assertions,
D1 identity isolation and temporary-config cleanup on success/failure, workflow
syntax, unit checks and both builds. The 2026-11-07 cutover record below includes
successful real OAuth login and deployed cleanup verification.

The original migration design and dated rollout records below are historical.
References to the cutover gate, `env.dev`, legacy deployment scripts or fallback
behavior describe the migration period and are superseded by this contract.
Live deletion of the retained old Worker is a separate operation.

## Outcome and scope

Use Cloudflare Worker `indrax` for production and a persistent named `develop`
Preview for staging. GitHub Actions remains the only deployment pipeline.
Production continues to serve `indrax.uk` and `www.indrax.uk`. Staging retains
independent Neon, KV, D1, R2, authentication and analytics configuration.

The screenshot supplied with the request shows the production Worker and the
entry point for creating its first Preview. Treat it as submission-time context,
not a live inventory. The local configuration is the implementation baseline;
verify deployed settings before cutover.

The initial migration covers one long-lived staging Preview. Automatic per-PR
Previews, per-branch databases, a UI redesign, production content changes and
automatic promotion of a Preview artifact are outside scope. A release still
rebuilds for production because public origins are embedded in both bundles.

## Verified platform constraints

- Workers Previews live under the same Worker. Wrangler environments such as the
  current `env.dev` instead create separately deployed Workers.
- The installed Wrangler is 4.149.0 and exposes `wrangler preview`; Cloudflare
  documents a minimum of 4.135.0. No dependency upgrade is required by that minimum.
- Preview variables and resource bindings need explicit configuration in
  `previews`. Shared base secrets initialize new Previews; changing a base secret
  does not update existing Previews.
- KV, D1 and R2 are isolated only when bound to different resources. A Preview
  does not automatically clone those resources or an external Neon database.
- Cron Triggers invoke production only. Preview cleanup must be invoked through
  a separate test route calling the shared cleanup function.
- A custom Preview hostname has the form `<preview-name>.<base-domain>`.
  Existing production custom domains do not directly route to a Preview.
- Preview URLs are public unless protected with Access. This design retains the
  existing public staging policy and application authentication for private data.
- The installed CLI labels Preview deployment as open beta. Validate the complete
  build and runtime path before retiring the existing staging deployment.

References: [workflow comparison](https://developers.cloudflare.com/workers/previews/compare-workflows/),
[getting started](https://developers.cloudflare.com/workers/previews/get-started/),
[configuration](https://developers.cloudflare.com/workers/previews/configuration/),
[resource isolation and limitations](https://developers.cloudflare.com/workers/previews/resources/),
[custom domains](https://developers.cloudflare.com/workers/previews/custom-domains/).

## Target environment contract

| Setting                  | Production                         | Staging                                 |
| ------------------------ | ---------------------------------- | --------------------------------------- |
| Worker                   | `indrax`                           | Preview under `indrax`                  |
| Preview name             | Not applicable                     | `develop`, explicitly passed by CI      |
| Git branch               | `main`                             | `develop`                               |
| GitHub environment       | `Production`                       | `Preview`                               |
| Site origin              | `https://indrax.uk`                | `https://develop.previews.indrax.uk`    |
| Media origin             | `https://media.indrax.uk`          | `https://dev-media.indrax.uk`           |
| Neon branch / role       | Existing production / `indrax_app` | Existing develop / `indrax_dev_app`     |
| KV                       | Existing production `CACHE_KV`     | Existing dev `CACHE_KV`                 |
| D1                       | `indrax-next-tags`                 | `indrax-dev-next-tags`                  |
| R2                       | `indrax-media`                     | `indrax-dev-media`                      |
| Rate-limit namespace IDs | `1001`, `1002`                     | `2001`, `2002`                          |
| Search indexing          | Existing production policy         | Disallow; headers and robots response   |
| Automatic cleanup        | Existing production Cron Trigger   | None; post-deploy and manual invocation |

The user selected the staging origin above; live DNS/certificate validation remains
a rollout prerequisite.
Use a dedicated Preview base domain to avoid introducing a wildcard over existing
production subdomains. Confirm certificate coverage for the extra hostname label;
additional certificate features may be required. Do not purchase them implicitly.
If certificate coverage is unavailable, resolve the hostname/certificate decision
before enabling cutover. The implementation uses the selected exact origin;
choosing `workers.dev` later requires updating the central target configuration,
runtime Preview origin, OAuth callback and both bundles together.

`dev.indrax.uk` remains attached to the old dev Worker during verification.
Directly retaining that exact hostname is not assumed to be supported by the
documented Preview hostname scheme. A later redirect or compatibility proxy is a
separate decision; it must not be silently introduced as a second application Worker.

## Configuration and build specification

### Wrangler

Keep production bindings, domains, compatibility settings, assets and Cron at the
top level of `wrangler.jsonc`. Add explicit staging values under `previews`, using
the existing dev resource IDs. Put `ASSETS` configuration at the top level; Preview
uploads use the assets from the selected build.

Configure the dedicated Preview base hostname as a top-level custom-domain entry
with `previews_enabled: true` and `enabled: false`. Keep production custom-domain
entries unchanged. Keep `workers_dev: false`; keep `preview_urls: false` if custom
Preview hosting is verified. Enable the latter only for a deliberately selected
`workers.dev` hosting alternative. Do not place production routes or Cron Triggers
inside `previews`.

Retain `env.dev` temporarily for rollback and local command compatibility. Remove
its remote deployment path only after the Preview passes acceptance. Final local
commands must still provide isolated Workerd resources without requiring any
remote account or Preview secrets.

### Build target and generated configuration

Use `config/deployment-targets.mjs` as the explicit deployment-target resolver for
`production`, `staging` and transitional legacy `dev` targets. It must define the canonical site/media origins and expected resource
boundaries. A staging build must fail if its site origin is missing, equals
production or conflicts with its runtime Preview configuration.

Replace the implicit dependence on `CLOUDFLARE_ENV=dev` for staging bundle defaults
in `config/public-env.ts`. Both public SSR and independent admin builds must receive
the same explicit public values. Preserve the existing browser allowlist; secrets
must never enter Vite definitions or emitted assets.

The local compatibility gate passed: a complete staging build with the installed
Cloudflare Vite plugin preserves the `previews` block in
`build/server/wrangler.json` and points assembled assets at `../client`. No
Preview-setting injection or second deployment configuration is needed. Deploy the
compiled Worker and its assembled assets from that generated configuration; the
parent is `indrax`, not the legacy flattened `indrax-dev` name. This verifies the
local build artifact, not remote Preview activation, domain/TLS or OAuth setup.

Extend `scripts/assert-deploy-target.mjs` to validate the effective target:

- Parent Worker, explicit Preview name, site/media origins and asset directory.
- Production routes including `enabled` and `previews_enabled` fields; the current
  guard omits these fields and would miss Preview-domain mistakes.
- KV/D1/R2 identities and both rate-limit namespace IDs.
- No production resource identities in staging; no cleanup test capability in
  production; production Cron unchanged and absent from Preview settings.
- No secret values in assertion output, generated manifests or archived artifacts.

A generated target manifest should contain only public metadata and resource
identifiers. Use it for build assertions and CI records. It does not prove that
server-side database credentials point at the intended Neon branch; verify that
separately through a server-side operator check that never prints credentials.

## Authentication, secrets, media and analytics

Provision Preview-specific `DATABASE_URL`, `BETTER_AUTH_SECRET`, GitHub OAuth
credentials and numeric author allowlist through approved secret handling. Set
`BETTER_AUTH_URL` to the chosen stable staging origin. Configure the staging GitHub
OAuth App callback as `<staging-origin>/api/auth/callback/github`.

Use the existing develop database; do not reset it, copy production sessions into
it or merge database data as part of this change. A new hostname requires signing
in again. Keep the old staging OAuth App working during parallel validation by
adding the exact Preview callback to the existing staging OAuth App while
retaining its exact legacy callback, or by using a dedicated Preview OAuth App.
GitHub's current [redirect URL documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls)
supports configured callback URLs with per-callback wildcard controls. Use exact
callbacks; do not broaden matching to cover the new hostname.

Populate Preview Base secrets for future creation and explicitly populate/update
the existing `develop` Preview when rotating secrets. Inventory required names,
not values. Do not extract secrets from existing deployments or read `.env.*`
files other than `.env.example` during implementation.

Keep media on the existing dev R2 bucket and `dev-media.indrax.uk`; confirm uploads,
cover rendering, origin policies and security headers from the new site origin.
Keep existing uploaded URLs valid. Do not move media data.

Preserve the selected analytics transport and staging consent behavior. Use a dev
PostHog project/token or leave staging analytics disabled. If enabled in Worker
mode, prepare the existing staging D1 quota tables and run gateway verification
against the actual Preview origin. Do not send staging events to production.

## Cleanup test route contract

Reuse `lib/media-cleanup.server.ts:runScheduledMediaCleanup()` without duplicating
its pending-upload or detached-cover logic. Production `scheduled()` continues to
await it. Add an early Worker handler for:

```text
POST /api/internal/preview/media-cleanup
Authorization: Bearer <PREVIEW_MAINTENANCE_TOKEN>
Content-Type: application/json
Body: {}
```

The route must satisfy all of these requirements:

1. Enable only with an explicit runtime staging capability and configured token;
   verify the request host is the configured stable staging origin. Never enable
   merely because the incoming host differs from production. Production receives
   no enable flag or maintenance token and must return 404 before database access.
2. Require a high-entropy, staging-only token with a constant-time comparison.
   Tokens never appear in a URL, response, browser bundle or logs. Do not accept
   an admin cookie as an alternative to the machine credential.
3. Disabled route returns 404. Enabled route returns 405 with `Allow: POST` for
   unsupported methods and 401 for absent/invalid bearer credentials, before work.
   Enforce JSON and a small bounded body; use existing request helpers. A server
   caller may omit Origin; reject an Origin header that differs from staging.
4. Apply a bounded request limit. Do not allow browser CORS access. Responses use
   `Cache-Control: no-store`, `X-Robots-Tag: noindex` and centralized security headers.
5. Verify required database and media bindings before running. Missing setup is
   503, not a successful no-op; the existing shared function returns early when
   no database exists, so the route must guard this explicitly.
6. Await cleanup and return 200 with `{ "ok": true }` only after completion.
   Return a generic 500 on cleanup failure; retain tracked work for a later run.
   Do not expose row identifiers, object keys or credentials.
7. Preserve existing bounded batches, retry tracking and attachment checks. Audit
   concurrent invocation behavior before permitting automatic retries; add a
   database claim/lease only if existing logic cannot safely tolerate overlap.

Call the route once after each successful staging deployment with
`scripts/preview-maintenance.mjs` and through the dedicated
`.github/workflows/preview-maintenance.yml` `workflow_dispatch` job. The manual job
uses the GitHub `Preview` environment with `deployment: false` so its success does
not become release deployment evidence. Environment secrets, reviewers, wait timers
and branch restrictions still apply; custom deployment protection rule apps are
incompatible with this mode. Configure concurrency so deployment and maintenance cannot invoke
cleanup simultaneously. Give HTTP requests a bounded timeout and fail the job on
non-2xx responses. A timeout can follow partial work; inspect retained state before
retrying. Do not log authorization headers or use verbose HTTP tracing.

Manual maintenance requires the `expected_sha` input to be the full current
develop SHA and calls `scripts/preview-maintenance.mjs --verify-revision`. Before
invocation, it checks the current branch head and latest GitHub Preview deployment's success state, SHA
and exact origin. An unfinished, failed or mismatched latest deployment is
rejected; the check does not skip it to reuse older success evidence. Dispatch from trusted `main` or
`develop`; both deployment gates must be enabled. The cleanup caller has a
60-second timeout, does not follow redirects and does not automatically retry.
A successful bounded invocation may leave eligible or retryable tracked work;
it is not an assertion that the outbox is empty.

There is deliberately no hourly staging scheduler. Expired unattached media may
remain until the next deploy or manual cleanup. Check pending cleanup during
staging upload testing and before release. If continuous automatic expiry becomes
a requirement, add a separately specified scheduler later; do not silently keep
`indrax-dev` solely to obtain a Cron Trigger.

## CI and release behavior

Retain existing check, integration and browser jobs, branch protections and the
repository-level `CLOUDFLARE_DEPLOY_ENABLED` switch. Add
`WORKERS_PREVIEWS_ENABLED=true` as an explicit repository/organization cutover
gate. Leave it unset until the live Preview prerequisites are satisfied; develop
pushes otherwise retain the legacy dev deployment path. Keep dashboard Git Builds
disconnected.

| Trigger                    | Action                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request               | Existing quality checks; build/validate both targets; no remote secrets or Preview deployment                                                        |
| Push to `develop`          | After checks, use legacy dev until cutover gate; then build staging, assert boundaries, deploy named `develop` Preview, verify it and invoke cleanup |
| Push to `main`             | Existing gated production build and deployment; verify production boundaries                                                                         |
| Manual staging maintenance | Verify current staging target; invoke protected cleanup route                                                                                        |

The staging wrapper invokes the installed Wrangler with this command shape:

```bash
npx wrangler preview --config build/server/wrangler.json --name develop --json
```

Do not pass `--env dev`: that would target a Preview under the old dev Worker.
Keep `npm run preview` as local Workerd execution. Use the unambiguous remote
command `deploy:staging`; document the distinction and deprecate the old
remote `deploy:dev` command after cutover. Use explicit production/staging builds
inside each deployment job rather than relying on a preceding job's build output.

`scripts/deploy-staging.mjs` parses the installed Wrangler's versioned Preview
JSONL output and emits an allowlisted `build/staging-deployment.json` record. Record
parent Worker, Preview name, commit SHA, deployment identifier, stable URL and
unique deployment URL in the GitHub deployment record/job summary. Archive the
sanitized record whenever the upload step succeeds, including when a later
security, analytics or cleanup check fails, so recovery retains the deployed
identity. The record and upload summary do not prove successful post-deployment
checks; release evidence requires the whole deployment job to succeed. Verify
the deployed URL belongs to the expected host; never invoke cleanup on an unchecked
URL returned by tooling. Fail on missing bindings or mismatched target metadata.

Serialize production, legacy dev, Preview deployment and manual maintenance with
the shared non-cancelling `cloudflare-indrax` concurrency group during migration,
including domain setup. Preserve non-cancelling deployment behavior.
Prevent an older queued commit from replacing a newer successful Preview.

Update security and analytics verification scripts to accept validated explicit
staging origins instead of hard-coded `dev.indrax.uk`. Retain production-specific
assertions. A successful GitHub `Preview` deployment must represent the exact
release revision and all post-deploy checks, not merely an uploaded bundle.

Release remains `develop` to `main` with independent review and existing required
checks. Preview failures block release readiness; they do not roll production back.

## Implementation work packages

| Package                        | Deliverables                                                                                              | Completion evidence                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Inventory and compatibility | Confirm active resources/secret names, stable host/TLS, Vite-generated Preview support and CLI JSON shape | Recorded public inventory and local build findings; no secret values |
| 2. Build/configuration         | Target resolver, `previews`, generated-config support, strengthened target guard, scripts                 | Production and staging candidate builds with boundary assertions     |
| 3. Cleanup capability          | Protected route, shared function integration, maintenance caller/workflow                                 | Positive staging test and production/unauthorized negative tests     |
| 4. Verification and CI         | Preview deployment path, URL-aware smoke/analytics checks, deployment metadata and concurrency            | Full local checks and fixture-backed suites; reviewed workflow diff  |
| 5. Staging bootstrap           | Approved domain/TLS and secret provisioning, dedicated staging OAuth setup, first Preview                 | Live authoring/upload and cleanup evidence on isolated dev resources |
| 6. Cutover and retirement      | Make Preview required staging target; stop old deployment path; retire old Worker after observation       | Successful release cycle and documented recovery record              |

Primary files: `wrangler.jsonc`, `config/public-env.ts`,
`scripts/assert-deploy-target.mjs`, `scripts/assemble-build.mjs`, `package.json`,
`workers/app.ts`, `lib/media-cleanup.server.ts`,
`scripts/verify-cloudflare-security.mjs`, `scripts/verify-analytics.mjs`,
`.github/workflows/ci.yml`, and focused adjacent tests. Add a small server-only
Preview maintenance handler and caller rather than expanding the writing API.

Update `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `.env.example` and the relevant
deployment, environment, auth, database, media and testing guides to match the
final behavior. Historical release notes must remain identifiable as historical.

## Validation and acceptance

Run focused tests while implementing, followed by `npm run check`, both target
builds, disposable-database integration tests and the applicable fixture-backed
Playwright suites. Report skipped cases and retries. Build inspection must include
both browser bundles and the generated Worker configuration.

Required acceptance evidence:

- Production and Preview target guards reject swapped database-resource metadata,
  KV/D1/R2 IDs, rate-limit namespaces, origins and missing Preview settings.
- Both frontends use the staging origin/media settings in a staging build;
  secrets and maintenance credentials are absent from client artifacts.
- Production cleanup route is absent even for a spoofed host, valid staging token
  or forged cookie. Disabled/missing-token/incorrect-token requests cause no work.
- Route method, content type, body size, Origin, missing bindings, partial cleanup
  failure and repeated invocation behavior have meaningful regression coverage.
- A fixture with one attached cover, one expired unattached upload and retryable
  detached-cover work proves cleanup preserves attachments and processes only
  eligible work. Use disposable local data, never production fixtures.
- Live Preview serves profile/article SSR, archive API/CSR, admin assets and login;
  signed-out private reads and uploads fail; private/preview responses are no-store.
- Real staging GitHub sign-in/out, save, publish/unpublish and cover upload/delete
  succeed; numeric author checks and cross-origin mutation rejection still hold.
- Preview metadata, feeds, sitemap and canonical URLs use its stable origin;
  robots and headers prevent indexing, including static responses where required.
- Existing dev covers still render. Preview data changes do not alter production
  content, media, cache state or auth sessions.
- Post-deploy and manual cleanup succeed on staging; production's schedule and
  cleanup behavior remain intact. No staging hourly invocation is claimed.
- The `develop` Preview appears under `indrax` in Cloudflare; GitHub records the
  correct revision and URLs. Production remains on its recorded active version
  unless separately released through the approved production workflow.

## Rollout, recovery and retirement

1. Record active production/dev versions, resource mappings, domain ownership and
   GitHub environment configuration using read-only checks. Existing docs contain
   historical version IDs; do not treat those as the current active versions.
2. Implement and validate locally on a branch from `develop`. Keep the existing
   staging deployment intact while the candidate configuration is reviewed.
3. Prepare the concrete live-change set: Preview hostname/certificate, secret-name
   inventory, OAuth callback, CI credential scopes, and rollback commands verified
   against installed help. Obtain deployment authorization before applying it.
   Register the Preview base domain through the trigger-only deployment command
   verified against the installed Wrangler, preserving the active production code:
   `npx wrangler triggers deploy --config wrangler.jsonc --env '' --env-file /dev/null`.
   Review all source routes and Cron settings first because this updates trigger
   configuration. Verify the active production version and schedule afterward;
   do not deploy unrelated unreleased application code to bootstrap the domain.
4. Provision the approved Preview configuration and publish the candidate. Keep
   old and new staging cleanup invocations coordinated while they share dev data.
   Do not let two active cleanup paths race without verified overlap safety.
5. Run all live acceptance checks. Change release links and required deployment
   evidence to the new Preview. Observe one complete staging and production release
   cycle, including a successful cleanup test and OAuth round trip.
6. Stop the old dev deployment path and Cron. Retain the old Worker as a rollback
   target until the owner approves retirement. Remove its app domain/OAuth
   association and delete the Worker only as an explicit later operation.
7. Preserve dev Neon, KV, D1 and R2: the Preview still uses them. Never delete these
   resources as part of deleting `indrax-dev`.

Before retirement, recovery restores the old `develop` deployment workflow and
staging OAuth callback, stops Preview maintenance and points reviewers back to
`dev.indrax.uk`. Retain the old OAuth credentials securely for that period. A
Preview configuration rollback must explicitly address its secrets: updating Base
secrets does not change existing Preview secrets. After retirement, recovery
requires recreating the dev Worker from recorded configuration.

Worker rollback does not undo Neon, D1, KV or R2 changes. No database schema change
is expected solely for this migration; any required cleanup concurrency change
must receive its own migration and compatibility review. A failed post-deploy
check can follow a live activation: record the deployed ID and recover explicitly
rather than treating CI failure as an automatic rollback.

The migration is complete when the named Preview is the required staging target,
its data/auth boundaries and cleanup route meet acceptance, production release
checks pass, the old dev application Worker has been explicitly retired, and the
operating docs reflect the resulting one-Worker setup.

## Local implementation evidence

Verified on 2026-11-06, before any live rollout:

- `npm run check`: formatting, ESLint, generated types, TypeScript and 969 unit tests
  passed. A prior run under concurrent browser load had three unit-test timeouts;
  the final isolated run passed.
- All 83 SQL integration tests passed against a separate disposable loopback
  Postgres/Neon-proxy stack; the existing local development database was untouched.
- The initial eight-worker Playwright run passed 363 cases, failed seven and left
  30 dependent write cases unrun. All seven failed read cases passed on a serial
  rerun. The separate serial write run passed 28 cases and skipped two cases that
  require media storage to be unavailable. Combined coverage is 398 passing cases
  and two skips, with seven reruns; this is not a clean single full-suite pass.
- Both workflow files passed Actionlint. Production, staging and legacy dev builds
  passed their deployment-target guards.
- A local staging Workerd instance returned the expected 401/405/403/413 refusal
  responses and a successful 200 cleanup response using only fixture credentials
  and the disposable database. Responses were uncached and non-indexable. A real
  static JavaScript asset also carried the generated noindex header.
- A fixture maintenance secret was absent from the built browser assets. Production
  output contained no generated non-production `_headers` rule.

This evidence covers local implementation only. The original implementation did
not mutate remote resources; authorized bootstrap began afterward and is recorded
below. Live OAuth, Preview activation, remote analytics/media behavior and old dev
retirement are not established by these local results.

## Live rollout status — 2026-11-06

The user authorized bootstrap after the implementation PR was opened. This is a
bootstrap checkpoint, not evidence that CI cutover or the complete migration is
finished.

- Registered `previews.indrax.uk` with `enabled: false` and
  `previews_enabled: true` through Wrangler's trigger-only deployment. The active
  production version remained `bbc306f1-c96f-4524-94f2-afc8e04e0967`, and its
  minute-17 hourly Cron remained unchanged. No production application code was
  deployed for domain registration.
- Cloudflare issued an active certificate covering `*.previews.indrax.uk`.
  HTTPS verification succeeded. No paid certificate upgrade was made.
- Configured a fresh auth secret and maintenance token in Preview Base and the
  matching maintenance credential in GitHub's `Preview` environment. Copied only
  the develop runtime database connection from the authorized protected file;
  its username, database and pooler matched the develop contract. A local SQL
  probe timed out on the network, but successful cleanup from Cloudflare proved
  the connection works in the Preview runtime. Values were not displayed or
  committed.
- The owner approved the narrow local credential-file exception and confirmed
  adding the new callback while retaining the old dev callback. However, the
  OAuth client in `.env.local` belongs to the local `indrax.uk.test` app and does
  not match the live dev OAuth client. No matching staging OAuth credentials
  were found in the available protected files, so those credentials were not
  copied. Correct staging client credentials and the numeric allowlist are still
  required, for example through the ignored `.env.preview-bootstrap` file.
- Created the named `develop` Preview under `indrax`, with Preview ID
  `cf6b02157ccb4fc7890a9423c374ff0a`. The validated candidate deployment is
  `19f93cb3-5bd5-4e05-ae0d-ff9212b02d5c`, tagged with revision
  `a7fce2fd58077f805ef1548d3796a2f3ffeb3e58`.
  Its stable URL is `https://develop.previews.indrax.uk`; its unique URL is
  `https://19f93cb3.previews.indrax.uk`.
- The first upload succeeded but the wrapper rejected the live API's short-ID
  hostname format. The validator now supports that observed format as well as
  the documented format, binding accepted hostnames to the deployment ID.
  Thirteen focused wrapper tests, ESLint and TypeScript passed; a subsequent
  upload completed and emitted the validated public metadata record.
- Live checks passed for the homepage and public posts API, staging canonical
  URLs, disallow-all robots response, RSS and sitemap without production-origin
  links, actual static JavaScript noindex headers, and anonymous private API and
  upload refusal. Authenticated maintenance returned 200 with no-store/noindex.
  Anonymous session inspection reports `authConfigured: false`; this is an
  intentionally closed, incomplete admin configuration, not completed auth
  acceptance.
- Preview analytics are disabled pending an explicitly supplied staging token.
  GitHub's `Preview` build variables match this choice and the dev media origin.
- PR revision `a7fce2f` passed both GitHub jobs after the clean-type fixture fix.
  Its main browser run reported 396 passed, one flaky case and three skips;
  additional direct analytics, Chromium hydration, Firefox hydration and upload
  suites passed 2, 3, 3 and 7 cases respectively. SQL integration passed 83 cases.

`WORKERS_PREVIEWS_ENABLED` remains disabled and `indrax-dev` remains intact. The
candidate is reachable, but the legacy Worker remains CI's active staging target.

Remaining work, in order:

1. Supply the correct existing staging OAuth client ID/secret and numeric author
   allowlist through an authorized protected local file. Verify the client ID
   against the live dev app before copying it. Supply a staging PostHog token
   only if analytics should be enabled.
2. Update both Preview Base and the existing named Preview explicitly; Base
   updates do not retroactively update an existing Preview. Verify session
   configuration, the real GitHub authorization callback and authenticated
   authoring/upload behavior.
3. Verify the final PR checks and merge/release prerequisites. Enable CI cutover
   only after acceptance, then follow the develop pipeline through its actual
   Preview deployment and post-deploy checks, including maintenance.
4. Observe the required release cycle and explicitly retire the old dev Worker
   later, preserving the dev data resources used by the Preview.

## Staging cutover completed — 2026-11-07

- The owner supplied the correct staging OAuth credentials in the ignored
  `.env.preview-bootstrap` file. Its client ID matched the live dev OAuth App.
  Only the client ID, client secret and numeric allowlist were transferred to
  Preview Base and the existing named Preview; file access was restricted to the
  owner. No credential values were displayed or committed.
- Live security smoke checks passed with authentication configured. OAuth start
  returned GitHub with the exact Preview callback, and the owner confirmed a real
  GitHub sign-in reached the admin dashboard.
- PR #102 was merged into develop at
  `79fcc100af9fd25d26b426102fa944c26237d5e6`, and
  `WORKERS_PREVIEWS_ENABLED=true` enabled the CI staging path. All jobs in
  [CI run 42315388075](https://github.com/indraxyz/indrax.uk/actions/runs/42315388075)
  succeeded, including the actual named Preview upload, security verification,
  authenticated cleanup invocation and public deployment artifact retention.
  Production and legacy dev deployment steps were skipped.
- CI recorded Preview deployment `66f104f2-6a35-4431-ab53-74139c5b26ea` under
  parent Worker `indrax`, Preview `develop`, for that exact commit. The stable URL
  is `https://develop.previews.indrax.uk`; the unique URL is
  `https://66f104f2.previews.indrax.uk`.
- The main browser suite reported 397 passed and three skips. Direct analytics,
  Chromium hydration, Firefox hydration and isolated uploads additionally passed
  2, 3, 3 and 7 cases respectively. Analytics remain disabled in the deployed
  staging build because no staging PostHog token was supplied.
- The maintenance revision preflight passed against current develop and its
  successful GitHub Preview deployment. The new manual workflow itself is not
  registered until its file reaches default branch `main` through the normal
  release PR. Post-deploy cleanup is active now; no hourly Preview Cron exists.
- The old dev Worker's Cron was paused through a trigger-only update. Its Worker,
  domain, secrets and dev data resources are retained for rollback. Production's
  active version remains `bbc306f1-c96f-4524-94f2-afc8e04e0967`, with the
  `17 * * * *` Cron preserved.

Staging cutover is complete. Full retirement remains a later explicit operation
after the planned staging/production release observation cycle. A normal release
to main also makes the manual maintenance workflow discoverable; no production
application release was performed as part of this staging cutover.
