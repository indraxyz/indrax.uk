# Worker traces and writing interactions production release

Date: 2026-11-09. Branch: `fix/worker-traces-production-release`, based on
`develop` at `45c1b596a01935bb406221d9b56840a6716b930b`.

## Request and investigation

Match the owner's Cloudflare observability screenshot, explain production versus
Previews Base settings, and release the current develop changes through CI.
No issue number was supplied. The owner explicitly authorized using their bypass
authority for the final release decision; do not alter repository protections.

Production currently runs Worker version `4481d70b-6b51-41b7-aa7f-62df87f0f46b`.
The production GitHub environment has analytics disabled. The source configuration
already isolates Preview KV, D1, R2, rate limits and origins. Dashboard Previews
Base is a template rather than the active named Preview's complete configuration.
Base secrets seed new Previews; changing them does not rotate existing Previews.

The release includes writing reactions, compact tag disclosures, copy-link toast
feedback, pagination focus/scroll behavior, draft autosave and authoring refresh,
status styling, and fewer redundant editor/list requests. See the existing
[feature spec](writing-interactions-and-authoring.md) for behavior and coverage.
Production is missing additive migration `0008_post_reactions`; the preceding
eight journal hashes match the repository. Develop already has the migration.

## Plan

1. Match screenshot observability settings and document storage semantics.
2. Extend the existing deployment guard to detect generated observability drift.
3. Validate unit checks, both target builds and production dry-run packaging.
4. Verify the existing develop migration and apply committed migration 0008 plus
   its matching Drizzle journal entry atomically to production before release.
5. Open and merge a configuration PR into develop after CI succeeds, then verify
   the exact develop revision's Preview deployment and smoke checks.
6. Open the develop-to-main release PR, record migration and QA evidence, run its
   checks, and merge under the owner's explicit release authorization.
7. Wait for production CI deployment and run public/private boundary checks.

## Acceptance criteria

- Logs enabled, sampled at 1, invocation logs enabled and persisted.
- Traces enabled, sampled at 1, with `persist: false`, matching the screenshot.
- Query-string redaction and issues stay enabled. No trace export destination.
- Documentation explains that these traces are not stored in Cloudflare. PostHog
  configuration URLs contain a token in the path; persistence/export requires
  verified span suppression or redaction first.
- Source and generated observability settings must match before deployment.
- Production and Preview resource identities remain isolated. No credentials are
  copied between environments, and no local environment files are read or edited.
- Production migration journal and reaction constraints match committed SQL, with
  SELECT/INSERT/DELETE granted to its existing restricted runtime role.
- CI owns deployments; production ships from a develop-to-main release PR after
  exact-revision Preview evidence and passing check/e2e jobs.
- Production origins, private response boundaries, feeds and existing Cron remain
  valid after release. No synthetic production article or reaction writes for QA.

## QA and evidence

- `npm run check`: formatting, lint, generated types, TypeScript and unit suite.
- Deployment-guard unit cases cover omitted observability, disabled query redaction
  and changed trace persistence, in addition to existing isolation checks.
- Build production and staging separately, run the existing deployment-target
  assertions, and production `wrangler deploy --dry-run` with no local env file.
- CI runs the migrated disposable database integration/browser suites, direct
  analytics transport, Chromium/Firefox hydration and isolated upload tests.
- Record skips and retries. Prior develop CI `42475942641` passed 1,035 unit,
  93 integration and 437 browser tests; three browser cases skipped and one
  admin-boundary case passed on retry after an initial 500 instead of 401.
  Additional direct analytics, hydration and upload suites passed. Fresh evidence
  is required for the final configuration and release revisions.
- Inspect production/develop schema and journal without reading content or secrets.
  Confirm the reaction primary key, allowed-reaction check and cascading post FK.
- Record fresh Preview deployment identity and successful security/cleanup steps.
- Record production CI run, active version and smoke outcome in the release PR.
- Real GitHub OAuth and manual authoring/upload journeys require owner interaction;
  automated fixture sessions do not prove a real OAuth round trip.

## Rollback and operational limits

Use the recorded previous Worker version for a reviewed rollback if production
verification fails. Worker rollback does not revert Neon, D1, KV or R2. Migration
0008 only adds a table, so retain it when rolling application code back; do not
drop production reaction data. This release does not enable analytics, rotate
secrets, retire the old Worker, change DNS/TLS or change protection settings.
Trace persistence remains disabled; enabling tracing alone does not make stored
traces available in the dashboard.
