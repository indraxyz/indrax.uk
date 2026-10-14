# Protected PostHog forwarding

The browser initializes the existing PostHog SDK with the public placeholder
`phc_indrax_gateway`. All event, replay, flags, remote configuration and SDK
asset requests go to `/api/analytics/*` on the site's own origin. The Worker validates
requests and reserves a shared quota before adding `POSTHOG_PROJECT_TOKEN` from
its runtime secrets. The real project token is never embedded in either browser
bundle or returned by the gateway. Personal PostHog API keys are not used.

Pageviews, page exits, contact/PDF events, automatic click capture and session replay
remain supported. Recording still depends on the PostHog project's replay settings,
sampling and triggers. Consent is required before the SDK starts. Withdrawing it
stops capture and clears SDK identifiers. The gateway cannot verify a visitor's
localStorage consent; an anonymous caller can imitate the public request protocol.

The script allowlist includes the recorder family, `web-vitals`,
`web-vitals-with-attribution` and `dead-clicks-autocapture`, with both versioned
and fallback paths. Remote project settings still control performance and dead-click
capture. These scripts share the existing asset quota, fixed regional host, bounded
response size and JavaScript MIME checks. Surveys are explicitly disabled with the
SDK's `disable_surveys` option: this site does not support survey response events
or endpoints. Arbitrary SDK scripts remain refused.

## Configuration and limits

| Setting                   | Location                                  | Purpose                                                     |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `ANALYTICS_ENABLED=true`  | GitHub Environment variable at build time | Enable the browser tracker; contains no credential          |
| `POSTHOG_PROJECT_TOKEN`   | Cloudflare Worker runtime secret          | Real project ingestion token (`phc_`), never a personal key |
| `POSTHOG_HOST`            | Wrangler runtime variable                 | Fixed US or EU ingestion host                               |
| `POSTHOG_MONTHLY_*_LIMIT` | Optional Worker runtime variable          | Lower a category's hard ceiling, including zero to stop it  |

Set build variables separately in GitHub `Preview` and `Production`. Set runtime
secrets separately on `indrax-dev` and `indrax`. Runtime host defaults to US Cloud;
select `https://eu.i.posthog.com` for an EU project in both relevant Wrangler environments.
The browser build does not read PostHog credentials or upstream hosts. Its explicit
allowlist excludes runtime secrets and `POSTHOG_HOST` from browser definitions.

The existing rate limiter permits at most 120 analytics requests per client IP
per minute at each Cloudflare location. This is an eventually consistent brake;
the D1 reservation is the hard, shared forwarding cap. Each environment uses its
own existing `APP_D1` database, so development cannot spend production's
gateway allowance. If both environments use one PostHog project, its billing usage
includes both environments.

### Comparison with PostHog's free allowance

The [published PostHog pricing](https://posthog.com/pricing), checked on 2026-10-14,
includes 1,000,000 analytics events, 5,000 session recordings and 1,000,000 feature
flag requests per month. Preview and Production each receive an equal share of a
combined gateway budget of 50% of those published allowances. These are application
ceilings, not a live synchronization with the organization's billing account.

| Product        | PostHog monthly free allowance | Per environment per UTC month  | Combined Preview and Production ceiling |
| -------------- | ------------------------------ | ------------------------------ | --------------------------------------- |
| Analytics      | 1,000,000 events               | 250,000 approved events        | 500,000 approved events                 |
| Session replay | 5,000 recordings               | 1,250 distinct replay sessions | 2,500 distinct replay sessions          |
| Feature flags  | 1,000,000 requests             | 250,000 evaluations            | 500,000 evaluations                     |

The replay session registry counts distinct session IDs within each environment
and UTC month. The first admitted snapshot request for a session reserves a recording
slot; continuing that same session in the same month does not reserve another slot.
Each session is counted separately in the next month. This is a conservative gateway
proxy for recordings, not a reconciliation with PostHog's billed recording count.
The registry starts at deployment and does not backfill earlier recordings.
Snapshot envelopes have a separate transport guard: many envelopes may belong to
one session, so envelopes and recordings are not interchangeable units.

Byte limits and transport guards may stop forwarding before the product ceilings.
Configuration and recorder-asset limits protect Worker/upstream traffic and have
no equivalent free-tier billing unit in this comparison. Do not give both
environments the entire shared budget when they use the same PostHog organization.

Gateway windows are UTC calendar months; PostHog billing periods and usage from
other projects/integrations are not read by this application. The existing token
also remains usable for direct ingestion, as requested by the owner. Therefore
these gateway limits do not guarantee an organization-wide free bill. Keep
PostHog's per-product billing limits at $0 if paid overages must be prevented.
Recheck the published allowances before changing code ceilings; they are not
automatically updated when PostHog changes its pricing.

The following hard ceilings apply separately to each environment. Optional
`POSTHOG_MONTHLY_*_LIMIT` runtime variables can lower these ceilings, including to
zero, but cannot raise them.

| Category     | Monthly unit ceiling           | Monthly byte ceiling         |
| ------------ | ------------------------------ | ---------------------------- |
| `EVENTS`     | 250,000 allowlisted events     | 512 MiB forwarded payloads   |
| `RECORDINGS` | 1,250 distinct replay sessions | Covered by the replay guard  |
| `REPLAY`     | 100,000 snapshot envelopes     | 512 MiB forwarded payloads   |
| `FLAGS`      | 250,000 evaluations            | 256 MiB request payloads     |
| `CONFIG`     | 10,000 configuration fetches   | 1,280 MiB reserved responses |
| `ASSETS`     | 10,000 recorder-script fetches | 5,120 MiB reserved responses |

Use `POSTHOG_MONTHLY_RECORDINGS_LIMIT` to lower the distinct-session ceiling and
`POSTHOG_MONTHLY_REPLAY_LIMIT` to lower the snapshot-envelope guard. A recording
needs multiple envelopes; either replay guard can leave partial recordings. GET
requests reserve their maximum response size before forwarding: 128 KiB for
configuration and 512 KiB for assets. The byte ceilings allow all 10,000 fetches
in each category at those reservation sizes. Browser asset responses cache privately
for one hour.

Quota windows use calendar months in UTC. Atomic D1 reservations count batch events
individually and refuse requests crossing unit or byte limits. Replay reservations
also register new session IDs and enforce the recording ceiling; continuation of
registered sessions remains subject to envelope and byte limits. Reservations
happen before forwarding. There are no refunds or automatic upstream retries: a
timeout cannot spend an uncounted retry. Keep current-month counter and session
registry rows intact; resetting/deleting them removes the spending guard. Old month
rows are retained.

Unknown routes/methods/events, cross-origin browser requests, missing client IPs,
invalid visitor/replay shapes and oversized/compression-bomb bodies are refused.
Client credential fields are replaced only at the ingestion positions; nested
data never selects another project. Client IP properties are overwritten with the
trusted Cloudflare client IP to preserve the existing visitor geolocation behavior.
URLs in events and raw replay data have bearer query values redacted. Request gzip
is bounded after decompression; nested replay compression is disabled so URLs stay
inspectable. SDK consent and do-not-track behavior remain in place.

Missing secrets, unsupported upstream hosts, missing D1 tables/bindings or quota
errors fail closed. Quota/edge refusals return 429; upstream failures return a generic 502. Responses never expose upstream error text, cookies, secret headers or redirects.
The browser CSP allows scripts and connections only from its own origin, so the
SDK cannot bypass the gateway by switching to an external ingestion/asset host.

Upstream fetches use `redirect: "manual"` and reject every non-success status,
including redirects. The installed Cloudflare runtime rejects `redirect: "error"`
before dispatch, even though Node accepts it; mocked Node/browser tests do not
detect that runtime difference.

When `ANALYTICS_ENABLED=true`, CI checks the deployed gateway's JSON and JavaScript
configuration endpoints and the three performance/dead-click assets after deployment.
Asset versions come from the installed, lockfile-resolved `posthog-js` package.
Run `node scripts/verify-analytics.mjs dev`
or `node scripts/verify-analytics.mjs production` to repeat the check. These checks
use the real upstream and reserve two configuration and three asset requests, but create no events.
They detect runtime, credential, configuration and quota failures; they do not prove
event ingestion or dashboard visibility, which still need a consented browser visit
and inspection of the matching PostHog project.

Automatic Worker traces are disabled in the reviewed configuration because PostHog's
configuration-fetch URL contains the server token in its path. Cloudflare fetch spans
record that URL; query-string redaction does not redact path segments. Redacted
invocation logs and issues remain enabled. Re-enable tracing only after adding a
verified way to suppress/redact those credential-bearing spans.
See [Cloudflare's recorded HTTP span attributes](https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/).

## Initialization and historical preparation

Historical preparation on 2026-10-14 (these staged versions are not a current
active-version inventory): the existing project token from the commented local
environment entry was staged as `POSTHOG_PROJECT_TOKEN` on both Workers. Secret
bindings were verified in dev version `07e84d66-d9e4-4c65-8fb1-2fdd0d6d382e` and
production version `8de290fb-ad5b-4dba-b72c-e3f37a08fc8a`. Both active deployment
histories remained unchanged. GitHub `Preview` and `Production` now have verified
`ANALYTICS_ENABLED=true` variables. No code was shipped and no token
was rotated. The owner has explicitly chosen to retain the current token; previously
exposed copies can still bypass this gateway's limits until that choice changes.

Local dev/preview scripts initialize `config/analytics-quota.sql` alongside the
existing cache table. The deploy workflow initializes the matching remote `analytics_quota` and
`analytics_replay_sessions` tables before deployment; its Cloudflare token needs D1 write permission. This operation
creates absent tables and preserves all existing counters. See the
[development and deployment workflow](development-and-deployment.md) for current
CI and release gates.

Before enabling analytics, review the PR, verify the target project/region and
stage `POSTHOG_PROJECT_TOKEN` as a Worker secret. To stage without changing traffic:

```bash
npx wrangler versions secret put POSTHOG_PROJECT_TOKEN --config wrangler.jsonc --env dev
npx wrangler versions secret put POSTHOG_PROJECT_TOKEN --config wrangler.jsonc --env ''
```

The commands read the token from protected interactive input; never put it in
command arguments or commit it. A local ignored `.env.local` can hold the runtime
token for development. Keep analytics disabled in environments without a token.
Setting only a runtime secret does not enable browser capture: the build flag must
also be true in that environment's next approved build.

Deploy and verify both environments' gateway clients. Inspect browser requests for
the placeholder, confirm consent/withdrawal,
confirm real events and a replay appear in the intended PostHog project, and verify
the actual project token is absent from browser JS and response bodies. Browser
tests use synthetic config and the installed recorder; they do not prove a real
project is configured to record.

No token rotation is part of this release, as requested by the owner. If rotation
is authorized later, first verify both environments' gateway clients, then rotate
the previously public token in PostHog and securely update each Worker secret.
PostHog immediately revokes the old token, so coordinate the cutover with other
integrations. A secret-only deployment must use the approved gateway code, not a
pending older application version. Confirm code/version and other staged secrets
before activation.

Keep a $0 or chosen per-product PostHog billing limit as the final account-level
guard. Gateway quotas bound this application's forwarding, not traffic sent using
another integration or a still-valid previously exposed token. Anonymous bots can
still exhaust the gateway's bounded allowance; there is no guarantee that a public
visitor request represents a human.

Sources: [SDK configuration and request rewriting](https://posthog.com/docs/libraries/js/config#customize-reverse-proxy-request-paths),
[session replay controls](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record),
[project token rotation](https://posthog.com/docs/settings/projects),
[billing limits](https://posthog.com/pricing),
[Cloudflare rate-limiter consistency](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
