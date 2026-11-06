# Development and deployment workflow

## Local development and pull requests

Use Node 22.22+ (CI uses Node 24), npm and the committed lockfile. Run `npm ci`,
copy `.env.example` to `.env.local`, and start `npm run dev`. Public routes use
React Router Framework Mode SSR; admin is an independent Vite CSR bundle. Both
share the Worker and authenticated backend APIs. Use existing feature modules,
components and validation rather than adding a second frontend or API pipeline.

The root `.env.local` configures both local targets, database tooling and preview.
Vite exposes only `SITE_URL`, `MEDIA_ORIGIN`, `ANALYTICS_ENABLED`, `SITE_UPDATED_AT`,
`ANALYTICS_TRANSPORT`, `POSTHOG_PUBLIC_KEY` and `POSTHOG_PUBLIC_HOST` through an
explicit browser allowlist. Runtime secrets stay server-only. Public settings require rebuilding both bundles. Wrangler defines
`CACHE_KV`, `APP_D1` and `MEDIA_BUCKET`; environment-specific resource IDs keep
staging and production isolated. Binding aliases are independent of the existing
resource names and their data.

Create a feature branch from current `develop`, keep docs and tests beside the
changed behavior, and open a PR into `develop`. Run `npm run check` and relevant
integration/browser coverage before review. Use the disposable loopback database
and fixture sessions described in [testing](testing.md); local tests never need
production OAuth, database or ingestion credentials. `npm run preview` and
`npm run preview:dev` build and run through Workerd without deploying remotely.

GitHub Actions runs these jobs on PRs and pushes to `develop`/`main`:

| Job     | Required coverage                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check` | Formatting, lint, generated binding/route types, TypeScript, unit tests, production, staging Preview and legacy dev builds with deployment-target validation |
| `e2e`   | Disposable migrated/seeded SQL integration, Chromium browser/HTTP tests, development hydration and isolated local R2 upload coverage                         |

Audit reports findings without blocking the job. Quality jobs cancel superseded
runs. Test output, skips and retries determine what was verified; a green local
subset does not establish live OAuth, remote uploads or production readiness.

Dependency updates follow the same staging path. The current
[Dependabot configuration](../.github/dependabot.yml) omits `target-branch`, so
scheduled dependency PRs default to `main`; do not assume they already target
`develop`. A dependency PR into main cannot obtain its own Preview deployment
through this workflow: only develop/main pushes deploy. Retarget or recreate
routine and security dependency changes against `develop` as appropriate, review
and merge them there, wait for Preview success on the exact release revision, and
promote through the develop-to-main release PR. Recheck the diff after retargeting.

## Branches and deployment ownership

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) owns deployment. Cloudflare
Workers dashboard Git Builds must remain disconnected to avoid a second pipeline.

| Push branch               | GitHub environment | Target                                 | Domain                       |
| ------------------------- | ------------------ | -------------------------------------- | ---------------------------- |
| `develop`, before cutover | `Preview`          | Legacy Worker `indrax-dev`             | `dev.indrax.uk`              |
| `develop`, after cutover  | `Preview`          | Named `develop` Preview under `indrax` | `develop.previews.indrax.uk` |
| `main`                    | `Production`       | Worker `indrax`                        | `indrax.uk`, `www.indrax.uk` |

The repository/organization variable `WORKERS_PREVIEWS_ENABLED=true` opts develop
pushes into the new Workers Previews deployment path. Leave it unset until the
hostname/TLS, runtime secrets, staging OAuth callback and maintenance token are
configured and verified. Before that switch, the legacy dev deployment remains
available. The implementation PR itself does not provision a Preview or change
live domains. See the [migration specification](workers-previews-migration-spec.md)
for acceptance, recovery and retirement steps.

Deployment runs only after `check` and `e2e` pass and the repository/organization
variable `CLOUDFLARE_DEPLOY_ENABLED` equals `true`. An environment-scoped copy
cannot enable this job condition. Each GitHub environment supplies its own
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANALYTICS_ENABLED` and
`MEDIA_ORIGIN`. Optional `ANALYTICS_TRANSPORT=direct` uses the public build variables
`POSTHOG_PUBLIC_KEY` and `POSTHOG_PUBLIC_HOST`; unset transport defaults to `worker`.
Runtime database, auth and PostHog secrets belong to the matching Worker or named
Preview; CI does not upload local environment files or test fixture secrets.
Preview Base secrets seed newly created Previews. Updating a Base secret does not
update the existing `develop` Preview: rotate its secret explicitly as well.

In Worker mode, the deploy job initializes `analytics_quota` and `analytics_replay_sessions` in
the matching `APP_D1` using `config/analytics-quota.sql` before building and
deploying. Existing counters are preserved. Its token needs D1 write permission
alongside Worker/route and KV permissions. Newly provisioned D1 databases also
need the `revalidations` table as a reviewed operator step; see
[D1/KV preparation](d1-kv-cache.md#preparing-remote-d1).

Apply pending PostgreSQL migrations to the matching environment before its Worker
deployment, including before a develop merge that triggers Preview deployment.
Cover removal/deletion requires `0006_cover_cleanup`; tracked uploads and scheduled expiry
also require `0007_media_upload_lifecycle`, including its attachment-transition trigger.
CI fixture migration prepares
only the disposable test database; it does not migrate deployed Neon branches.

`npm run build:production` and `npm run build:staging` select explicit public
build targets for both public SSR and admin bundles. Staging uses
`https://develop.previews.indrax.uk` and `https://dev-media.indrax.uk`; production
uses its production origins. The target guard rejects conflicting origins and
validates generated parent Worker, domains and Preview flags, bindings, rate-limit
namespaces and cleanup capability before upload.

`npm run deploy:staging` builds and publishes the named `develop` Preview under
`indrax`; it must not pass `--env dev`, which would create a Preview under the old
Worker. `npm run deploy` builds and publishes production. `npm run deploy:dev`
remains the legacy staging rollback path during migration. All three change remote
traffic. `npm run preview` and `npm run preview:dev` remain local Workerd commands;
they do not create Cloudflare Previews.

Production, legacy dev, Preview deployment and manual maintenance jobs share the
non-cancelling `cloudflare-indrax` concurrency group. Before deployment, CI refuses
a revision that no longer matches its branch head. Post-deployment
security checks use the actual validated target origin. A successful staging job
also verifies the protected cleanup route and records its revision and Preview
URLs for release evidence. `scripts/deploy-staging.mjs` reads Wrangler's versioned
JSONL output and writes only allowlisted public metadata to
`build/staging-deployment.json`: parent Worker, Preview name, commit SHA, Preview
and deployment IDs, stable URL and unique deployment URL. CI archives that record
whenever the staging upload step succeeds, including if a later security,
analytics or cleanup check fails. This retains the active candidate's identity
for recovery. The record and upload summary do not prove that verification
succeeded; release evidence requires the whole deployment job to succeed.

In Worker mode, when `ANALYTICS_ENABLED=true`, `scripts/verify-analytics.mjs` also checks the live
analytics gateway's JSON and JavaScript configuration transports against PostHog.
It also checks the installed SDK's performance/dead-click scripts with JavaScript
responses, so a missing asset allowlist entry fails the deployment verification.
Each analytics endpoint has a 15-second timeout covering the request and config
body read. Timeouts and recognized transient connection failures receive up to
three attempts with one- and two-second backoff. Retries repeat only the failed
endpoint and log its public URL and attempt; HTTP errors, invalid MIME types and
invalid configuration fail immediately. A persistent transport failure still
fails CI with the endpoint and reason instead of an unlabelled exception.
It creates no synthetic events; verify consented browser event delivery in the
matching PostHog project separately. See [analytics setup](posthog-gateway.md).
A failed smoke step can follow an already active Worker deployment: inspect the
live version and failure before retrying or choosing rollback.

## Preview bootstrap and cleanup

The Preview base domain `previews.indrax.uk` is a top-level custom-domain entry
with `previews_enabled: true` and `enabled: false`. Its stable staging URL is
`https://develop.previews.indrax.uk`. Bootstrap the domain through an authorized
trigger-only update after reviewing all routes and the production Cron:

```bash
npx wrangler triggers deploy --config wrangler.jsonc --env '' --env-file /dev/null
```

This updates trigger configuration without deploying application code. Verify the
active production version and Cron afterward. The extra hostname label still
needs verified certificate coverage. Do not enable the CI cutover gate until HTTPS works. Keep
`workers_dev: false` and `preview_urls: false`; this setup uses custom Preview
hostnames rather than an additional `workers.dev` origin.

Set staging `SITE_URL` and `BETTER_AUTH_URL` to the stable origin. Add
`https://develop.previews.indrax.uk/api/auth/callback/github` as an exact callback
on the existing staging GitHub OAuth App while retaining
`https://dev.indrax.uk/api/auth/callback/github`, or use a separate Preview OAuth
App. GitHub's current [redirect URL rules](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls)
allow configured callbacks with individual wildcard controls; leave wildcard
matching disabled for the new exact callback. Preserve the old callback and
credentials during rollback observation.
Configure Preview-specific database/auth secrets, numeric author ID and optional
analytics token. Bind the Preview to the existing dev Neon branch, KV, D1 and R2;
no production data is copied or reset.

The 2026-11-06 authorized bootstrap registered the Preview base domain, verified
its active wildcard certificate and created a reachable `develop` Preview with
working develop database reads and maintenance. Production code and Cron were
preserved; no paid upgrade was made. Fresh auth/maintenance secrets are configured,
but the available local OAuth client does not match the existing dev app, so
correct staging OAuth credentials are still needed before admin acceptance and CI
cutover. Analytics remain disabled until a staging token is explicitly supplied.
See the [dated rollout status](workers-previews-migration-spec.md#live-rollout-status--2026-11-06)
for the verified candidate and remaining work. A reachable candidate is not proof
of complete OAuth, authoring or pipeline acceptance.

Production keeps its hourly Cron Trigger. Cloudflare does not invoke a Preview's
`scheduled()` handler. Staging calls the same shared cleanup function through
`POST /api/internal/preview/media-cleanup` with an empty JSON object and
`Authorization: Bearer <PREVIEW_MAINTENANCE_TOKEN>`. The route requires the explicit
staging capability, approved staging origin and a configured high-entropy token;
production and disabled deployments return 404. Foreign Origin headers are
rejected; machine callers may omit Origin. It never accepts an admin cookie in
place of the bearer credential.

Store the token only in the named Preview's runtime secrets and the GitHub
`Preview` environment secret. The post-deploy job runs
`node scripts/preview-maintenance.mjs`; the separately dispatched
[Preview maintenance workflow](../.github/workflows/preview-maintenance.yml) runs
`node scripts/preview-maintenance.mjs --verify-revision`. Both invoke cleanup with
a 60-second request timeout and no automatic retry. Never pass it in a URL or print
HTTP authorization headers. A failure or timeout may follow partial work; inspect
the retained cleanup state before retrying. Production's token namespace and
browser allowlist contain no maintenance credential.

To run manual maintenance, dispatch `preview-maintenance.yml` from trusted `main`
or `develop` with `expected_sha` set to the full 40-character SHA of the current
successful develop deployment. The caller verifies the SHA against current
`develop` and the latest GitHub `Preview` deployment, including its success state
and exact stable origin, before sending the maintenance credential. An unfinished,
failed or mismatched latest deployment is rejected rather than skipped for an
older successful deployment.
Both repository gates must be enabled. This protects the same target as the
post-deploy job; it does not deploy code or run cleanup on a historical revision.

The manual job uses GitHub environment `Preview` with `deployment: false`, so its
success cannot replace deployment evidence required for a release. Environment
secrets, required reviewers, wait timers and branch restrictions still apply.
This mode is incompatible with custom deployment protection rule apps; resolve
that configuration before relying on manual maintenance. It does not bypass the
existing protected environment rules.

HTTP 200 means one bounded invocation completed. It does not mean that all
pending uploads or detached-cover retries have been drained: shared references,
batch limits or retryable storage failures can leave tracked work for another run.

There is no hourly staging cleanup. Expired unattached uploads remain until the
next staging deploy or manual invocation. Check cleanup during upload tests and
before release. During parallel validation, coordinate the old dev Cron and the
new route because they use the same dev data. After acceptance, disable the old
dev deployment/Cron, retain a recorded rollback target, and retire `indrax-dev`
only through an explicit later operation. Preserve its KV, D1, R2 and Neon
resources because the Preview uses them.

## Promoting develop to production

Open a release PR with head `develop` and base `main`. Review the complete release
diff and verify the current develop revision on the active staging origin (the
`develop` Preview after cutover, otherwise `dev.indrax.uk`), including GitHub
sign-in/out, save, publish/unpublish, uploads, public discovery, metadata and feeds.
Keep release readiness evidence in the PR so it stays tied to the revision.

`main` requires the following protections, including for administrators:

- A pull request with at least one eligible reviewer's approval; the author cannot
  approve their own PR.
- Dismiss stale approvals after new commits, and resolve all review conversations.
- Passing GitHub Actions `check` and `e2e` checks with the branch up to date.
- A successful deployment to the GitHub `Preview` environment for the release
  revision before merging. A local preview or PR build is not that deployment.
- Block force pushes and branch deletion.

These protections are GitHub repository settings, separate from the checked-in
workflow. Recheck them when repository access or workflow job names change. If a
release PR has no eligible independent reviewer, arrange review rather than
bypassing the approval requirement. New commits require renewed approval and
current checks/deployment evidence.

Before merging, confirm Production CI credentials/build variables, the production
GitHub OAuth App callback `https://indrax.uk/api/auth/callback/github`, numeric
author allowlist, database/schema, Worker secrets and isolated storage bindings.
When the latest uploaded Worker version is not active, use Wrangler's versioned
secret workflow to stage credentials without deploying traffic. Inspect the
candidate's code and all required secrets before activating it; secret presence
on an uploaded version does not prove the active version has those bindings.

Apply required PostgreSQL migrations through the matching direct migration
connection as a reviewed release step. Never seed local fixtures remotely. Record
the active known-good Worker version and a rollback plan compatible with any data
changes. An eligible independent reviewer approves the PR; the owner makes the
final merge decision. Merging triggers the gated main push pipeline. There is no
automatic merge step.

After deployment, confirm the actual active version, production canonical origins,
OAuth and authoring/upload journeys, and inspect errors and CPU in Observability.
Rollback changes Worker code/configuration; it does not undo PostgreSQL, D1, KV
or R2 changes. See [release context](public-site-release.md) and
[analytics setup](posthog-gateway.md) for domain-specific preparation.
