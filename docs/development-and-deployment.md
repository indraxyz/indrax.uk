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

| Job     | Required coverage                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `check` | Formatting, lint, generated binding/route types, TypeScript, unit tests, production and develop builds with deployment-target validation |
| `e2e`   | Disposable migrated/seeded SQL integration, Chromium browser/HTTP tests, development hydration and isolated local R2 upload coverage     |

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

| Push branch | GitHub environment | Worker       | Domain                       |
| ----------- | ------------------ | ------------ | ---------------------------- |
| `develop`   | `Preview`          | `indrax-dev` | `dev.indrax.uk`              |
| `main`      | `Production`       | `indrax`     | `indrax.uk`, `www.indrax.uk` |

Deployment runs only after `check` and `e2e` pass and the repository/organization
variable `CLOUDFLARE_DEPLOY_ENABLED` equals `true`. An environment-scoped copy
cannot enable this job condition. Each GitHub environment supplies its own
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANALYTICS_ENABLED` and
`MEDIA_ORIGIN`. Optional `ANALYTICS_TRANSPORT=direct` uses the public build variables
`POSTHOG_PUBLIC_KEY` and `POSTHOG_PUBLIC_HOST`; unset transport defaults to `worker`.
Runtime database, auth and PostHog secrets belong to the matching Worker; CI does not upload local environment files or test fixture secrets.

In Worker mode, the deploy job initializes `analytics_quota` and `analytics_replay_sessions` in
the matching `APP_D1` using `config/analytics-quota.sql` before building and
deploying. Existing counters are preserved. Its token needs D1 write permission
alongside Worker/route and KV permissions. Newly provisioned D1 databases also
need the `revalidations` table as a reviewed operator step; see
[D1/KV preparation](d1-kv-cache.md#preparing-remote-d1).

Apply pending PostgreSQL migrations to the matching environment before its Worker
deployment, including before a develop merge that triggers Preview deployment.
Cover removal/deletion requires `0006_cover_cleanup`. CI fixture migration prepares
only the disposable test database; it does not migrate deployed Neon branches.

`npm run deploy:dev` builds with `CLOUDFLARE_ENV=dev`; `npm run deploy` expects
production, with `CLOUDFLARE_ENV` unset. The target guard rejects a mismatched build.
Both build the public SSR and admin assets, validate generated Worker
name, routes, canonical origin and KV/D1 targets against source `wrangler.jsonc`,
and deploy `build/server/wrangler.json`. These commands change remote traffic;
preview and deployment dry runs are separate validation operations.

Deploy jobs serialize per branch and let active upload/activation finish. The
post-deployment `security:smoke` command checks public and private boundaries.
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

## Promoting develop to production

Open a release PR with head `develop` and base `main`. Review the complete release
diff and verify the current develop revision on `dev.indrax.uk`, including GitHub
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
